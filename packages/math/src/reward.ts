/**
 * Timed-window and capped-bonus math — pure, zero-alloc scoring helpers.
 */

/**
 * Bonus pay floored to an integer: `pay × min(frac, capFrac)`.
 * `frac` is the current multiplier (e.g. `streak * fracPerStep`);
 * `capFrac` bounds the multiplier so it cannot grow unboundedly.
 * Returns 0 for zero or negative `pay`.
 */
export function cappedBonus(pay: number, frac: number, capFrac: number): number {
  if (pay <= 0) return 0;
  return Math.floor(pay * Math.min(frac, capFrac));
}

/**
 * Advances a timed streak counter. A new event within `windowSec` of `lastT`
 * increments `prev`; a gap (or `lastT < 0` meaning "no prior event") resets
 * to 1. Pure — the caller stores the returned value and stamps the new time.
 * `elapsed` is the monotonic clock at the new event.
 */
export function advanceWindowedStreak(
  prev: number,
  elapsed: number,
  lastT: number,
  windowSec: number,
): number {
  if (lastT >= 0 && elapsed - lastT <= windowSec) return prev + 1;
  return 1;
}

/**
 * Returns true when a streak window has lapsed: a window was open (`lastT >= 0`)
 * and more than `windowSec` seconds have passed since `lastT`.
 * `lastT < 0` means no event has ever occurred — never expired.
 */
export function windowExpired(elapsed: number, lastT: number, windowSec: number): boolean {
  return lastT >= 0 && elapsed - lastT > windowSec;
}

/**
 * How many more events may be awarded in the current window given `awarded`
 * already counted. Clamped to 0 — never negative.
 */
export function remainingInWindow(awarded: number, capPerWindow: number): number {
  return Math.max(0, capPerWindow - awarded);
}
