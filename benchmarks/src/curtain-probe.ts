import { applyBenchDevFlag, assertDevFlagDefined } from './dev-flag.js';
import { type BenchStats, SMOKE_OVERRIDES } from './harness.js';
import { physicsCurtainBenches } from './physics.bench.js';
import { PHYSICS_CURTAIN_SCENARIOS } from './scenarios/index.js';

/**
 * The `PhysicsCurtain` suite, measured in a fresh process of its own (#617).
 *
 * In-process, the `step` row's cost was set by what other suites had fed `CollisionWorld.step`
 * first. Every world in a process shares one compiled `step`, and Integration's moving bodies
 * left it compiled for a different load. Pinned fresh processes on 2026-11-27 (i9-13900KF):
 * - Alone, `step` read 65.7-72.2 us.
 * - After the suites `runAll` runs before it, it read 47.8-63.4 us, in two states.
 * - After only Integration it read 52.6-57.7 us.
 * - After only Integration's collision load, with no ECS, particles or render, it read
 *   53.6-60.7 us.
 * - A forced GC, loading every suite module and a 3000 ms warm-up each left it where alone
 *   put it.
 * So the row described the suite order, not the curtain. Alone it holds the strict 10%, and it
 * reads what a game with one `CollisionWorld` pays.
 */
export type CurtainProbeOutput = {
  readonly results: BenchStats[];
  /** This process's own CPU milliseconds, which the parent's load window cannot see. */
  readonly cpuMs: number;
};

/**
 * Parses the child's last stdout line. Returns a message instead of throwing, so the caller
 * names the probe in its refusal. A capture must not record a suite the probe did not measure.
 */
export function parseCurtainProbeOutput(stdout: string): CurtainProbeOutput | string {
  const line = stdout.trim().split('\n').pop() ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return `printed unparseable output: ${line}`;
  }
  if (typeof parsed !== 'object' || parsed === null) return `printed a non-object: ${line}`;
  const { results, cpuMs } = parsed as { results?: unknown; cpuMs?: unknown };
  if (typeof cpuMs !== 'number' || !Number.isFinite(cpuMs) || cpuMs < 0) {
    return `reported no usable cpuMs: ${String(cpuMs)}`;
  }
  if (!Array.isArray(results) || results.length !== PHYSICS_CURTAIN_SCENARIOS.length) {
    return `reported ${Array.isArray(results) ? results.length : 'no'} rows, expected ${PHYSICS_CURTAIN_SCENARIOS.length}`;
  }
  for (const [i, scenario] of PHYSICS_CURTAIN_SCENARIOS.entries()) {
    const row = results[i] as { name?: unknown; nsPerOp?: { median?: unknown } } | undefined;
    if (row?.name !== scenario.name) {
      return `row ${i} is "${String(row?.name)}", expected "${scenario.name}"`;
    }
    const median = row.nsPerOp?.median;
    if (typeof median !== 'number' || !Number.isFinite(median) || median <= 0) {
      return `row "${scenario.name}" has no positive median`;
    }
  }
  return { results: results as BenchStats[], cpuMs };
}

// CLI form: one JSON line on stdout, no file writes. `index.ts` spawns this; nothing else may,
// except the test that runs it with `--smoke`, whose timings are not comparable to a capture.
if (import.meta.main) {
  applyBenchDevFlag();
  assertDevFlagDefined();
  const smoke = process.argv.includes('--smoke');
  const results = physicsCurtainBenches(smoke ? SMOKE_OVERRIDES : undefined);
  const own = process.cpuUsage();
  const output: CurtainProbeOutput = { results, cpuMs: (own.user + own.system) / 1000 };
  console.log(JSON.stringify(output));
}
