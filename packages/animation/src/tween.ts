import type { EasingFn } from '@flare/math';

/** Tween state. */
export interface Tween {
  /** Start value. */
  from: number;
  /** End value. */
  to: number;
  /** Duration in seconds. */
  duration: number;
  /** Easing function. */
  easing: EasingFn;
  /** Elapsed time in seconds. */
  elapsed: number;
  /** Current interpolated value. */
  value: number;
  /** Whether the tween is complete. */
  done: boolean;
  /** Optional callback when tween completes. */
  onComplete: (() => void) | null;
  /** Chained tween to start after this one completes. */
  next: Tween | null;
}

/** Linear easing fallback. */
function linearEasing(t: number): number {
  return t;
}

/** Create a tween. */
export function tween(from: number, to: number, duration: number, easing?: EasingFn): Tween {
  return {
    from,
    to,
    duration,
    easing: easing ?? linearEasing,
    elapsed: 0,
    value: from,
    done: false,
    onComplete: null,
    next: null,
  };
}

/**
 * Update a tween by dt seconds. Returns the current value.
 * When complete, triggers onComplete callback and advances to chained tween.
 */
export function updateTween(tw: Tween, dt: number): number {
  if (tw.done) return tw.value;

  tw.elapsed += dt;

  if (tw.elapsed >= tw.duration) {
    tw.elapsed = tw.duration;
    tw.value = tw.to;
    tw.done = true;
    tw.onComplete?.();
    return tw.value;
  }

  const t = tw.elapsed / tw.duration;
  tw.value = tw.from + (tw.to - tw.from) * tw.easing(t);
  return tw.value;
}

/** Chain another tween to run after this one completes. Returns the chained tween. */
export function chainTween(tw: Tween, next: Tween): Tween {
  tw.next = next;
  return next;
}

/** Reset a tween to its initial state. */
export function resetTween(tw: Tween): void {
  tw.elapsed = 0;
  tw.value = tw.from;
  tw.done = false;
}
