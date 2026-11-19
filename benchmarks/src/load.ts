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
 * investigation done for the `integrate-only` rows below, not a failing gate someone wanted to
 * pass.
 *
 * **One exception: a provisional entry.** The owner may accept a row before that investigation, to
 * unblock a release, when the scoping evidence already points at the row rather than the machine.
 * Such an entry says it is provisional, names the open issue that will investigate it, and states
 * its exit condition. That issue either removes the entry or replaces "provisional" with the
 * investigation's evidence.
 *
 * Every entry also states what is given up: an overridden row cannot catch a regression smaller
 * than its own tolerance, so each says what else still guards its package.
 */
const BIMODAL_INTEGRATE = (band: string, ratio: string, split: string): string =>
  `Bimodal across ${band} (${ratio}), split ${split} over the 15 pinned captures recorded on ` +
  '2026-08-20, with each state internally tight — so the folded median lands in whichever state ' +
  'that window caught, and moves between them. Read the spread column, not the median, for this ' +
  'row.';

const CHURN_GC_STATE = (band: string, ratio: string): string =>
  `Two states set by the GC state the row starts from (#480): ${band} (${ratio}) over 18 pinned ` +
  'full-suite captures on 2026-11-19, tight when the ECS suite runs alone in a process. Read the ' +
  'spread column, not the median, for this row.';

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
 *
 * **What is given up:** these four rows cannot catch a regression smaller than 35% on their own.
 * What still guards `@flare-engine/particles` is the `emit+integrate` sweep, which drives the same
 * `ParticleEmitter.update` at the strict 10% tolerance, plus the exact allocation counters in
 * `check:perf`, which are integers and fail in both directions. A real regression in particle
 * integration shows up there.
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
  /**
   * Two of the three `animation` rows from #311. Both were accepted provisionally on 2026-11-12
   * (#362: 25 pinned captures of `a851faa9`, tweens 2.35-3.18 us, animators 6.19-7.60 us).
   * `updateSpring`, the third row, folds at the strict 10%. Each tolerance exceeds its row's
   * measured max/min ratio, so a window folds whichever state it catches.
   *
   * **`updateTweens`: investigated 2026-11-19 (#363), now evidence-backed.** Fresh pinned
   * processes on a quiet machine:
   * - Alone, the row is tight but slow: 4.22-4.48 us (1.06x).
   * - After the five suites `runAll` runs before it, it splits into two states: 2.46-2.48 or
   *   2.95-3.15 us (1.28x), matching the 2.4-3.1 us of 18 full-suite captures that day.
   * - The warm-up budget is not the cause: 300 and 3000 ms read the same.
   * - With one easing instead of four, the split disappears: 2.22-2.29 us, 1.03x.
   * - Giving every easing its own monomorphic call site (a `switch` per easing) made both states
   *   about 20% faster but did not remove the split (1.24x).
   * So the two states come from how the JIT compiles a loop that calls four different easing
   * bodies, given what the process compiled before. That is the same end point as the
   * `integrate-only` rows above.
   *
   * **`updateAnimator`: still provisional (#363).** Its 7.2-7.6 us state appeared in about 5 of
   * 18 full-suite captures on 2026-11-19, but not in 12 fresh processes (alone or after those five
   * suites: 6.48-6.70 us), so its cause is not established.
   *
   * **What is given up:** neither row can catch a regression smaller than its tolerance on its
   * own. `updateSpring` still guards the spring path of the same package at 10%. Nothing strict
   * guards tweens or animators.
   */
  [
    'animation.updateTweens    1000 tweens, 4 easings',
    {
      percent: 36,
      reason:
        'Two states set by in-process JIT history (#363): with four easings hot in one loop the ' +
        'row folds at about 2.4-2.5 or 2.9-3.1 us depending on what the process compiled before; ' +
        'with one easing it is tight. Read the spread column, not the median, for this row.',
    },
  ],
  [
    'animation.updateAnimator  1000 animators, looping',
    {
      percent: 25,
      reason:
        'Provisional (#363). Bimodal across 6.19-7.60 us (1.23x) over 25 pinned captures on ' +
        '2026-11-12: 17 runs at 6.19-6.63 us, 7 at 7.19-7.60 us and one between, each state ' +
        'internally tight. The folded median lands in whichever state that window caught. Read ' +
        'the spread column, not the median, for this row.',
    },
  ],
  /**
   * Three of the four `ecs.churn` rows (#480): they create and destroy entities every step, which
   * churns the `World`'s `Map` storage.
   *
   * **Evidence, 2026-11-19,** fresh pinned processes on a quiet machine (i9-13900KF):
   * - Run as the only suite in a process, the rows are tight: `churn 1000` 51-52 us,
   *   `churn 2000` 102-105 us, `churn 5000` 258-268 us, all within 1.04x.
   * - The same process with one `Bun.gc(true)` before the suite splits each into two states:
   *   51-54 or 69-70, 104-106 or 132-140, 258-278 or 306-311 us.
   * - In the full bench, which loads every suite module before ECS runs, the rows spread over
   *   18 captures: 50.6-67.6 us (1.34x), 82.1-109.9 us (1.34x) and 213.2-323 us (1.52x). The
   *   5000 row needed 13 runs for one 5-run window to fold at 10%.
   * ECS runs first in `runAll`, so this is not another suite's JIT history. It is the GC state the
   * row starts from, a property of the measurement and not of the machine. `churn 500` stays
   * tight (1.05x over the same 18 captures), so it keeps the strict 10%.
   *
   * Each tolerance exceeds its row's measured max/min ratio. #480 tracks the alternative, a
   * harness that starts these rows from a known state (a plain full GC is not it: it causes the
   * split), and removes these entries if that works.
   *
   * **What is given up:** these rows can't catch a regression smaller than their tolerance on
   * their own. `@flare-engine/ecs` is still guarded at the strict 10% by `churn 500` and all
   * four `ecs.step` rows, plus the exact allocation counters in `check:perf`.
   */
  [
    'ecs.churn 1000 entities, 5%/step',
    { percent: 35, reason: CHURN_GC_STATE('50.6-67.6 us', '1.34x') },
  ],
  [
    'ecs.churn 2000 entities, 5%/step',
    { percent: 35, reason: CHURN_GC_STATE('82.1-109.9 us', '1.34x') },
  ],
  [
    'ecs.churn 5000 entities, 5%/step',
    { percent: 53, reason: CHURN_GC_STATE('213.2-323 us', '1.52x') },
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
