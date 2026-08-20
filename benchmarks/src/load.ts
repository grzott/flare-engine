import { cpus } from 'node:os';

/**
 * Measures how much of the machine was busy with something OTHER than this
 * capture, for the window in which the timed suites ran.
 *
 * This exists because of B29. On 2026-07-29 two consecutive 5-run captures read
 * `integration.frame 1000` at 10.5 ms and 9.7 ms against 12.5 ms an hour
 * earlier, across a commit whose only executable change was one `lines.push` in
 * a markdown generator. Eight residual agent processes were resident. Both
 * captures were caught by a human reading the control row and discarded by
 * hand — nothing in the harness noticed, because provenance recorded the CPU
 * model and core count but never whether the CPU was *available*.
 *
 * Method: `os.cpus()` exposes cumulative per-core times, so differencing two
 * snapshots gives system-wide utilisation over the window. `process.cpuUsage()`
 * gives this process's own share. Foreign load is the remainder — which is the
 * number that matters, since our own saturated core is expected and a
 * neighbour's is not.
 *
 * Two honest limits, both load-bearing when reading the figure:
 *
 *   1. `process.cpuUsage()` does not include spawned children, so the window
 *      must not span the heap probes (which fork). It is taken around the timed
 *      suites only — which is also the only place measurement quality matters.
 *   2. **A process can perturb a measurement without burning CPU.** Cache and
 *      memory-bandwidth pressure from a resident-but-idle neighbour is invisible
 *      here. A low reading is therefore weak evidence of a quiet machine, while
 *      a high one is strong evidence of a noisy one. It is a smoke detector,
 *      not a proof of absence — which is why `promote` also refuses on
 *      run-to-run deviation, a symptom rather than a cause.
 */

export type CpuSnapshot = {
  /** Summed busy milliseconds across all cores (user + nice + sys + irq). */
  busyMs: number;
  /** Summed total milliseconds across all cores, including idle. */
  totalMs: number;
  /** This process's own CPU milliseconds (user + system). */
  ownMs: number;
};

export function sampleCpu(): CpuSnapshot {
  let busyMs = 0;
  let totalMs = 0;
  for (const cpu of cpus()) {
    const t = cpu.times;
    busyMs += t.user + t.nice + t.sys + t.irq;
    totalMs += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  const own = process.cpuUsage();
  return { busyMs, totalMs, ownMs: (own.user + own.system) / 1000 };
}

export type LoadWindow = {
  /** Percent of total CPU capacity consumed by other processes. */
  foreignPercent: number;
  /** Percent consumed by this process — expected to be roughly one core. */
  ownPercent: number;
  /** Wall-clock length of the measured window. */
  windowMs: number;
};

export function measureLoad(before: CpuSnapshot, after: CpuSnapshot): LoadWindow {
  const totalDelta = after.totalMs - before.totalMs;
  if (totalDelta <= 0) return { foreignPercent: 0, ownPercent: 0, windowMs: 0 };
  const busyDelta = after.busyMs - before.busyMs;
  const ownDelta = after.ownMs - before.ownMs;
  // Clamp: the two clocks are sampled independently and can disagree slightly
  // at the margins, which must not produce a negative "foreign" reading.
  const foreignDelta = Math.max(0, busyDelta - ownDelta);
  return {
    foreignPercent: (foreignDelta / totalDelta) * 100,
    ownPercent: (Math.min(ownDelta, busyDelta) / totalDelta) * 100,
    windowMs: totalDelta / Math.max(1, cpus().length),
  };
}

/**
 * Above this, a capture is not publishable.
 *
 * Calibrated against measurement, not chosen: four consecutive captures on the
 * reference machine in its ordinary working state — editor open, agent session
 * running — read 4.36, 4.38, 4.51 and 5.43 percent. That is the realistic
 * floor, not zero, because "quiet" never means an idle machine in practice.
 * The ceiling sits at roughly three times it, so a browser tab or a background
 * index cannot trip the gate; a threshold that fires on a good day is one that
 * gets raised until it never fires at all.
 *
 * **Honest limit:** this was NOT validated against the machine state that
 * produced B29 — eight resident agent processes — because that state no longer
 * exists and was never measured with this instrument. The ceiling is calibrated
 * from below (what quiet looks like) rather than from above (what the incident
 * looked like). The deviation check below is the threshold demonstrated
 * against the real event.
 */
export const MAX_FOREIGN_LOAD_PERCENT = 15;

/**
 * How far one run's median may sit from the folded median before it counts as
 * deviant.
 */
export const MAX_RUN_DEVIATION_PERCENT = 10;

export type ScenarioDeviation = {
  /** Tolerance for this row, replacing `MAX_RUN_DEVIATION_PERCENT`. */
  readonly percent: number;
  /** Why this row is less reproducible, and why that is not a machine-state straddle. */
  readonly reason: string;
};

/**
 * Rows whose run-to-run reproducibility is measurably worse than the global tolerance, listed
 * individually with the evidence. **This is a disclosure, not a silencer** — an overridden row is
 * still folded, still published, and is marked as less reproducible in the generated document.
 *
 * Adding a row here requires showing that its spread is a property of the measurement rather than
 * a state of the machine, because the global guard exists to catch the latter. The bar is the
 * investigation below, not a failing gate someone wanted to pass.
 *
 * **What is given up, stated plainly.** These rows can no longer catch a regression smaller than
 * 35% on their own. What still guards `@flare-engine/particles` is the `emit+integrate` sweep,
 * which drives the same `ParticleEmitter.update` at the strict 10% tolerance, plus the exact
 * allocation counters in `check:perf`, which are integers and fail in both directions. A real
 * regression in particle integration shows up there.
 */
const BIMODAL_INTEGRATE = (band: string, ratio: string, split: string): string =>
  `Bimodal across ${band} (${ratio}), split ${split} over the 15 pinned captures recorded on ` +
  '2026-08-20, with each state internally tight — so the folded median lands in whichever state ' +
  'that window caught, and moves between them. Read the spread column, not the median, for this ' +
  'row.';

/**
 * All four `integrate-only` rows, and only those. The scoping is the evidence: across the same 15
 * captures the three `emit+integrate` rows of the *same package* hold inside 1.12x, `ecs.step`
 * inside 1.04x. One scenario shape in one package is bimodal and its siblings are not, which is
 * what rules out the machine and points at how this particular loop is compiled.
 *
 * Investigated 2026-08-20 against five candidate causes, all refuted by measurement: these rows
 * split with the process pinned to P-cores, at every warm-up budget from 300 to 6000 ms, with
 * turbo disabled, after a forced full GC, and when one of them is the only scenario a
 * freshly-started process ever runs. Not core placement, warm-up, clock state, GC or JIT history.
 * The remaining hypothesis is per-process JIT code placement, which nothing here can control.
 */
export const SCENARIO_DEVIATION_OVERRIDES: ReadonlyMap<string, ScenarioDeviation> = new Map([
  [
    'particles.update   500 integrate-only',
    { percent: 35, reason: BIMODAL_INTEGRATE('1.70-2.10 us', '1.24x', '12 low / 3 high') },
  ],
  [
    'particles.update  1000 integrate-only',
    { percent: 35, reason: BIMODAL_INTEGRATE('3.37-4.24 us', '1.26x', '14 low / 1 high') },
  ],
  [
    'particles.update  2000 integrate-only',
    { percent: 35, reason: BIMODAL_INTEGRATE('6.73-8.85 us', '1.32x', '7 low / 8 high') },
  ],
  [
    'particles.update  5000 integrate-only',
    { percent: 35, reason: BIMODAL_INTEGRATE('16.80-21.40 us', '1.27x', '9 low / 6 high') },
  ],
]);

/** The tolerance that applies to a scenario, global unless it carries an override. */
export function deviationLimitFor(scenario: string): number {
  return SCENARIO_DEVIATION_OVERRIDES.get(scenario)?.percent ?? MAX_RUN_DEVIATION_PERCENT;
}

/**
 * How many deviant runs make a window unpublishable.
 *
 * **Two, not one — and the reason is the statistic itself.** The published
 * number is a median of per-run medians, which by construction absorbs one
 * outlier in five and reports the other four. So a single bad run is not a
 * reason to refuse: the number it produces is still right. Two is, because at
 * that point the median is being computed across genuinely different states of
 * the machine and no single value describes them.
 *
 * The first version of this check keyed on the min-max BAND instead, which is
 * maximally sensitive to exactly the case the median already handles: it
 * refused a `particles.update 1000 emit+integrate` window whose five runs read
 * 16.42 / 20.20 / 16.51 / 16.46 / 16.49 µs. Thirteen of the fifteen recorded
 * runs of that row sit inside 16.4-16.75; the row is fine and the check was
 * wrong. A gate must be robust in the same way as the number it guards, or it
 * fails on healthy data and gets deleted.
 *
 * Validated against the recorded history in both directions — it refuses B29's
 * bad capture (three of five runs deviant) and accepts every clean window,
 * including the noisy-but-sound particles rows.
 */
export const MIN_DEVIANT_RUNS = 2;
