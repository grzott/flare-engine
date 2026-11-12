import {
  addTween,
  createSpriteAnimator,
  createTweenManager,
  playAnimation,
  type Spring,
  type SpriteAnimatorState,
  setSpringTarget,
  spring,
  type TweenManager,
  tween,
  updateAnimator,
  updateSpring,
  updateTweens,
} from '@flare-engine/animation';
import {
  type EasingFn,
  easeInOutCubic,
  easeOutBack,
  easeOutQuad,
  linear,
} from '@flare-engine/math';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { ANIMATION_SCENARIOS, type AnimationScenario } from './scenarios/animation.js';

const DT = 1 / 60;

/**
 * Longer than any capture can run, so no tween completes while it is measured.
 * The rows then time the steady per-frame path — elapsed, ratio, easing call —
 * instead of a population that drains to empty and makes later samples free.
 */
const TWEEN_DURATION = 1e9;

/** Mixed so the easing call site sees the polymorphism a real tween set has. */
const EASINGS: readonly EasingFn[] = [linear, easeOutQuad, easeInOutCubic, easeOutBack];

export function buildTweens(n: number): TweenManager {
  const mgr = createTweenManager();
  for (let i = 0; i < n; i++) {
    addTween(mgr, tween(0, 100 + i, TWEEN_DURATION, EASINGS[i % EASINGS.length]));
  }
  return mgr;
}

export type SpringState = {
  readonly springs: Spring[];
  readonly targets: Float64Array;
};

export function buildSprings(n: number): SpringState {
  const springs: Spring[] = new Array(n);
  const targets = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    targets[i] = 50 + (i % 17) * 10;
    springs[i] = spring(0, targets[i] as number);
  }
  return { springs, targets };
}

/**
 * Re-targets every spring each frame, the way a spring following a pointer or a
 * camera anchor is driven. That also keeps each one off the at-rest early
 * return: the closed-form step costs the same exp/cos/sin whether the spring is
 * still travelling or already settled, so the row is stationary from the first
 * sample instead of collapsing to a flag check once the springs converge.
 */
export function springsRun(state: SpringState): void {
  const { springs, targets } = state;
  for (let i = 0; i < springs.length; i++) {
    const s = springs[i] as Spring;
    setSpringTarget(s, targets[i] as number);
    updateSpring(s, DT);
  }
}

type SheetLike = Parameters<typeof createSpriteAnimator>[0];

const SEQUENCES: readonly { name: string; frames: number; fps: number }[] = [
  { name: 'idle', frames: 4, fps: 6 },
  { name: 'walk', frames: 8, fps: 12 },
  { name: 'run', frames: 6, fps: 15 },
];

function buildSheet(): SheetLike {
  const frames: SheetLike['frames'] = [];
  const frameMap = new Map<string, number>();
  const animations: SheetLike['animations'] = new Map();
  for (const seq of SEQUENCES) {
    const frameIndices: number[] = [];
    for (let f = 0; f < seq.frames; f++) {
      const name = `${seq.name}_${f}`;
      frameMap.set(name, frames.length);
      frameIndices.push(frames.length);
      frames.push({ name, x: f * 32, y: 0, w: 32, h: 32 });
    }
    animations.set(seq.name, {
      name: seq.name,
      frameIndices,
      frameDuration: 1 / seq.fps,
      loop: true,
    });
  }
  return { frames, frameMap, animations };
}

export function buildAnimators(n: number): SpriteAnimatorState[] {
  const sheet = buildSheet();
  const animators: SpriteAnimatorState[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = createSpriteAnimator(sheet);
    playAnimation(a, (SEQUENCES[i % SEQUENCES.length] as { name: string }).name);
    // Staggered phases: started in lockstep, every animator would cross a frame
    // boundary on the same tick and the cost would arrive in periodic spikes.
    updateAnimator(a, (i % 7) * DT);
    animators[i] = a;
  }
  return animators;
}

export function animatorsRun(animators: SpriteAnimatorState[]): void {
  for (let i = 0; i < animators.length; i++) {
    updateAnimator(animators[i] as SpriteAnimatorState, DT);
  }
}

function benchFor(scenario: AnimationScenario, overrides?: BenchOverrides): BenchStats {
  const { name, n, innerIters } = scenario;
  switch (scenario.kind) {
    case 'tweens':
      return runBench(
        { name, setup: () => buildTweens(n), run: (mgr) => updateTweens(mgr, DT), innerIters },
        overrides,
      );
    case 'springs':
      return runBench(
        { name, setup: () => buildSprings(n), run: springsRun, innerIters },
        overrides,
      );
    case 'animators':
      return runBench(
        { name, setup: () => buildAnimators(n), run: animatorsRun, innerIters },
        overrides,
      );
  }
}

export function animationBenches(overrides?: BenchOverrides): BenchStats[] {
  return ANIMATION_SCENARIOS.map((scenario) => benchFor(scenario, overrides));
}
