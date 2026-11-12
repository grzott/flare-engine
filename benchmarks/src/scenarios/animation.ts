/**
 * Pure-data animation scenario matrix — no tween, spring or animator instance,
 * no closure. Consumed by `../animation.bench.ts`, which binds each row to the
 * real `@flare-engine/animation` per-frame functions.
 *
 * `innerIters` puts one sample near 1.5 ms pinned to P-cores, the window the
 * other suites use; measured 2026-11-12 across five pinned processes.
 */
export type AnimationKind = 'tweens' | 'springs' | 'animators';

export type AnimationScenario = {
  readonly name: string;
  readonly n: number;
  readonly kind: AnimationKind;
  readonly innerIters: number;
};

export const ANIMATION_SCENARIOS: readonly AnimationScenario[] = [
  {
    name: 'animation.updateTweens    1000 tweens, 4 easings',
    n: 1000,
    kind: 'tweens',
    innerIters: 320,
  },
  {
    name: 'animation.updateSpring    1000 springs, underdamped',
    n: 1000,
    kind: 'springs',
    innerIters: 65,
  },
  {
    name: 'animation.updateAnimator  1000 animators, looping',
    n: 1000,
    kind: 'animators',
    innerIters: 210,
  },
];
