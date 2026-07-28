import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ecsBenches } from './ecs.bench.js';
import { type BenchStats, formatStats, toMarkdownRow } from './harness.js';
import {
  type HeapDeltaResult,
  integrationBenches,
  integrationHeapDelta,
} from './integration.bench.js';
import { particlesBenches } from './particles.bench.js';
import { physicsBenches } from './physics.bench.js';
import { renderBenches } from './render.bench.js';
import {
  appendHistoryRow,
  benchmarksDocFile,
  collectProvenance,
  type DeviceReport,
  heapToResult,
  type MicrobenchReport,
  readMicrobenchJson,
  resultsDir,
  statsToResult,
  writeFileAtomic,
  writeMicrobenchJson,
} from './results.js';
import { findContractViolations, HEADLINE_PREFIXES } from './scenario-contract.js';

type Group = { title: string; results: BenchStats[] };

function runAll(): Group[] {
  return [
    { title: 'ECS', results: ecsBenches() },
    { title: 'Physics', results: physicsBenches() },
    { title: 'Particles', results: particlesBenches() },
    { title: 'Render', results: renderBenches() },
    { title: 'Integration', results: integrationBenches() },
  ];
}

function formatHeapDelta(r: HeapDeltaResult): string {
  const total =
    r.deltaBytes >= 0
      ? `+${(r.deltaBytes / 1024).toFixed(1)} KB`
      : `${(r.deltaBytes / 1024).toFixed(1)} KB`;
  const perFrame =
    r.bytesPerFrame >= 0
      ? `${r.bytesPerFrame.toFixed(1)} B/frame`
      : `${r.bytesPerFrame.toFixed(1)} B/frame`;
  return `${r.name.padEnd(44)}  ${total.padStart(12)} over ${r.iterations
    .toString()
    .padStart(4)} frames   ${perFrame.padStart(16)}`;
}

function heapDeltaMdRow(r: HeapDeltaResult): string {
  const total =
    r.deltaBytes >= 0
      ? `+${(r.deltaBytes / 1024).toFixed(1)} KB`
      : `${(r.deltaBytes / 1024).toFixed(1)} KB`;
  return `| ${r.name} | ${r.iterations} | ${total} | ${r.bytesPerFrame.toFixed(1)} B |`;
}

function printText(groups: Group[], heap: HeapDeltaResult[]): void {
  for (const g of groups) {
    console.log(`\n== ${g.title} ==`);
    for (const r of g.results) console.log(formatStats(r));
  }
  console.log('\n== Integration heap delta (post-GC, steady state) ==');
  for (const r of heap) console.log(formatHeapDelta(r));
}

function findResult(groups: Group[], scenarioPrefix: string): BenchStats | null {
  for (const g of groups) {
    for (const r of g.results) {
      if (r.name.startsWith(scenarioPrefix)) return r;
    }
  }
  return null;
}

function fmtUs(ns: number): string {
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  if (ns >= 1_000) return `${(ns / 1_000).toFixed(1)} µs`;
  return `${ns.toFixed(0)} ns`;
}

function loadDeviceReport(): DeviceReport | null {
  try {
    const file = resolve(resultsDir(), 'device.json');
    const raw = readFileSync(file, 'utf8');
    return JSON.parse(raw) as DeviceReport;
  } catch {
    return null;
  }
}

function deviceFpsStats(fps: number[]): {
  min: number;
  avg: number;
  max: number;
} {
  if (fps.length === 0) return { min: 0, avg: 0, max: 0 };
  let min = fps[0] as number;
  let max = fps[0] as number;
  let sum = 0;
  for (const v of fps) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, avg: sum / fps.length, max };
}

function renderMarkdown(
  groups: Group[],
  heap: HeapDeltaResult[],
  device: DeviceReport | null,
  capture: MicrobenchReport,
): string {
  const captured = capture.generated.slice(0, 10);
  const rendered = new Date().toISOString().slice(0, 10);
  const cpu =
    capture.cpuModel === undefined
      ? 'CPU: unrecorded'
      : `CPU: ${capture.cpuModel} (${capture.cpuCount ?? '?'} cores)`;
  const commit =
    capture.gitSha === undefined
      ? 'Commit: unrecorded'
      : `Commit: ${capture.gitSha}${capture.gitDirty ? ' (dirty tree)' : ''}`;

  const lines: string[] = [];
  lines.push('# Flare Engine — Benchmarks');
  lines.push('');
  lines.push(
    `> **Captured: ${captured}** · Rendered: ${rendered} · Runtime: ${capture.runtime} · Platform: ${capture.platform} · ${cpu} · ${commit}`,
  );
  lines.push('');
  lines.push(
    '> Every number below comes from the committed baseline captured on the date above — not from the day this page was rendered. Re-capture with `bun run bench:baseline` (~2 min), then `bun run bench:md`.',
  );
  lines.push('');

  // Headline numbers
  const ecsK = findResult(groups, HEADLINE_PREFIXES.ecs);
  const partK = findResult(groups, HEADLINE_PREFIXES.particles);
  const renderK = findResult(groups, HEADLINE_PREFIXES.render);
  const integ1k = findResult(groups, HEADLINE_PREFIXES.integration);
  lines.push('## Headline numbers');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  if (ecsK)
    lines.push(`| ECS step, 1000 entities (Pos+Vel) | **${fmtUs(ecsK.nsPerOp.median)}** / frame |`);
  if (partK)
    lines.push(`| Particles integrate, 1000 alive | **${fmtUs(partK.nsPerOp.median)}** / frame |`);
  if (renderK)
    lines.push(
      `| Render flush, 1000 sprites / 1 atlas | **${fmtUs(renderK.nsPerOp.median)}** / frame |`,
    );
  if (integ1k)
    lines.push(
      `| Integration frame, 1000 entities + 300 particles | **${fmtUs(
        integ1k.nsPerOp.median,
      )}** / frame |`,
    );
  if (device && device.devices.length > 0) {
    for (const d of device.devices) {
      for (const load of d.loads) {
        const s = deviceFpsStats(load.fps);
        lines.push(
          `| ${d.device} · ${load.label} | **${s.avg.toFixed(
            0,
          )} fps avg** (min ${s.min}, max ${s.max}) |`,
        );
      }
    }
  } else {
    lines.push('| Device FPS | _pending capture — see [Device](#device) section_ |');
  }
  lines.push('');

  lines.push('## Methodology');
  lines.push('');
  lines.push(
    'Off-device microbenchmarks exercise engine hot paths under Bun on the developer machine — pure algorithmic cost, no Skia, no React Native bridge, no device I/O. Their value is regression detection and order-of-magnitude sizing; they do **not** predict on-device frame times. For real frame times see the [Device](#device) section.',
  );
  lines.push('');
  lines.push(
    'Each row reports the median of the sample count recorded in the baseline, where each sample times N inner iterations of the hot path. "p99" is the 99th-percentile sample latency across those samples.',
  );
  lines.push('');
  lines.push(
    'Frame budget at 60 fps is 16.67 ms. A system taking 1 ms per step leaves 15+ ms for the rest of the frame.',
  );
  lines.push('');

  for (const g of groups) {
    lines.push(`## ${g.title}`);
    lines.push('');
    lines.push('| Scenario | Cost / op (median) | Ops / sec | p99 sample |');
    lines.push('|---|---:|---:|---:|');
    for (const r of g.results) lines.push(toMarkdownRow(r));
    lines.push('');
  }

  lines.push('## Integration heap delta');
  lines.push('');
  lines.push(
    'Heap growth across N steady-state frames after warmup, measured `process.memoryUsage().heapUsed` deltas around forced GCs.',
  );
  lines.push('');
  lines.push(
    '**These numbers do not currently support a zero-alloc claim.** The section runs in the same process as every preceding suite, so the deltas carry that accumulated garbage and the sign flips between runs. Measured in isolation the same frames show a stable positive per-frame growth. Exact allocation counters replace this section in a later row; until then read it as a known-broken instrument, not as evidence.',
  );
  lines.push('');
  lines.push('| Scenario | Frames | Δ heap | Per-frame |');
  lines.push('|---|---:|---:|---:|');
  for (const r of heap) lines.push(heapDeltaMdRow(r));
  lines.push('');

  lines.push('## Device');
  lines.push('');
  if (device && device.devices.length > 0) {
    lines.push(
      'On-device FPS samples captured from a device benchmark scene (hidden triple-tap on title). Each sample = one second; load levels spawn fixed entity/particle counts.',
    );
    lines.push('');
    for (const d of device.devices) {
      lines.push(`### ${d.device} (${d.os})`);
      if (d.notes) {
        lines.push('');
        lines.push(`> ${d.notes}`);
      }
      lines.push('');
      lines.push('| Load | Min | Avg | Max | Samples |');
      lines.push('|---|---:|---:|---:|---:|');
      for (const load of d.loads) {
        const s = deviceFpsStats(load.fps);
        lines.push(
          `| ${load.label} | ${s.min} | ${s.avg.toFixed(1)} | ${s.max} | ${load.fps.length} |`,
        );
      }
      lines.push('');
    }
  } else {
    lines.push(
      'No device samples captured yet. Run a release build on hardware, open the bench scene (triple-tap the menu title), copy CSV from console, and append entries to `benchmarks/results/device.json`.',
    );
    lines.push('');
  }

  lines.push('## Notes on interpretation');
  lines.push('');
  lines.push(
    '- **ECS** — "op" is one `world.step(dt)` running the move system over all entities. Per-entity cost = `cost / entities`.',
  );
  lines.push(
    '- **Physics** — "op" is one frame: move every collider + `world.step()`. "dense" packs colliders into a 500×500 area (many overlaps); "sparse" uses 2000×2000 (few).',
  );
  lines.push(
    '- **Particles** — "integrate-only" holds N particles alive and calls `update(dt)` — measures pool integration cost. "emit+integrate" runs a saturated emitter at 2× cap/s with gravity.',
  );
  lines.push(
    '- **Render** — `flush` measures sprite command queueing + grouping by texture. `sort` measures `sortByDrawOrder` on a nearly-sorted list with K random swaps (insertion sort is O(n+k²) after k swaps).',
  );
  lines.push(
    '- **Integration** — one frame = `world.step` + per-entity `coll.setPosition` + `coll.step` + `emitter.update` + sprite draw queue + `sortByDrawOrder` + `batch.flush`. Steady state: 300 particles + N entities (Pos+Vel + AABB collider + sprite). Closer shape match to a real demo frame than per-system microbenches.',
  );
  lines.push('');
  lines.push('## Gating native (C++) acceleration');
  lines.push('');
  lines.push(
    'Priority order and the standing gate decision live in [native-acceleration.md](../design/native-acceleration.md). Numbers above are the JS baseline against which any native port must demonstrate speedup.',
  );
  lines.push('');

  return lines.join('\n');
}

function buildReport(groups: Group[], heap: HeapDeltaResult[]): MicrobenchReport {
  return {
    generated: new Date().toISOString(),
    runtime: `Bun ${Bun.version}`,
    platform: `${process.platform} ${process.arch}`,
    ...collectProvenance(),
    suites: groups.map((g) => ({
      title: g.title,
      results: g.results.map(statsToResult),
    })),
    heap: heap.map(heapToResult),
  };
}

function reportToGroups(report: MicrobenchReport): Group[] {
  return report.suites.map((s) => ({
    title: s.title,
    results: s.results.map(
      (r): BenchStats => ({
        name: r.scenario,
        innerIters: r.innerIters,
        samples: r.samples,
        nsPerOp: { min: r.minNs, median: r.medianNs, mean: r.meanNs, p99: r.p99Ns },
        opsPerSec: r.opsPerSec,
      }),
    ),
  }));
}

const MAX_BASELINE_AGE_DAYS = 30;

function ageInDays(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / 86_400_000;
}

const args = new Set(process.argv.slice(2));

// `--markdown` publishes the committed baseline; it never runs the suites. One
// captured number therefore backs both the doc and the dashboard, and no render
// path can stamp today's date on an older capture.
if (args.has('--markdown')) {
  const baseline = readMicrobenchJson();
  if (baseline === null) {
    console.error(
      `No readable baseline at ${resolve(resultsDir(), 'microbench.json')} (missing or unparseable). Capture one: bun run bench:baseline`,
    );
    process.exit(1);
  }
  if (typeof baseline.generated !== 'string' || Number.isNaN(Date.parse(baseline.generated))) {
    console.error(
      'Baseline has no usable "generated" timestamp — it cannot be dated honestly. Re-capture: bun run bench:baseline',
    );
    process.exit(1);
  }

  // A baseline captured before a scenario rename would publish a doc with that
  // headline row silently missing. Absence has to fail loudly here, not render.
  const violations = findContractViolations(baseline.suites);
  if (violations.length > 0) {
    console.error('Baseline does not match the frozen scenario contract:');
    for (const v of violations) console.error(`  - ${v}`);
    console.error('Re-capture with `bun run bench:baseline`, or update src/scenario-contract.ts.');
    process.exit(1);
  }

  const allowStale = args.has('--allow-stale') || process.env.FLARE_BENCH_ALLOW_STALE === '1';
  const age = ageInDays(baseline.generated);
  if (age > MAX_BASELINE_AGE_DAYS && !allowStale) {
    console.error(
      `Baseline captured ${Math.floor(age)} days ago (${baseline.generated.slice(0, 10)}), limit is ${MAX_BASELINE_AGE_DAYS}.`,
    );
    console.error('Re-capture with `bun run bench:baseline`.');
    console.error('To publish it as-is: FLARE_BENCH_ALLOW_STALE=1 bun run bench:md');
    process.exit(1);
  }
  const markdown = renderMarkdown(
    reportToGroups(baseline),
    baseline.heap.map((h) => ({
      name: h.name,
      iterations: h.iterations,
      deltaBytes: h.deltaBytes,
      bytesPerFrame: h.bytesPerFrame,
    })),
    loadDeviceReport(),
    baseline,
  );
  const target = benchmarksDocFile();
  writeFileAtomic(target, `${markdown}\n`);
  console.error(`Wrote ${target} from the ${baseline.generated.slice(0, 10)} capture.`);
  process.exit(0);
}

const groups = runAll();
const heap = integrationHeapDelta(500);
const report = buildReport(groups, heap);

if (!args.has('--no-record')) {
  console.error(`\nAppended run to ${appendHistoryRow(report)}`);
}

if (args.has('--write-baseline')) {
  console.error(`Wrote baseline ${writeMicrobenchJson(report)}`);
}

printText(groups, heap);
