import { type Tween, tween, updateTween } from '@flare-engine/animation';
import { easeOutCubic } from '@flare-engine/math';

/**
 * Zone-intro banner state. A brief fade-in (0.5 s) + hold (1.5 s) + fade-out
 * (0.5 s) driven by two chained tweens on a single opacity value.
 */
export interface ZoneBannerState {
  visible: boolean;
  opacity: number;
  elapsed: number;
  duration: number;
  fadeIn: Tween;
  fadeOut: Tween;
  phase: 'in' | 'hold' | 'out' | 'done';
  holdSec: number;
}

export function createZoneBannerState(): ZoneBannerState {
  return {
    visible: false,
    opacity: 0,
    elapsed: 0,
    duration: 0,
    fadeIn: tween(0, 1, 0.45, easeOutCubic),
    fadeOut: tween(1, 0, 0.45, easeOutCubic),
    phase: 'done',
    holdSec: 1.4,
  };
}

export function showZoneBanner(state: ZoneBannerState): void {
  state.visible = true;
  state.opacity = 0;
  state.elapsed = 0;
  state.phase = 'in';
  state.fadeIn.elapsed = 0;
  state.fadeIn.done = false;
  state.fadeIn.value = 0;
  state.fadeOut.elapsed = 0;
  state.fadeOut.done = false;
  state.fadeOut.value = 1;
}

export function updateZoneBanner(state: ZoneBannerState, dt: number): void {
  if (state.phase === 'done' || !state.visible) return;
  state.elapsed += dt;
  if (state.phase === 'in') {
    state.opacity = updateTween(state.fadeIn, dt);
    if (state.fadeIn.done) state.phase = 'hold';
  } else if (state.phase === 'hold') {
    state.opacity = 1;
    if (state.elapsed >= state.holdSec + state.fadeIn.duration) state.phase = 'out';
  } else if (state.phase === 'out') {
    state.opacity = updateTween(state.fadeOut, dt);
    if (state.fadeOut.done) {
      state.phase = 'done';
      state.visible = false;
      state.opacity = 0;
    }
  }
}
