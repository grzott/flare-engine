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
  type DeviceReport,
  type MicrobenchReport,
  heapToResult,
  resultsDir,
  statsToResult,
  writeMicrobenchJson,
} from './results.js';

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

function printMarkdown(
  groups: Group[],
  heap: HeapDeltaResult[],
  device: DeviceReport | null,
): void {
  const runtime = `Bun ${Bun.version}`;
  const platform = `${process.platform} ${process.arch}`;
  const date = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push('# Flare Engine — Benchmarks');
  lines.push('');
  lines.push(
    `> Generated: ${date} · Runtime: ${runtime} · Platform: ${platform}. Regenerate: \`bun run bench:md\` (re-runs microbenches, ~60s) or \`bun run bench:md:cache\` (device-only update from cached JSON).`,
  );
  lines.push('');

  // Headline numbers
  const ecsK = findResult(groups, 'ecs.step  1000');
  const partK = findResult(groups, 'particles.update  1000 integrate');
  const renderK = findResult(groups, 'render.flush   1000 sprites / 1 atlas');
  const integ1k = findResult(groups, 'integration.frame  1000');
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
    'Each row reports the median of 30 samples, where each sample times N inner iterations of the hot path. "p99" is the 99th-percentile sample latency across those 30 samples.',
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
    'Heap growth across N steady-state frames after warmup, measured `process.memoryUsage().heapUsed` deltas around forced GCs. Numbers near zero indicate zero-alloc steady state (modulo bookkeeping noise). Negative values just mean the GC reclaimed warmup garbage.',
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
  lines.push('## Gating Phase 10 (C++ acceleration)');
  lines.push('');
  lines.push(
    'Per [build-plan.md](../plans/build-plan.md), C++ acceleration is only started for subsystems where these benchmarks (plus on-device measurements from the demo game) show a concrete bottleneck. Priority order from [native-acceleration.md](../design/native-acceleration.md) remains: particles → ECS hot loop → spatial hash → physics. Numbers above are the JS baseline against which any C++ port must demonstrate speedup.',
  );
  lines.push('');
  lines.push('### Decision — 2026-04-22');
  lines.push('');
  lines.push(
    'First device capture (Samsung Galaxy A54 5G, Android 16, release): light (60 entities) 120 fps, medium (180 entities) ~117 fps, heavy (350 entities) ~48 fps. The cliff between medium and heavy maps to the physics microbench: `CollisionWorld.step` is O(n·log n) broadphase + O(k) resolution, and the heavy load crosses the 500-AABB threshold where Bun measures ~2 ms/step (≈12 ms/step extrapolated under Hermes on ARM). That single call consumes most of a 16.6 ms budget at 350 colliders, confirming physics as the primary bottleneck at demo-scale loads — matching the `<1000 dynamic entities` guidance in the physics package.',
  );
  lines.push('');
  lines.push(
    '**Outcome:** Phase 10 stays deferred until a second device (iOS) confirms the same cliff and a realistic target game needs >200 colliders. Demo at typical gameplay loads (≤150 colliders) comfortably holds 120 fps on mid-range Android, so the launch does not require a native port. If a future consumer hits the ceiling, the data points to physics broadphase (spatial hash) as the first C++ target, not particles.',
  );
  lines.push('');

  console.log(lines.join('\n'));
}

function buildReport(groups: Group[], heap: HeapDeltaResult[]): MicrobenchReport {
  return {
    generated: new Date().toISOString(),
    runtime: `Bun ${Bun.version}`,
    platform: `${process.platform} ${process.arch}`,
    suites: groups.map((g) => ({
      title: g.title,
      results: g.results.map(statsToResult),
    })),
    heap: heap.map(heapToResult),
  };
}

const args = new Set(process.argv.slice(2));

if (args.has('--from-cache')) {
  // Render markdown from cached microbench.json + device.json.
  // Use this after updating device.json without re-running microbenches.
  const microFile = resolve(resultsDir(), 'microbench.json');
  const raw = readFileSync(microFile, 'utf8');
  const cached = JSON.parse(raw) as MicrobenchReport;
  const cachedGroups: Group[] = cached.suites.map((s) => ({
    title: s.title,
    results: s.results.map(
      (r): BenchStats => ({
        name: r.scenario,
        innerIters: r.innerIters,
        samples: r.samples,
        nsPerOp: {
          min: r.minNs,
          median: r.medianNs,
          mean: r.meanNs,
          p99: r.p99Ns,
        },
        opsPerSec: r.opsPerSec,
      }),
    ),
  }));
  const cachedHeap: HeapDeltaResult[] = cached.heap.map((h) => ({
    name: h.name,
    iterations: h.iterations,
    deltaBytes: h.deltaBytes,
    bytesPerFrame: h.bytesPerFrame,
  }));
  const device = loadDeviceReport();
  printMarkdown(cachedGroups, cachedHeap, device);
  process.exit(0);
}

const groups = runAll();
const heap = integrationHeapDelta(500);

if (!args.has('--no-json')) {
  const report = buildReport(groups, heap);
  const file = writeMicrobenchJson(report);
  if (!args.has('--markdown')) {
    console.error(`\nWrote ${file}`);
  }
}

if (args.has('--markdown')) {
  const device = loadDeviceReport();
  printMarkdown(groups, heap, device);
} else {
  printText(groups, heap);
}
