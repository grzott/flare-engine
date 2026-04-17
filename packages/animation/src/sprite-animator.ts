import type { SpriteFrame, SpriteSheet } from '@flare/assets';

/** State of a sprite animator. */
export interface SpriteAnimatorState {
  /** The sprite sheet data source. */
  sheet: SpriteSheet;
  /** Current animation name, or null if none. */
  currentAnimation: string | null;
  /** Current frame index within the animation sequence. */
  frameIndex: number;
  /** Accumulated time within current frame (seconds). */
  elapsed: number;
  /** Whether animation is paused. */
  paused: boolean;
  /** Whether the current sequence has finished (non-looping). */
  finished: boolean;
}

/** Create a sprite animator state bound to a sprite sheet. */
export function createSpriteAnimator(sheet: SpriteSheet): SpriteAnimatorState {
  return {
    sheet,
    currentAnimation: null,
    frameIndex: 0,
    elapsed: 0,
    paused: false,
    finished: false,
  };
}

/** Play a named animation. Resets to frame 0. */
export function playAnimation(state: SpriteAnimatorState, name: string): void {
  const seq = state.sheet.animations.get(name);
  if (!seq) return;
  state.currentAnimation = name;
  state.frameIndex = 0;
  state.elapsed = 0;
  state.paused = false;
  state.finished = false;
}

/** Stop the current animation. */
export function stopAnimation(state: SpriteAnimatorState): void {
  state.currentAnimation = null;
  state.frameIndex = 0;
  state.elapsed = 0;
  state.paused = false;
  state.finished = false;
}

/** Pause the current animation. */
export function pauseAnimation(state: SpriteAnimatorState): void {
  state.paused = true;
}

/** Resume the current animation. */
export function resumeAnimation(state: SpriteAnimatorState): void {
  state.paused = false;
}

/**
 * Tick the animator forward by dt seconds.
 * Returns the current SpriteFrame, or null if no animation is playing.
 */
export function updateAnimator(state: SpriteAnimatorState, dt: number): SpriteFrame | null {
  if (!state.currentAnimation || state.paused || state.finished) {
    return getCurrentFrame(state);
  }

  const seq = state.sheet.animations.get(state.currentAnimation);
  if (!seq || seq.frameIndices.length === 0) return null;

  state.elapsed += dt;

  while (state.elapsed >= seq.frameDuration) {
    state.elapsed -= seq.frameDuration;
    state.frameIndex++;

    if (state.frameIndex >= seq.frameIndices.length) {
      if (seq.loop) {
        state.frameIndex = 0;
      } else {
        state.frameIndex = seq.frameIndices.length - 1;
        state.finished = true;
        state.elapsed = 0;
        break;
      }
    }
  }

  return getCurrentFrame(state);
}

/** Get the current SpriteFrame without advancing time. */
export function getCurrentFrame(state: SpriteAnimatorState): SpriteFrame | null {
  if (!state.currentAnimation) return null;
  const seq = state.sheet.animations.get(state.currentAnimation);
  if (!seq || seq.frameIndices.length === 0) return null;
  const globalIdx = seq.frameIndices[state.frameIndex];
  if (globalIdx === undefined) return null;
  return state.sheet.frames[globalIdx] ?? null;
}
