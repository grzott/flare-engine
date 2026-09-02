/**
 * Gamepad — poll-based state for a single connected controller.
 *
 * Buttons and axes are indexed against the W3C "Standard Gamepad" mapping by
 * default. Callers can translate raw indices via `remap.ts` before feeding
 * snapshots into `updateGamepadFromSnapshot`.
 */

/**
 * Dev-flag access for the dead-zone guard, which runs per axis per frame. Read
 * as a `globalThis` property rather than a bare `__DEV__` identifier for the
 * reason measured in PERF-10 (~0.46 ns vs ~270 ns on JSC).
 */
const G = globalThis as { __DEV__?: boolean };

/** Warn at most once per process; a bad dead zone repeats every frame. */
let _warnedDeadZone = false;

/** Largest dead zone that still leaves the rescale well-defined. */
const MAX_DEAD_ZONE = 0.99;

/** W3C Standard Gamepad button indices. */
export const GamepadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Back: 8,
  Start: 9,
  LS: 10,
  RS: 11,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
  Home: 16,
} as const;
export type GamepadButtonId = (typeof GamepadButton)[keyof typeof GamepadButton];

/** W3C Standard Gamepad axes. */
export const GamepadAxis = {
  LeftX: 0,
  LeftY: 1,
  RightX: 2,
  RightY: 3,
} as const;
export type GamepadAxisId = (typeof GamepadAxis)[keyof typeof GamepadAxis];

export interface GamepadButtonState {
  pressed: boolean;
  value: number;
  /** True for exactly one frame after a press. */
  pressedThisFrame: boolean;
  /** True for exactly one frame after a release. */
  releasedThisFrame: boolean;
}

export interface GamepadState {
  connected: boolean;
  id: string;
  index: number;
  buttons: GamepadButtonState[];
  axes: number[];
  /** Monotonically increasing timestamp from the source (ms). */
  timestamp: number;
}

/** Raw snapshot from a `GamepadSource` — values only, no derived state. */
export interface GamepadSnapshot {
  id: string;
  index: number;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
  timestamp: number;
}

export function createGamepadState(index = 0, buttonCount = 17, axisCount = 4): GamepadState {
  const buttons: GamepadButtonState[] = new Array(buttonCount);
  for (let i = 0; i < buttonCount; i++) {
    buttons[i] = { pressed: false, value: 0, pressedThisFrame: false, releasedThisFrame: false };
  }
  const axes = new Array<number>(axisCount).fill(0);
  return { connected: false, id: '', index, buttons, axes, timestamp: 0 };
}

function applyDeadZone(value: number, deadZone: number): number {
  // The documented contract is [0, 1). At exactly 1 the rescale below divides by
  // zero and returns ±Infinity for any out-of-range axis, which then propagates
  // into every consumer reading the stick. Correct rather than propagate.
  let dz = deadZone;
  if (!(dz >= 0 && dz < 1)) {
    if (G.__DEV__ && !_warnedDeadZone) {
      _warnedDeadZone = true;
      console.warn(
        `[flare-engine/input] deadZone=${deadZone} is outside [0, 1); clamping. ` +
          'Values at or above 1 would suppress the axis entirely.',
      );
    }
    dz = dz >= 1 ? MAX_DEAD_ZONE : 0;
  }
  const abs = Math.abs(value);
  // `!(abs > dz)` rather than `abs <= dz` so a non-finite axis returns 0 instead
  // of falling through to produce NaN.
  if (!(abs > dz)) return 0;
  const sign = value < 0 ? -1 : 1;
  // Rescale [deadZone, 1] -> [0, 1] so inputs remain smooth past the dead zone.
  return sign * ((abs - dz) / (1 - dz));
}

/**
 * Apply a fresh snapshot to an existing `GamepadState` in place. Derived
 * `pressedThisFrame` / `releasedThisFrame` flags are recomputed from the
 * previous `pressed` value.
 *
 * `deadZone` in [0, 1). Values at or below are treated as 0.
 */
export function updateGamepadFromSnapshot(
  state: GamepadState,
  snapshot: GamepadSnapshot | null,
  deadZone = 0,
): void {
  if (snapshot === null) {
    if (!state.connected && !anyButtonDown(state)) {
      clearFrameFlags(state);
      return;
    }
    // Disconnect: clear edge flags, keep sticky pressed=false for released-edge.
    for (let i = 0; i < state.buttons.length; i++) {
      const b = state.buttons[i];
      if (!b) continue;
      b.pressedThisFrame = false;
      b.releasedThisFrame = b.pressed;
      b.pressed = false;
      b.value = 0;
    }
    for (let i = 0; i < state.axes.length; i++) state.axes[i] = 0;
    state.connected = false;
    state.id = '';
    return;
  }

  state.connected = true;
  state.id = snapshot.id;
  state.index = snapshot.index;
  state.timestamp = snapshot.timestamp;

  const srcButtons = snapshot.buttons;
  const bLen = Math.min(state.buttons.length, srcButtons.length);
  for (let i = 0; i < bLen; i++) {
    const prev = state.buttons[i];
    const src = srcButtons[i];
    if (!prev || !src) continue;
    const wasPressed = prev.pressed;
    prev.pressed = src.pressed;
    prev.value = src.value;
    prev.pressedThisFrame = src.pressed && !wasPressed;
    prev.releasedThisFrame = !src.pressed && wasPressed;
  }
  // Buttons beyond the snapshot length: clear edges, keep prior pressed false.
  for (let i = bLen; i < state.buttons.length; i++) {
    const b = state.buttons[i];
    if (!b) continue;
    b.pressedThisFrame = false;
    b.releasedThisFrame = b.pressed;
    b.pressed = false;
    b.value = 0;
  }

  const aLen = Math.min(state.axes.length, snapshot.axes.length);
  for (let i = 0; i < aLen; i++) {
    state.axes[i] = applyDeadZone(snapshot.axes[i] ?? 0, deadZone);
  }
  for (let i = aLen; i < state.axes.length; i++) state.axes[i] = 0;
}

/** Reset just the per-frame edge flags. Call when advancing a frame without a fresh snapshot. */
export function resetGamepadFrame(state: GamepadState): void {
  clearFrameFlags(state);
}

function clearFrameFlags(state: GamepadState): void {
  for (let i = 0; i < state.buttons.length; i++) {
    const b = state.buttons[i];
    if (!b) continue;
    b.pressedThisFrame = false;
    b.releasedThisFrame = false;
  }
}

function anyButtonDown(state: GamepadState): boolean {
  for (let i = 0; i < state.buttons.length; i++) {
    if (state.buttons[i]?.pressed) return true;
  }
  return false;
}

export function isButtonDown(state: GamepadState, button: number): boolean {
  return state.buttons[button]?.pressed ?? false;
}

export function wasButtonPressed(state: GamepadState, button: number): boolean {
  return state.buttons[button]?.pressedThisFrame ?? false;
}

export function wasButtonReleased(state: GamepadState, button: number): boolean {
  return state.buttons[button]?.releasedThisFrame ?? false;
}

export function getAxis(state: GamepadState, axis: number): number {
  return state.axes[axis] ?? 0;
}
