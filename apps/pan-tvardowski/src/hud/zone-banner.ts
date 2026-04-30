import { type Tween, tween, updateTween } from '@flare-engine/animation';
import { easeOutQuart } from '@flare-engine/math';
import type { ZoneId } from '../events';

const ZONE_NUMERALS: Record<ZoneId, string> = {
  z1: 'I',
  z2: 'II',
  z3: 'III',
  z4: 'IV',
  z5: 'V',
  z6: 'VI',
  z7: 'VII',
  z8: 'VIII',
};

/** Maps a ZoneId to its Roman numeral string (I–VIII). */
export function zoneRomanNumeral(zoneId: ZoneId): string {
  return ZONE_NUMERALS[zoneId];
}

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
    // Folio XIV item 9: zone banner enter quartOut 800 ms.
    fadeIn: tween(0, 1, 0.8, easeOutQuart),
    fadeOut: tween(1, 0, 0.45, easeOutQuart),
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
