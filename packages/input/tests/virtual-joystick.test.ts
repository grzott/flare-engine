import { describe, expect, it } from 'bun:test';
import { createJoystickState, releaseJoystick, updateJoystick } from '../src/virtual-joystick.js';

describe('VirtualJoystick', () => {
  it('creates with default state', () => {
    const state = createJoystickState();
    expect(state.active).toBe(false);
    expect(state.direction).toEqual({ x: 0, y: 0 });
    expect(state.magnitude).toBe(0);
    expect(state.offset).toEqual({ x: 0, y: 0 });
  });

  it('reports zero in dead zone', () => {
    const state = createJoystickState();
    // Touch 5px right of center (within default deadZone of 10)
    updateJoystick(state, 100, 100, 105, 100);
    expect(state.active).toBe(true);
    expect(state.direction).toEqual({ x: 0, y: 0 });
    expect(state.magnitude).toBe(0);
  });

  it('reports direction outside dead zone', () => {
    const state = createJoystickState();
    // Touch 30px right of center (deadZone=10, maxRadius=50)
    updateJoystick(state, 100, 100, 130, 100);
    expect(state.active).toBe(true);
    expect(state.direction.x).toBeCloseTo(1);
    expect(state.direction.y).toBeCloseTo(0);
    // magnitude = (30 - 10) / (50 - 10) = 20/40 = 0.5
    expect(state.magnitude).toBeCloseTo(0.5);
  });

  it('clamps at max radius', () => {
    const state = createJoystickState();
    // Touch 100px right (beyond maxRadius=50)
    updateJoystick(state, 100, 100, 200, 100);
    expect(state.magnitude).toBeCloseTo(1);
    expect(state.offset.x).toBeCloseTo(50);
    expect(state.offset.y).toBeCloseTo(0);
  });

  it('handles diagonal input', () => {
    const state = createJoystickState();
    // Touch at 45 degrees, 50px away
    const dist = 50;
    const x = 100 + dist * Math.cos(Math.PI / 4);
    const y = 100 + dist * Math.sin(Math.PI / 4);
    updateJoystick(state, 100, 100, x, y);
    expect(state.direction.x).toBeCloseTo(Math.SQRT1_2);
    expect(state.direction.y).toBeCloseTo(Math.SQRT1_2);
    expect(state.magnitude).toBeCloseTo(1);
  });

  it('release resets state', () => {
    const state = createJoystickState();
    updateJoystick(state, 100, 100, 150, 100);
    expect(state.active).toBe(true);

    releaseJoystick(state);
    expect(state.active).toBe(false);
    expect(state.direction).toEqual({ x: 0, y: 0 });
    expect(state.magnitude).toBe(0);
    expect(state.offset).toEqual({ x: 0, y: 0 });
  });

  it('respects custom config', () => {
    const state = createJoystickState();
    const config = { deadZone: 5, maxRadius: 100 };
    // 50px right: magnitude = (50-5)/(100-5) = 45/95 ≈ 0.4737
    updateJoystick(state, 0, 0, 50, 0, config);
    expect(state.magnitude).toBeCloseTo(45 / 95);
  });
});

// ---------------------------------------------------------------------------
// OSS-B23b — non-finite propagation. Every case below wrote NaN or Infinity
// into the reused state before the guards landed, and because the state object
// persists across frames the stick never recovered for the rest of the session.
// ---------------------------------------------------------------------------

describe('VirtualJoystick — non-finite guards (B23b)', () => {
  const finite = (v: number): boolean => Number.isFinite(v);

  it('deadZone 0 with the touch exactly on centre does not divide by zero', () => {
    // Old: dist === 0 passes `dist < 0` === false, so 1 / 0 → Infinity and
    // direction became 0 * Infinity → NaN.
    const state = createJoystickState();
    updateJoystick(state, 100, 100, 100, 100, { deadZone: 0, maxRadius: 50 });
    expect(finite(state.direction.x)).toBe(true);
    expect(finite(state.direction.y)).toBe(true);
    expect(finite(state.magnitude)).toBe(true);
    expect(state.direction).toEqual({ x: 0, y: 0 });
  });

  it('maxRadius equal to deadZone does not divide by zero', () => {
    // Old: (clampedDist - deadZone) / 0 → NaN, and Math.min(NaN, 1) is NaN.
    const state = createJoystickState();
    updateJoystick(state, 100, 100, 140, 100, { deadZone: 20, maxRadius: 20 });
    expect(finite(state.magnitude)).toBe(true);
    expect(finite(state.direction.x)).toBe(true);
  });

  it('a NaN deadZone falls back instead of defeating the dead-zone branch', () => {
    // Old: `dist < NaN` is false, so the centred branch was skipped and every
    // subsequent term was NaN.
    const state = createJoystickState();
    updateJoystick(state, 100, 100, 130, 100, { deadZone: Number.NaN, maxRadius: 50 });
    expect(finite(state.magnitude)).toBe(true);
    expect(finite(state.direction.x)).toBe(true);
    expect(finite(state.offset.x)).toBe(true);
  });

  it('a non-finite touch coordinate leaves the state finite', () => {
    const state = createJoystickState();
    updateJoystick(state, 100, 100, Number.NaN, 100);
    expect(finite(state.direction.x)).toBe(true);
    expect(finite(state.magnitude)).toBe(true);
    expect(finite(state.offset.x)).toBe(true);
    expect(finite(state.offset.y)).toBe(true);
  });

  it('a zero-size config writes no NaN on the frame it occurs', () => {
    // deadZone === maxRadius === 0 hits every unguarded division at once:
    // normalizedDist = 0/0, invDist = 1/0, scale = 0/0.
    const state = createJoystickState();
    updateJoystick(state, 100, 100, 100, 100, { deadZone: 0, maxRadius: 0 });
    expect(finite(state.magnitude)).toBe(true);
    expect(finite(state.direction.x)).toBe(true);
    expect(finite(state.direction.y)).toBe(true);
    expect(finite(state.offset.x)).toBe(true);
    expect(finite(state.offset.y)).toBe(true);
  });
});
