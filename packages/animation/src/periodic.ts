import { type EasingFn, easeInOutSine } from '@flare-engine/math';

/** Oscillating tween that ping-pongs between `from` and `to` indefinitely. */
export interface PeriodicTween {
  /** Start value. */
  readonly from: number;
  /** End value. */
  readonly to: number;
  /** Full cycle period in seconds (from → to → from). */
  readonly period: number;
  /** Easing function (default: easeInOutSine). */
  readonly easing: EasingFn;
  /** Elapsed time in seconds — mutable, advanced by updatePeriodicTween. */
  elapsed: number;
  /** Current interpolated value — written by updatePeriodicTween. */
  value: number;
}

/**
 * Create a periodic oscillating tween.
 *
 * @param from  Start value.
 * @param to    End value.
 * @param period Full cycle duration in seconds (must be > 0).
 * @param easing Easing function. Defaults to easeInOutSine.
 */
export function periodicTween(
  from: number,
  to: number,
  period: number,
  easing: EasingFn = easeInOutSine,
): PeriodicTween {
  if (period <= 0) throw new Error('periodicTween: period must be > 0');
  return { from, to, period, easing, elapsed: 0, value: from };
}

/**
 * Advance a periodic tween by `dt` seconds. Wraps elapsed modulo period,
 * computes ping-pong t, applies easing, writes `value`, returns it.
 */
export function updatePeriodicTween(tw: PeriodicTween, dt: number): number {
  tw.elapsed = (tw.elapsed + dt) % tw.period;
  const halfPeriod = tw.period * 0.5;
  // t in [0,1] ping-pong: forward for first half, backward for second half.
  const halfPhase = tw.elapsed / halfPeriod;
  const t = halfPhase <= 1 ? halfPhase : 2 - halfPhase;
  tw.value = tw.from + (tw.to - tw.from) * tw.easing(t);
  return tw.value;
}

/**
 * Reset a periodic tween: zero elapsed, restore value to `from`.
 */
export function resetPeriodicTween(tw: PeriodicTween): void {
  tw.elapsed = 0;
  tw.value = tw.from;
}
