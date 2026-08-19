import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type AllocRow, allocRows } from './alloc.js';
import { applyBenchDevFlag, assertDevFlagDefined, devFlagState } from './dev-flag.js';
import { ecsBenches } from './ecs.bench.js';
import {
  type BenchStats,
  formatStats,
  MAX_SAMPLE_WINDOW_MS,
  MIN_SAMPLE_WINDOW_MS,
} from './harness.js';
import type { HeapProbeResult } from './heap-probe.js';
import { integrationBenches } from './integration.bench.js';
import {
  type LoadWindow,
  MAX_FOREIGN_LOAD_PERCENT,
  MAX_RUN_DEVIATION_PERCENT,
  MIN_DEVIANT_RUNS,
  measureLoad,
  sampleCpu,
} from './load.js';
import { particlesBenches } from './particles.bench.js';
import { physicsBenches } from './physics.bench.js';
import { judgePowerScheme, readPowerScheme } from './power.js';
import { aggregateRuns } from './promote.js';
import { renderBenches } from './render.bench.js';
import {
  appendHistoryRow,
  benchmarksDir,
  benchmarksDocFile,
  collectProvenance,
  type DeviceReport,
  heapToResult,
  historyFile,
  type MicrobenchHeap,
  type MicrobenchReport,
  type MicrobenchResult,
  readHistory,
  readMicrobenchJson,
  resultsDir,
  SCHEMA_VERSION,
  srcDir,
  statsToResult,
  writeFileAtomic,
  writeMicrobenchJson,
} from './results.js';
import {
  findAllocViolations,
  findContractViolations,
  HEADLINE_PREFIXES,
} from './scenario-contract.js';
import { renderWebSections } from './web-sections.js';

type Group = { title: string; results: BenchStats[] };

const HEAP_SCENARIO_ENTITIES = [500, 1000, 2000] as const;

function runAll(): Group[] {
  return [
    { title: 'ECS', results: ecsBenches() },
    { title: 'Physics', results: physicsBenches() },
    { title: 'Particles', results: particlesBenches() },
    { title: 'Render', results: renderBenches() },
    { title: 'Integration', results: integrationBenches() },
  ];
}

/**
 * Each heap scenario runs in its own process. In-process measurement carried
 * ~90 s of other suites' garbage into every reading, and the sign of a delta
 * then said more about GC scheduling than about the frame being measured.
 */
function runHeapProbes(): HeapProbeResult[] {
  const probe = resolve(srcDir(), 'heap-probe.ts');
  const out: HeapProbeResult[] = [];
  for (const entities of HEAP_SCENARIO_ENTITIES) {
    const proc = Bun.spawnSync(['bun', 'run', probe, '--entities', String(entities)], {
      cwd: benchmarksDir(),
      stdout: 'pipe',
      stderr: 'inherit',
    });
    if (!proc.success) {
      console.error(`heap probe for ${entities} entities exited ${proc.exitCode} — aborting.`);
      process.exit(1);
    }
    const line = proc.stdout.toString().trim().split('\n').pop() ?? '';
    let parsed: HeapProbeResult;
    try {
      parsed = JSON.parse(line) as HeapProbeResult;
    } catch {
      console.error(`heap probe for ${entities} entities printed unparseable output: ${line}`);
      process.exit(1);
    }
    if (parsed.outOfBounds > 0) {
      console.error(
        `heap probe for ${entities} entities: ${parsed.outOfBounds} entities escaped the play field — the workload is not stationary, refusing to record.`,
      );
      process.exit(1);
    }
    if (!parsed.converged) {
      console.error(
        `warning: heap probe for ${entities} entities did not reach a plateau within its budget (${parsed.warmupFrames} warm-up frames).`,
      );
    }
    out.push(parsed);
  }
  return out;
}

function formatHeapProbe(r: HeapProbeResult): string {
  const perFrame = `${r.bytesPerFrame.toFixed(0)} B/frame`;
  return `${r.name.padEnd(34)} ${perFrame.padStart(16)}  over ${r.iterations
    .toString()
    .padStart(4)} frames after ${r.warmupFrames.toString().padStart(5)} warm-up${
    r.converged ? '' : ' (NOT CONVERGED)'
  }`;
}

function heapMdRow(r: MicrobenchHeap): string {
  const spread =
    r.bandMinBytesPerFrame === undefined || r.bandMaxBytesPerFrame === undefined
      ? '—'
      : `${r.bandMinBytesPerFrame.toFixed(0)} – ${r.bandMaxBytesPerFrame.toFixed(0)} B`;
  // Below the instrument's resolution is not "zero", and saying so costs one
  // word. Rounding a sub-noise reading to 0 B is how a heap number acquires
  // more authority than the measurement behind it.
  const delta =
    Math.abs(r.bytesPerFrame) < r.resolutionBytesPerFrame
      ? `< ±${r.resolutionBytesPerFrame.toFixed(0)} B`
      : `${r.bytesPerFrame.toFixed(0)} B`;
  return `| ${r.name} | ${r.warmupFrames} | ${r.iterations} | ${delta} | ±${r.resolutionBytesPerFrame.toFixed(0)} B | ${spread} | ${r.plateauHeapMB.toFixed(2)} MB | ${r.converged ? 'yes' : '**no**'} |`;
}

/**
 * Built from the capture rather than hard-coded: block counts and lengths are
 * scaled per scenario, and a sentence stating otherwise would contradict the
 * table printed directly beneath it.
 */
function heapMethodologySentence(capture: MicrobenchReport): string {
  const shapes = capture.heap.map((h) => `${h.blockFrames}`).join(' / ');
  const blocks = capture.heap[0]?.blocks ?? 0;
  return `Each scenario runs in its **own process**, warms up until two consecutive block deltas fall under the instrument's resolution (so the heap has reached the plateau its allocation rate implies), then reports the median per-frame delta across ${blocks} measured blocks of ${shapes} frames — block length scales with entity count so every scenario measures a comparable amount of allocation work — with forced GCs at every boundary.`;
}

function allocMdRow(r: AllocRow): string {
  const draws = [
    r.drawAtlasPerFrame > 0 ? `${r.drawAtlasPerFrame} atlas` : '',
    r.drawImageRectPerFrame > 0 ? `${r.drawImageRectPerFrame} imageRect` : '',
    r.drawRectPerFrame > 0 ? `${r.drawRectPerFrame} rect` : '',
  ]
    .filter((s) => s !== '')
    .join(' + ');
  const xforms =
    r.xformRotatedPerFrame === 0
      ? `${r.xformUnrotatedPerFrame}`
      : `${r.xformUnrotatedPerFrame} + ${r.xformRotatedPerFrame} rotated`;
  const status = r.problems.length === 0 ? 'pass' : `**${r.problems.join('; ')}**`;
  return `| ${r.scenario} | ${r.poolMisses} | ${r.cachedFactoryCalls} | ${r.perFrameFactoryCalls} | ${draws === '' ? '—' : draws} | ${xforms} | ${status} |`;
}

function printText(groups: Group[], heap: HeapProbeResult[], alloc: AllocRow[]): void {
  for (const g of groups) {
    console.log(`\n== ${g.title} ==`);
    for (const r of g.results) console.log(formatStats(r));
  }
  console.log('\n== Draw-path allocation counters (exact) ==');
  for (const r of alloc) {
    const status = r.problems.length === 0 ? 'pass' : `FAIL: ${r.problems.join('; ')}`;
    console.log(`${r.scenario.padEnd(44)}  ${status}`);
  }
  console.log('\n== Integration heap, isolated subprocess per scenario ==');
  for (const r of heap) console.log(formatHeapProbe(r));
}

/**
 * A sample window far outside the timeable band means a row's `innerIters` no
 * longer matches what the code costs — the number is still honest, but it is
 * either noisy or wasting capture time, and nothing else would ever say so.
 */
function warnOnWindowDrift(groups: Group[]): void {
  const drifted: string[] = [];
  for (const g of groups) {
    for (const r of g.results) {
      // A row already at innerIters 1 cannot be tuned down: one frame of a
      // 2000-entity scene costs what it costs, and warning about it every
      // capture would train the reader to ignore the warning that matters.
      const tooSlow = r.sampleWindowMs > MAX_SAMPLE_WINDOW_MS && r.innerIters > 1;
      if (r.sampleWindowMs < MIN_SAMPLE_WINDOW_MS || tooSlow) {
        drifted.push(
          `  ${r.name}: ${r.sampleWindowMs.toFixed(2)} ms/sample (innerIters ${r.innerIters})`,
        );
      }
    }
  }
  if (drifted.length > 0) {
    console.error(
      `\nwarning: ${drifted.length} row(s) outside the ${MIN_SAMPLE_WINDOW_MS}–${MAX_SAMPLE_WINDOW_MS} ms sample window — retune innerIters:`,
    );
    for (const line of drifted) console.error(line);
  }
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

function fmtSpread(r: MicrobenchResult): string {
  if (r.bandMinNs === undefined || r.bandMaxNs === undefined) return '—';
  return `${fmtUs(r.bandMinNs)} – ${fmtUs(r.bandMaxNs)}`;
}

function resultRow(r: MicrobenchResult): string {
  const ops =
    r.opsPerSec >= 1e6
      ? `${(r.opsPerSec / 1e6).toFixed(2)}M`
      : r.opsPerSec >= 1e3
        ? `${(r.opsPerSec / 1e3).toFixed(1)}K`
        : r.opsPerSec.toFixed(0);
  const p99 = r.p99Ns === undefined ? '—' : `${(r.p99Ns / 1000).toFixed(1)} µs`;
  const max = r.maxNs === undefined ? '—' : `${(r.maxNs / 1000).toFixed(1)} µs`;
  return `| ${r.scenario} | ${fmtUs(r.medianNs)} | ${fmtSpread(r)} | ${ops}/s | ${p99} | ${max} |`;
}

function findScenario(capture: MicrobenchReport, prefix: string): MicrobenchResult | null {
  for (const suite of capture.suites) {
    for (const r of suite.results) {
      if (r.scenario.startsWith(prefix)) return r;
    }
  }
  return null;
}

function renderMarkdown(device: DeviceReport | null, capture: MicrobenchReport): string {
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
  const runsNote = capture.runs === undefined ? 'single run' : `median of ${capture.runs} runs`;

  const lines: string[] = [];
  lines.push(
    '<!-- Generated by benchmarks/src/index.ts — do not edit by hand; run `bun run bench:md`. -->',
  );
  // Machine-readable provenance for check:perf-freshness. Without it the canary
  // guards the baseline but never the DOC, so a capture + promote that skipped
  // `bench:md` leaves the published page showing the previous commit's numbers
  // while every gate reports green.
  lines.push(`<!-- flare-capture: ${capture.gitSha ?? 'unrecorded'} -->`);
  lines.push('# Flare Engine — Benchmarks');
  lines.push('');
  // Machine load belongs beside the CPU model, not buried: a number captured on
  // a contended machine is not comparable with one that was not, and the reader
  // cannot tell from the figure itself (B29).
  const load =
    capture.foreignLoadPercent === undefined
      ? 'Load: unrecorded'
      : `Foreign load: ${capture.foreignLoadPercent.toFixed(1)}%`;
  lines.push(
    `> **Captured: ${captured}** (${runsNote}) · Rendered: ${rendered} · Runtime: ${capture.runtime} · Platform: ${capture.platform} · ${cpu} · ${load} · ${commit}`,
  );
  lines.push('');
  lines.push(
    '> Every number below comes from the committed baseline captured on the date above — not from the day this page was rendered. Re-capture with `bun run bench` ×N then `bun run bench:promote`, and re-render with `bun run bench:md`.',
  );
  lines.push('');

  // Headline numbers
  const ecsK = findScenario(capture, HEADLINE_PREFIXES.ecs);
  const partK = findScenario(capture, HEADLINE_PREFIXES.particles);
  const renderK = findScenario(capture, HEADLINE_PREFIXES.render);
  const integ1k = findScenario(capture, HEADLINE_PREFIXES.integration);
  lines.push('## Headline numbers');
  lines.push('');
  lines.push(`_Captured: ${captured}_`);
  lines.push('');
  lines.push('| Metric | Value | Spread across runs |');
  lines.push('|---|---:|---:|');
  if (ecsK)
    lines.push(
      `| ECS step, 1000 entities (Pos+Vel) | **${fmtUs(ecsK.medianNs)}** / frame | ${fmtSpread(ecsK)} |`,
    );
  if (partK)
    lines.push(
      `| Particles integrate, 1000 alive | **${fmtUs(partK.medianNs)}** / frame | ${fmtSpread(partK)} |`,
    );
  if (renderK)
    lines.push(
      `| Render flush + transform, 1000 sprites / 1 atlas | **${fmtUs(renderK.medianNs)}** / frame | ${fmtSpread(renderK)} |`,
    );
  if (integ1k)
    lines.push(
      `| Integration frame, 1000 entities + 300 particles | **${fmtUs(integ1k.medianNs)}** / frame | ${fmtSpread(integ1k)} |`,
    );
  if (device && device.devices.length > 0) {
    for (const d of device.devices) {
      for (const load of d.loads) {
        const s = deviceFpsStats(load.fps);
        lines.push(
          `| ${d.device} · ${load.label} _(${device.generated}, stale)_ | **${s.avg.toFixed(
            0,
          )} fps avg** (min ${s.min}, max ${s.max}) | — |`,
        );
      }
    }
  } else {
    lines.push('| Device FPS | _pending capture — see [Device](#device) section_ | — |');
  }
  lines.push('');

  lines.push('## Methodology');
  lines.push('');
  lines.push(
    'Off-device microbenchmarks exercise engine hot paths under Bun on the developer machine — pure algorithmic cost, no Skia rasterization, no React Native bridge, no device I/O. Their value is regression detection and order-of-magnitude sizing; they do **not** predict on-device frame times. For real frame times see the [Device](#device) section.',
  );
  lines.push('');
  lines.push(
    'Each capture run warms a scenario for a fixed time budget (not a fixed batch count, which warms a cheap scenario for microseconds and an expensive one for seconds, measuring the two at different JIT tiers), then times N inner iterations per sample and reports that run\'s median. A baseline folds several independent runs together: the published cost is the median of those per-run medians, and "Spread across runs" is their lowest and highest.',
  );
  lines.push('');
  lines.push(
    'The **p99** column is populated only for rows captured with at least 100 samples. Below that a "99th percentile" is just the worst sample wearing a statistical name, so those rows show `—` and the **max** column carries the tail instead.',
  );
  lines.push('');
  lines.push(
    `Captured with \`__DEV__ === ${capture.devFlag ?? 'unrecorded'}\` — the React Native release configuration, and the state the diagnostic counters' "cost only when armed" design assumes. It is recorded because it used to be load-bearing: until 2026-07-29 the engine read the dev flag as a bare \`__DEV__\` identifier behind a \`typeof\` guard, and JSC has no inline cache for an unresolvable global, so a capture taken with the flag *undeclared* read ~7x high on every render row and was measuring a JSC deoptimisation rather than the engine. The hot sites now read a \`globalThis\` property instead, so the configuration no longer changes the result — but a capture that cannot say which configuration it ran under still cannot be compared with one that can.`,
  );
  lines.push('');
  lines.push(
    'Frame budget at 60 fps is 16.67 ms. A system taking 1 ms per step leaves 15+ ms for the rest of the frame.',
  );
  lines.push('');
  lines.push(
    'Treat a change smaller than the run-to-run spread as noise.  The render and integration suites drive the real `createFrameRenderer` pipeline against a counting Skia stub, so per-sprite transform construction — including the rotation branch — is inside the measured region.',
  );
  lines.push('');

  lines.push('## What these numbers do not measure');
  lines.push('');
  lines.push(
    '- **No Skia rasterization, no GPU, no bridge, no device.** The draw path runs to the point where the engine hands a batch to Skia; what Skia then does with it is not measured here, and these are pure JS costs under Bun on one desktop machine.',
  );
  lines.push(
    '- **Web/CanvasKit numbers exist in three lanes: CPU-raster, desktop GPU, and an on-device Android GPU lane.** See [Web (CanvasKit)](#web-canvaskit). Both GPU-backed lanes measure **CPU-side submission cost**, not GPU execution time — WebGL/CanvasKit calls queue work and return, and reading true GPU time from page script is not available to this harness. Every web figure published before 2026-08-18 was quantized to the display refresh interval and must not be cited.',
  );
  lines.push(
    '- **The ECS suite is deliberately unbounded.** Its entities integrate off the field forever, because nothing in `world.step` branches on position and holding that suite byte-identical across the 2026-07 rework keeps it usable as the control row that made the render regression conclusive. The physics and integration suites wrap at the field edge instead, and a probe fails the capture if any entity escapes.',
  );
  lines.push(
    '- **Heap figures are a footprint proxy, not a retention measurement.** See the heap section.',
  );
  lines.push(
    '- **Correction, 2026-08-19: every node figure published before this date was ~2.5x too slow.** The capture machine was running the Windows "Power saver" plan. Re-capturing the identical commit under "High performance" made **all 38 scenarios faster by 2.42x-2.58x, median 2.49x** - a band that tight across ECS, physics, particles, render and integration is a clock-rate effect, not a code one. Nothing in the harness could see it: the machine was quiet, so the load guard passed, and the spread guard passed whenever five runs happened to land in one clock state. Captures now record the active power plan in their provenance, and `bench:promote` refuses a window taken under Power saver. Balanced is warned about rather than refused - its effect has never been measured here.',
  );
  lines.push(
    `- **Every number here was captured on a machine that was ${capture.foreignLoadPercent === undefined ? 'not measured for' : `${capture.foreignLoadPercent.toFixed(1)}% busy with`} other work.** \`bench:promote\` refuses a window above ${MAX_FOREIGN_LOAD_PERCENT}% foreign load, or one where ${MIN_DEVIANT_RUNS} or more runs sit further than ${MAX_RUN_DEVIATION_PERCENT}% from the folded median. Both exist because two captures taken beside a fleet of agent processes once read a headline row 23% low, and nothing but a human noticed (B29).`,
  );
  lines.push(
    `- **The table cannot show the 2026-07-29 dev-flag fix, because the bench has always declared \`__DEV__\`.** Until that date the engine read the flag as a bare identifier behind a \`typeof\` guard, once per sprite per transform pass. Under **JSC** — Bun, and Safari/iOS WebKit — an unresolvable global costs ~270 ns per evaluation, so a consumer who never defines \`__DEV__\` was paying it: \`render.flush 1000 / 1 atlas\` measured 412-450 µs in that configuration against 56-88 µs after the fix, the same band the declared configuration occupies. React Native always defines the flag and was never affected. **V8 (Node, Chrome) and SpiderMonkey were never measured** — the ~270 ns figure is JSC-only and must not be read as a cross-engine claim.`,
  );
  lines.push('');

  lines.push('## Suites');
  lines.push('');

  for (const suite of capture.suites) {
    lines.push(`### ${suite.title}`);
    lines.push('');
    lines.push(`_Captured: ${captured}_`);
    lines.push('');
    lines.push(
      '| Scenario | Cost / op (median) | Spread across runs | Ops / sec | p99 sample | max sample |',
    );
    lines.push('|---|---:|---:|---:|---:|---:|');
    for (const r of suite.results) lines.push(resultRow(r));
    lines.push('');
  }

  lines.push('## Draw-path allocation counters');
  lines.push('');
  lines.push(
    'Exact integers, not timings: every row runs the real frame renderer against an injected Skia stub that counts each object it is asked to build, and reads the engine\'s own pool counters. In steady state the sprite-command pool must miss zero times, the particle pool must call its factory zero times, and the renderer must ask Skia for zero new objects — every rect, transform and paint it needs is already pooled. "Skia calls / frame" counts the calls the renderer repeats every frame **by design** (a colour filter or shader is rebuilt per draw call); those are a property of the effect, not a leak.',
  );
  lines.push('');
  lines.push(
    'These counters cannot see allocations that pass through neither a pool nor the injected factory — the cached slices in `frame-renderer.ts` are the known example — which is why the isolated heap probe below stays as the whole-heap backstop.',
  );
  lines.push('');
  lines.push(`_Captured: ${captured}_`);
  lines.push('');
  lines.push(
    '| Scenario | Pool misses | Cached Skia factory calls | Skia calls / frame | Draw calls / frame | Transform writes / frame | Gate |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---|');
  for (const r of capture.alloc ?? []) lines.push(allocMdRow(r));
  if ((capture.alloc ?? []).length === 0) {
    lines.push('| _no counters in this capture_ | — | — | — | — | — | — |');
  }
  lines.push('');

  lines.push('## Integration heap');
  lines.push('');
  lines.push(heapMethodologySentence(capture));
  lines.push('');
  lines.push(
    'Read this as an allocation-pressure proxy, not as retention. Under JSC `process.memoryUsage().heapUsed` reports MarkedSpace block footprint rather than live bytes, so it moves with GC scheduling and with how far the heap has climbed toward its plateau. The previous instrument measured 30 warm-up frames and one forced GC in a process that had already run every other suite, and published the resulting climb as "+15.7 / +33.4 / +31.1 KB per frame retained growth"; re-measured after a full warm-up the same scenarios read between -0.2 and +2.5 KB/frame, with every structural counter flat. Retention claims belong to the exact counters above.',
  );
  lines.push('');
  lines.push(`_Captured: ${captured}_`);
  lines.push('');
  lines.push(
    '| Scenario | Warm-up frames | Measured frames | Δ heap / frame | Resolution | Spread across runs | Plateau heap | Converged |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|');
  for (const r of capture.heap) lines.push(heapMdRow(r));
  lines.push('');

  lines.push('## Device');
  lines.push('');
  if (device && device.devices.length > 0) {
    lines.push(
      device.stale
        ? `> **Stale — captured ${device.generated}, and not re-capturable.** ${device.staleReason ?? ''} Kept as a historical datapoint only.`
        : `> Captured ${device.generated}.`,
    );
    lines.push('');
    lines.push(
      'On-device FPS samples captured from a device benchmark scene. Each sample = one second; load levels spawn fixed entity/particle counts.',
    );
    lines.push('');
    lines.push(`_Captured: ${device.generated}${device.stale ? ' — stale' : ''}_`);
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
      'No device samples. Engine-owned device measurement is not built yet — it is tracked in [the perf plan](../plans/perf-measurement-2026-07.md) §11.7. The historical capture pipeline (a bench scene in a game app, copied out of logcat by hand) no longer exists, so there is no procedure to run here today.',
    );
    lines.push('');
  }

  renderWebSections(lines);

  lines.push('## Notes on interpretation');
  lines.push('');
  lines.push(
    '- **ECS** — "op" is one `world.step(dt)` running the move system over all entities. Per-entity cost = `cost / entities`.',
  );
  lines.push(
    '- **Physics** — "op" is one frame: move every collider (wrapping at the field edge) + `world.step()`. "dense" packs colliders into a 500×500 area (many overlaps); "sparse" uses 2000×2000 (few). Density is now held constant for the whole sample window.',
  );
  lines.push(
    '- **Particles** — "integrate-only" holds N particles alive and calls `update(dt)` — measures pool integration cost. "emit+integrate" runs a saturated emitter at 2× cap/s with gravity.',
  );
  lines.push(
    '- **Render** — `flush` queues N sprite commands, groups them into batch runs, and drives the real frame renderer: per-sprite source rects and RSXform transforms are built, then handed to a counting draw surface. `interleaved` alternates textures per sprite so every run is length 1 (worst case); `clustered` groups by texture so the run count equals the atlas count. `outline` costs nine transform passes per command by construction. `sort` measures `sortByDrawOrder` on a nearly-sorted list with K random swaps (insertion sort is O(n+k²) after k swaps).',
  );
  lines.push(
    '- **Integration** — one frame = `world.step` + per-entity `coll.setPosition` + `coll.step` + `emitter.update` + sprite draw queue + `sortByDrawOrder` + `batch.flush` through the frame renderer + `endFrame`. Steady state: 300 particles + N entities (Pos+Vel + AABB collider + sprite), wrapping at the field edge so contact density does not decay while being measured. Closer shape match to a real demo frame than per-system microbenches.',
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

function buildReport(
  groups: Group[],
  heap: HeapProbeResult[],
  alloc: AllocRow[],
  load: LoadWindow,
): MicrobenchReport {
  return {
    schemaVersion: SCHEMA_VERSION,
    generated: new Date().toISOString(),
    runtime: `Bun ${Bun.version}`,
    platform: `${process.platform} ${process.arch}`,
    devFlag: devFlagState(),
    ...collectProvenance(),
    foreignLoadPercent: Number(load.foreignPercent.toFixed(2)),
    suites: groups.map((g) => ({
      title: g.title,
      results: g.results.map(statsToResult),
    })),
    heap: heap.map(heapToResult),
    alloc,
  };
}

const MAX_BASELINE_AGE_DAYS = 30;
const DEFAULT_PROMOTE_RUNS = 5;

function ageInDays(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / 86_400_000;
}

const argv = process.argv.slice(2);
const args = new Set(argv);

function numericArg(flag: string, fallback: number): number {
  const idx = argv.indexOf(flag);
  if (idx === -1) return fallback;
  const parsed = Number.parseInt(argv[idx + 1] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Folds the last N capture runs into the committed baseline. Separate from
// capturing so the runs stay independent processes: five passes inside one
// process would share a warmed JIT and an accumulating heap, and the spread
// would understate reality.
if (args.has('--promote')) {
  const wanted = numericArg('--runs', DEFAULT_PROMOTE_RUNS);
  const { rows, malformed } = readHistory();
  if (malformed > 0) {
    console.error(
      `${historyFile()} has ${malformed} unparseable line(s) — refusing to promote from a damaged log.`,
    );
    process.exit(1);
  }
  if (rows.length < wanted) {
    console.error(
      `Need ${wanted} runs to promote, history has ${rows.length}. Capture more with \`bun run bench\`.`,
    );
    process.exit(1);
  }
  const selected = rows.slice(-wanted);
  const outcome = aggregateRuns(selected);
  if (!outcome.ok) {
    console.error(`Refusing to promote ${wanted} runs:`);
    for (const problem of outcome.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  const file = writeMicrobenchJson(outcome.report);
  console.error(`Promoted ${wanted} runs to ${file}`);
  for (const suite of outcome.report.suites) {
    for (const r of suite.results) {
      console.error(
        `  ${r.scenario.padEnd(44)} ${fmtUs(r.medianNs).padStart(10)}  ${fmtSpread(r)}`,
      );
    }
  }
  process.exit(0);
}

// `--markdown` publishes the committed baseline; it never runs the suites. One
// captured number therefore backs both the doc and the dashboard, and no render
// path can stamp today's date on an older capture.
if (args.has('--markdown')) {
  const baseline = readMicrobenchJson();
  if (baseline === null) {
    console.error(
      `No readable baseline at ${resolve(resultsDir(), 'microbench.json')} (missing or unparseable). Capture one: bun run bench x5, then bun run bench:promote`,
    );
    process.exit(1);
  }
  if (typeof baseline.generated !== 'string' || Number.isNaN(Date.parse(baseline.generated))) {
    console.error(
      'Baseline has no usable "generated" timestamp — it cannot be dated honestly. Re-capture: `bun run bench` x5 then `bun run bench:promote`.',
    );
    process.exit(1);
  }
  if ((baseline.schemaVersion ?? 1) !== SCHEMA_VERSION) {
    console.error(
      `Baseline was captured under result schema v${baseline.schemaVersion ?? 1}; this build renders v${SCHEMA_VERSION}. Re-capture: \`bun run bench\` x5 then \`bun run bench:promote\`.`,
    );
    process.exit(1);
  }

  // A baseline captured before a scenario rename would publish a doc with that
  // headline row silently missing. Absence has to fail loudly here, not render.
  const violations = [
    ...findContractViolations(baseline.suites),
    ...findAllocViolations(baseline.alloc ?? []),
  ];
  if (violations.length > 0) {
    console.error('Baseline does not match the frozen scenario contract:');
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      'Re-capture (`bun run bench` x5 then `bun run bench:promote`), or update src/scenario-contract.ts.',
    );
    process.exit(1);
  }

  const failedGates = (baseline.alloc ?? []).filter((r) => r.problems.length > 0);
  if (failedGates.length > 0) {
    console.error('Baseline carries failing allocation gates — refusing to publish it as fact:');
    for (const r of failedGates) console.error(`  - ${r.scenario}: ${r.problems.join('; ')}`);
    process.exit(1);
  }

  // A heap row that never plateaued is the climb toward the plateau — the exact
  // artifact this instrument replaced. It gets the same refusal as a failing
  // alloc gate rather than a footnote in a table column.
  const unconverged = baseline.heap.filter((h) => h.converged === false);
  if (unconverged.length > 0) {
    console.error('Baseline carries heap rows that never reached a plateau — refusing to publish:');
    for (const h of unconverged) {
      console.error(`  - ${h.name}: ${h.warmupFrames} warm-up frames, still climbing`);
    }
    console.error('Re-capture with a larger warm-up budget: bun run bench --warmup-ms <ms>.');
    process.exit(1);
  }

  if (baseline.devFlag === 'undeclared') {
    console.error(
      'Baseline was captured with __DEV__ undeclared — its render rows measure a JSC unresolvable-global penalty (~270 ns per guarded evaluation), not the engine. Re-capture.',
    );
    process.exit(1);
  }

  const allowStale = args.has('--allow-stale') || process.env.FLARE_BENCH_ALLOW_STALE === '1';
  const age = ageInDays(baseline.generated);
  if (age > MAX_BASELINE_AGE_DAYS && !allowStale) {
    console.error(
      `Baseline captured ${Math.floor(age)} days ago (${baseline.generated.slice(0, 10)}), limit is ${MAX_BASELINE_AGE_DAYS}.`,
    );
    console.error('Re-capture: `bun run bench` x5 then `bun run bench:promote`.');
    console.error('To publish it as-is, set FLARE_BENCH_ALLOW_STALE=1 and re-run bun run bench:md');
    console.error('  PowerShell: $env:FLARE_BENCH_ALLOW_STALE=1; bun run bench:md');
    process.exit(1);
  }
  const markdown = renderMarkdown(loadDeviceReport(), baseline);
  const target = benchmarksDocFile();
  writeFileAtomic(target, `${markdown}\n`);
  console.error(`Wrote ${target} from the ${baseline.generated.slice(0, 10)} capture.`);
  process.exit(0);
}

// Pinned before the first measurement: an undeclared __DEV__ turns every
// guarded counter site into a ~270 ns unresolvable-global lookup (see
// dev-flag.ts), which this suite would then report as engine cost.
applyBenchDevFlag();
assertDevFlagDefined();

// The load window brackets the timed suites and nothing else: the heap probes
// fork children, whose CPU `process.cpuUsage()` cannot see and would therefore
// misreport as a noisy neighbour (load.ts).
const cpuBefore = sampleCpu();
const groups = runAll();
const load = measureLoad(cpuBefore, sampleCpu());
// Counters and heap run after the timed suites: the allocation gate arms
// __DEV__ (which turns on the pool's debug live-set) and the heap probes fork
// processes, neither of which may touch a timing measurement.
const alloc = allocRows();
const heap = runHeapProbes();
const report = buildReport(groups, heap, alloc, load);

const powerVerdict = judgePowerScheme(readPowerScheme());
if (powerVerdict.kind !== 'ok') {
  // Same shape as the foreign-load guard below: warn here, refuse at promote. The capture is
  // still appended to history as evidence of the condition it was taken under.
  console.error(
    `\n${powerVerdict.kind === 'refuse' ? 'WARNING' : 'NOTE'}: ${powerVerdict.message}\n`,
  );
}

if (load.foreignPercent > MAX_FOREIGN_LOAD_PERCENT) {
  console.error(
    `
WARNING: ${load.foreignPercent.toFixed(1)}% of this machine was busy with other ` +
      `processes while the suites ran (ceiling ${MAX_FOREIGN_LOAD_PERCENT}%). The run is still ` +
      'appended to the history log as evidence, but `bench:promote` will refuse to publish it. ' +
      'Close what else is running and re-capture.',
  );
}

const noRecord = args.has('--no-record') || process.env.FLARE_BENCH_NO_RECORD === '1';

if (!noRecord) {
  console.error(`\nAppended run to ${appendHistoryRow(report)}`);
}

printText(groups, heap, alloc);
warnOnWindowDrift(groups);

const gateFailures = alloc.filter((r) => r.problems.length > 0);

// Ordered deliberately: the run is always appended to the history log (a failed
// run is evidence), but the protected baseline is only overwritten once the
// gate has passed. Writing first and exiting 1 afterwards would leave the
// comparison reference replaced by the very run that failed it.
if (args.has('--write-baseline')) {
  if (gateFailures.length > 0) {
    console.error('Allocation gate failed — refusing to overwrite the baseline.');
  } else if (load.foreignPercent > MAX_FOREIGN_LOAD_PERCENT) {
    console.error(
      `Machine was ${load.foreignPercent.toFixed(1)}% busy with other processes — refusing to ` +
        'overwrite the baseline with a contended capture.',
    );
  } else {
    console.error(`Wrote baseline ${writeMicrobenchJson(report)}`);
  }
}

if (gateFailures.length > 0) {
  console.error(`\n${gateFailures.length} allocation gate(s) FAILED — see the section above.`);
  process.exit(1);
}
