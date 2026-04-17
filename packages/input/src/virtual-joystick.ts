import type { Vec2 } from '@flare-engine/math';

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
  const deadZone = config?.deadZone ?? DEFAULT_DEAD_ZONE;
  const maxRadius = config?.maxRadius ?? DEFAULT_MAX_RADIUS;

  const dx = touchX - centerX;
  const dy = touchY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  state.active = true;

  if (dist < deadZone) {
    state.direction.x = 0;
    state.direction.y = 0;
    state.magnitude = 0;
    state.offset.x = dx;
    state.offset.y = dy;
    return;
  }

  // Clamp to max radius
  const clampedDist = Math.min(dist, maxRadius);
  const normalizedDist = (clampedDist - deadZone) / (maxRadius - deadZone);

  // Direction is always the full normalized direction
  const invDist = 1 / dist;
  state.direction.x = dx * invDist;
  state.direction.y = dy * invDist;
  state.magnitude = Math.min(normalizedDist, 1);

  // Offset clamped to max radius
  const scale = clampedDist / dist;
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
