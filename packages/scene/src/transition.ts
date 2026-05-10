import type { EasingFn } from '@flare-engine/math';

export type { EasingFn };

/** Slide direction — where the outgoing scene moves off-screen to. */
export type SlideDirection = 'left' | 'right' | 'up' | 'down';

/** Transition state during a scene switch. */
export interface TransitionState {
  /** Progress 0 → 1. */
  progress: number;
  /** Whether the transition is complete. */
  done: boolean;
  /** Phase: 'out' = leaving scene fading out, 'in' = entering scene fading in. */
  phase: 'out' | 'in';
}

/** A transition controls the visual blending between two scenes. */
export interface Transition {
  /** Discriminator for consumers that apply a visual effect (alpha, translate, etc.). */
  readonly kind: 'none' | 'fade' | 'slide';

  /** Duration in seconds for each phase (out + in). */
  readonly duration: number;

  /** For slide transitions, the direction the outgoing scene slides toward. */
  readonly direction?: SlideDirection;

  /** Start the transition. */
  start(phase: 'out' | 'in'): TransitionState;

  /** Update the transition by dt seconds. Returns the updated state. */
  update(state: TransitionState, dt: number): TransitionState;
}

const identity: EasingFn = (t) => t;

/**
 * Returns a stateful advance function that tracks raw (linear) progress in its
 * own closure so the easing function is applied without accumulating drift.
 * Call `reset()` when starting a new transition phase.
 */
function makeAdvancer(duration: number, easing: EasingFn) {
  let raw = 0;
  return {
    reset() {
      raw = 0;
    },
    advance(state: TransitionState, dt: number): TransitionState {
      if (state.done) return state;
      raw += dt / duration;
      if (raw >= 1) {
        raw = 1;
        state.progress = 1;
        state.done = true;
      } else {
        state.progress = easing(raw);
      }
      return state;
    },
  };
}

/** No transition — instant scene switch. */
export function noneTransition(): Transition {
  return {
    kind: 'none',
    duration: 0,
    start(phase) {
      return { progress: 1, done: true, phase };
    },
    update(state) {
      state.progress = 1;
      state.done = true;
      return state;
    },
  };
}

/** Fade transition — consumer interprets `progress` as alpha. */
export function fadeTransition(duration = 0.3, easing: EasingFn = identity): Transition {
  const advancer = makeAdvancer(duration, easing);
  return {
    kind: 'fade',
    duration,
    start(phase) {
      advancer.reset();
      return { progress: 0, done: false, phase };
    },
    update(state, dt) {
      return advancer.advance(state, dt);
    },
  };
}

/**
 * Slide transition — consumer interprets `progress` as a 0→1 offset along `direction`.
 * Default direction is 'left' (outgoing scene slides off to the left, incoming enters from the right).
 */
export function slideTransition(
  duration = 0.3,
  direction: SlideDirection = 'left',
  easing: EasingFn = identity,
): Transition {
  const advancer = makeAdvancer(duration, easing);
  return {
    kind: 'slide',
    duration,
    direction,
    start(phase) {
      advancer.reset();
      return { progress: 0, done: false, phase };
    },
    update(state, dt) {
      return advancer.advance(state, dt);
    },
  };
}
