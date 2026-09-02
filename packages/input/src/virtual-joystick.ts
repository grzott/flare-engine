import type { Vec2 } from '@flare-engine/math';

/**
 * Dev-flag access for the config guard in `updateJoystick`, which runs once per
 * frame while a stick is held. Read as a `globalThis` property, not as a bare
 * `__DEV__` identifier: on JSC an unresolvable global costs ~270 ns per
 * evaluation where a property miss is inline-cached at ~0.46 ns. Same reasoning
 * as `@flare-engine/core`'s `Pool` — see PERF-10.
 */
const G = globalThis as { __DEV__?: boolean };

/** Warn at most once per process; a bad config repeats every frame. */
let _warnedConfig = false;

/** Virtual joystick configuration. */
export interface VirtualJoystickConfig {
  /** Dead zone radius in pixels (default 10). */
  deadZone?: number;
  /** Maximum radius in pixels (default 50). */
  maxRadius?: number;
}

/** Virtual joystick state — pure data, no UI. */
export interface VirtualJoystickState {
  /** Whether the joystick is currently being touched. */
  active: boolean;
  /** Normalized direction vector (-1 to 1 per axis). */
  direction: Vec2;
  /** Magnitude 0-1 (0 = center/dead zone, 1 = max radius). */
  magnitude: number;
  /** Raw offset from center in pixels. */
  offset: Vec2;
}

const DEFAULT_DEAD_ZONE = 10;
const DEFAULT_MAX_RADIUS = 50;

/** Create a default joystick state. */
export function createJoystickState(): VirtualJoystickState {
  return {
    active: false,
    direction: { x: 0, y: 0 },
    magnitude: 0,
    offset: { x: 0, y: 0 },
  };
}

/**
 * Update joystick state from a touch event.
 *
 * @param state The joystick state to update.
 * @param centerX The joystick center X in screen pixels.
 * @param centerY The joystick center Y in screen pixels.
 * @param touchX The current touch X in screen pixels.
 * @param touchY The current touch Y in screen pixels.
 * @param config Joystick configuration.
 */
export function updateJoystick(
  state: VirtualJoystickState,
  centerX: number,
  centerY: number,
  touchX: number,
  touchY: number,
  config?: VirtualJoystickConfig,
): void {
  let deadZone = config?.deadZone ?? DEFAULT_DEAD_ZONE;
  let maxRadius = config?.maxRadius ?? DEFAULT_MAX_RADIUS;

  // Out-of-contract config is corrected rather than propagated. Left alone, a
  // NaN deadZone defeats the early return below and a maxRadius equal to
  // deadZone divides by zero at `normalizedDist` — either way `state.direction`
  // becomes NaN and, because the state is reused across frames, the stick never
  // recovers. The whole check sits behind one comparison on the healthy path.
  if (!(deadZone >= 0 && maxRadius > deadZone)) {
    if (G.__DEV__ && !_warnedConfig) {
      _warnedConfig = true;
      console.warn(
        `[flare-engine/input] updateJoystick: invalid config (deadZone=${deadZone}, maxRadius=${maxRadius}); ` +
          'expected 0 <= deadZone < maxRadius. Falling back to defaults for this call.',
      );
    }
    if (!(deadZone >= 0)) deadZone = DEFAULT_DEAD_ZONE;
    if (!(maxRadius > deadZone)) maxRadius = deadZone + DEFAULT_MAX_RADIUS;
  }

  const dx = touchX - centerX;
  const dy = touchY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  state.active = true;

  // `!(dist >= deadZone)` rather than `dist < deadZone` so a non-finite touch
  // coordinate takes the centred branch instead of falling through to the maths.
  if (!(dist >= deadZone)) {
    state.direction.x = 0;
    state.direction.y = 0;
    state.magnitude = 0;
    // dist is non-finite only when a touch coordinate was, in which case dx/dy
    // are too — report a centred offset rather than writing NaN into the state.
    const centred = dist === 0 || !Number.isFinite(dist);
    state.offset.x = centred ? 0 : dx;
    state.offset.y = centred ? 0 : dy;
    return;
  }

  // Clamp to max radius
  const clampedDist = Math.min(dist, maxRadius);
  const normalizedDist = (clampedDist - deadZone) / (maxRadius - deadZone);

  // Direction is always the full normalized direction. `dist` is > 0 here —
  // a zero distance cannot pass the guard above once deadZone >= 0 — but the
  // reciprocal is guarded anyway, because `deadZone: 0` makes `dist === 0`
  // reachable and `1 / 0` would put Infinity into direction.
  const invDist = dist > 0 ? 1 / dist : 0;
  state.direction.x = dx * invDist;
  state.direction.y = dy * invDist;
  state.magnitude = Math.min(normalizedDist, 1);

  // Offset clamped to max radius
  const scale = dist > 0 ? clampedDist / dist : 0;
  state.offset.x = dx * scale;
  state.offset.y = dy * scale;
}

/** Reset joystick state when touch is released. */
export function releaseJoystick(state: VirtualJoystickState): void {
  state.active = false;
  state.direction.x = 0;
  state.direction.y = 0;
  state.magnitude = 0;
  state.offset.x = 0;
  state.offset.y = 0;
}
