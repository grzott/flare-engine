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
 *      run-to-run spread, a symptom rather than a cause.
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
 * looked like). MAX_SPREAD_PERCENT is the threshold demonstrated against the
 * real event.
 */
export const MAX_FOREIGN_LOAD_PERCENT = 15;

/**
 * Above this run-to-run spread, a window is too unstable to publish, whatever
 * the load reading says.
 *
 * Calibrated from both ends against recorded data. The worst legitimate row in
 * the published baseline is `physics.step 100 AABB sparse` at 9.4% — the short,
 * fast scenarios are inherently noisier — so the ceiling sits at roughly twice
 * that. B29's first bad capture had `integration.frame 1000` ranging
 * 9.16-12.78 ms across five runs, a 34% spread, which this refuses; the test
 * suite pins that case against the real recorded medians.
 *
 * It catches the symptom rather than the cause, so it works even when a
 * neighbouring process perturbs caches without burning CPU. It does not catch a
 * window that is internally tight but sitting at the wrong level, which is what
 * B29's *second* bad capture looked like — that is the load reading's job.
 * Neither check subsumes the other.
 */
export const MAX_SPREAD_PERCENT = 20;
