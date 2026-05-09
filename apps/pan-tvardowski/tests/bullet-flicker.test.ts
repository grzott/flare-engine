import { describe, expect, test } from 'bun:test';
import type { SpriteFrame } from '@flare-engine/assets';

// Pure helpers extracted from the cadence/frame-resolution logic in play.ts.
// These are deterministic — no renderer, no GPU.

interface FlickerState {
  accum: number;
  phase: number;
}

function advanceFlicker(state: FlickerState, dt: number): FlickerState {
  let accum = state.accum + dt;
  let phase = state.phase;
  if (accum >= 0.125) {
    accum -= 0.125;
    phase ^= 1;
  }
  return { accum, phase };
}

function resolveFlickerFrame(
  phase: number,
  reducedMotion: boolean,
  frameA: SpriteFrame,
  frameB: SpriteFrame,
): SpriteFrame {
  if (reducedMotion) return frameA;
  return phase === 0 ? frameA : frameB;
}

const FRAME_A: SpriteFrame = { name: 'enemy-bullet-a', x: 0, y: 0, w: 6, h: 10 };
const FRAME_B: SpriteFrame = { name: 'enemy-bullet-b', x: 7, y: 0, w: 6, h: 10 };

describe('bullet-flicker', () => {
  test('bulletFlickerPhase advances at 8 Hz', () => {
    let state: FlickerState = { accum: 0, phase: 0 };

    // After 1st 125 ms step — phase flips to 1.
    state = advanceFlicker(state, 0.125);
    expect(state.phase).toBe(1);

    // After 2nd step — phase flips back to 0.
    state = advanceFlicker(state, 0.125);
    expect(state.phase).toBe(0);

    // After 3rd step — phase flips to 1 again.
    state = advanceFlicker(state, 0.125);
    expect(state.phase).toBe(1);

    // After N steps the phase alternates correctly.
    for (let i = 0; i < 10; i++) {
      const before = state.phase;
      state = advanceFlicker(state, 0.125);
      expect(state.phase).toBe(before ^ 1);
    }
  });

  test('frame name resolves correctly per phase', () => {
    // Phase 0 → enemy-bullet-a.
    expect(resolveFlickerFrame(0, false, FRAME_A, FRAME_B).name).toBe('enemy-bullet-a');
    // Phase 1 → enemy-bullet-b.
    expect(resolveFlickerFrame(1, false, FRAME_A, FRAME_B).name).toBe('enemy-bullet-b');
  });

  test('reducedMotion suppresses flicker — phase 1 still resolves to enemy-bullet-a', () => {
    // Even when phase is 1, reducedMotion=true forces frame-a.
    expect(resolveFlickerFrame(1, true, FRAME_A, FRAME_B).name).toBe('enemy-bullet-a');
    // Phase 0 with reducedMotion=true also stays on frame-a.
    expect(resolveFlickerFrame(0, true, FRAME_A, FRAME_B).name).toBe('enemy-bullet-a');
  });
});
