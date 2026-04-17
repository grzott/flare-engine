import type { Tween } from './tween.js';
import { updateTween } from './tween.js';

/**
 * Manages a collection of active tweens.
 * Automatically removes completed tweens (or advances to chained tweens).
 */
export interface TweenManager {
  /** Active tweens. */
  readonly tweens: Tween[];
}

/** Create a new TweenManager. */
export function createTweenManager(): TweenManager {
  return { tweens: [] };
}

/** Add a tween to the manager. */
export function addTween(mgr: TweenManager, tw: Tween): void {
  (mgr.tweens as Tween[]).push(tw);
}

/**
 * Update all managed tweens by dt seconds.
 * Completed tweens are removed; chained tweens replace completed ones.
 */
export function updateTweens(mgr: TweenManager, dt: number): void {
  const tweens = mgr.tweens as Tween[];
  let i = 0;
  while (i < tweens.length) {
    const tw: Tween = tweens[i]!;
    updateTween(tw, dt);
    if (tw.done) {
      if (tw.next) {
        // Replace with chained tween
        tweens[i] = tw.next;
        i++;
      } else {
        // Swap-remove
        tweens[i] = tweens[tweens.length - 1]!;
        tweens.pop();
      }
    } else {
      i++;
    }
  }
}

/** Remove all tweens. */
export function clearTweens(mgr: TweenManager): void {
  (mgr.tweens as Tween[]).length = 0;
}
