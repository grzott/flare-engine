import { beforeEach, describe, expect, test } from 'bun:test';
import {
  createGamepadState,
  GamepadButton,
  type GamepadSnapshot,
  type GamepadState,
  getAxis,
  isButtonDown,
  resetGamepadFrame,
  updateGamepadFromSnapshot,
  wasButtonPressed,
  wasButtonReleased,
} from '../src/gamepad.js';

function snap(overrides: Partial<GamepadSnapshot> = {}): GamepadSnapshot {
  const buttons =
    overrides.buttons ?? Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  const axes = overrides.axes ?? [0, 0, 0, 0];
  return {
    id: overrides.id ?? 'standard',
    index: overrides.index ?? 0,
    timestamp: overrides.timestamp ?? 0,
    buttons,
    axes,
  };
}

describe('gamepad state', () => {
  let state: GamepadState;
  beforeEach(() => {
    state = createGamepadState(0);
  });

  test('createGamepadState yields 17 buttons / 4 axes disconnected', () => {
    expect(state.connected).toBe(false);
    expect(state.buttons.length).toBe(17);
    expect(state.axes.length).toBe(4);
  });

  test('updating from a snapshot marks connected and copies values', () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    buttons[GamepadButton.A] = { pressed: true, value: 1 };
    updateGamepadFromSnapshot(state, snap({ buttons, axes: [0.5, -0.3, 0, 0] }));
    expect(state.connected).toBe(true);
    expect(isButtonDown(state, GamepadButton.A)).toBe(true);
    expect(wasButtonPressed(state, GamepadButton.A)).toBe(true);
    expect(wasButtonReleased(state, GamepadButton.A)).toBe(false);
    expect(getAxis(state, 0)).toBeCloseTo(0.5);
    expect(getAxis(state, 1)).toBeCloseTo(-0.3);
  });

  test('edge flags are per-frame', () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    buttons[GamepadButton.A] = { pressed: true, value: 1 };
    updateGamepadFromSnapshot(state, snap({ buttons }));
    expect(wasButtonPressed(state, GamepadButton.A)).toBe(true);

    // Second frame with same snapshot — button is held, not "just pressed".
    updateGamepadFromSnapshot(state, snap({ buttons }));
    expect(wasButtonPressed(state, GamepadButton.A)).toBe(false);
    expect(isButtonDown(state, GamepadButton.A)).toBe(true);

    // Release
    buttons[GamepadButton.A] = { pressed: false, value: 0 };
    updateGamepadFromSnapshot(state, snap({ buttons }));
    expect(wasButtonReleased(state, GamepadButton.A)).toBe(true);
    expect(isButtonDown(state, GamepadButton.A)).toBe(false);

    // Next frame — released edge is cleared.
    updateGamepadFromSnapshot(state, snap({ buttons }));
    expect(wasButtonReleased(state, GamepadButton.A)).toBe(false);
  });

  test('dead zone zeros small axes and rescales beyond', () => {
    updateGamepadFromSnapshot(state, snap({ axes: [0.1, 0.5, 0, 0] }), 0.2);
    expect(getAxis(state, 0)).toBe(0);
    // 0.5 beyond 0.2 dead zone → rescale (0.5 - 0.2) / (1 - 0.2) = 0.375
    expect(getAxis(state, 1)).toBeCloseTo(0.375, 4);
  });

  test('negative axes respect dead zone sign', () => {
    updateGamepadFromSnapshot(state, snap({ axes: [-0.5, 0, 0, 0] }), 0.2);
    expect(getAxis(state, 0)).toBeCloseTo(-0.375, 4);
  });

  test('disconnect (null snapshot) while held button produces released edge', () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    buttons[GamepadButton.A] = { pressed: true, value: 1 };
    updateGamepadFromSnapshot(state, snap({ buttons }));
    updateGamepadFromSnapshot(state, null);
    expect(state.connected).toBe(false);
    expect(wasButtonReleased(state, GamepadButton.A)).toBe(true);
    expect(isButtonDown(state, GamepadButton.A)).toBe(false);
  });

  test('resetGamepadFrame clears edges but keeps sticky pressed state', () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    buttons[GamepadButton.A] = { pressed: true, value: 1 };
    updateGamepadFromSnapshot(state, snap({ buttons }));
    resetGamepadFrame(state);
    expect(wasButtonPressed(state, GamepadButton.A)).toBe(false);
    expect(isButtonDown(state, GamepadButton.A)).toBe(true);
  });

  test('out-of-range button reads default false / 0', () => {
    expect(isButtonDown(state, 99)).toBe(false);
    expect(wasButtonPressed(state, 99)).toBe(false);
    expect(getAxis(state, 99)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OSS-B23b — the dead-zone rescale divides by (1 - deadZone). The documented
// contract is [0, 1), but nothing enforced it, so deadZone === 1 produced
// ±Infinity (or NaN) for any axis past the zone.
// ---------------------------------------------------------------------------

describe('gamepad dead zone — out-of-contract values (B23b)', () => {
  test('an axis beyond the [-1, 1] range stays finite at deadZone 1', () => {
    const state = createGamepadState(0);
    updateGamepadFromSnapshot(state, snap({ axes: [1.5, 0, 0, 0] }), 1);
    expect(Number.isFinite(getAxis(state, 0))).toBe(true);
  });

  test('a NaN deadZone does not leak NaN into the axis', () => {
    const state = createGamepadState(0);
    updateGamepadFromSnapshot(state, snap({ axes: [0.5, 0, 0, 0] }), Number.NaN);
    expect(Number.isFinite(getAxis(state, 0))).toBe(true);
  });

  test('a non-finite axis reads as 0 rather than NaN', () => {
    const state = createGamepadState(0);
    updateGamepadFromSnapshot(state, snap({ axes: [Number.NaN, 0, 0, 0] }), 0.1);
    expect(getAxis(state, 0)).toBe(0);
  });

  test('a valid dead zone is unchanged by the guard', () => {
    const state = createGamepadState(0);
    updateGamepadFromSnapshot(state, snap({ axes: [0.5, 0, 0, 0] }), 0);
    expect(getAxis(state, 0)).toBeCloseTo(0.5, 5);
  });
});
