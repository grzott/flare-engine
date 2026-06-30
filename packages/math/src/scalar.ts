/** Clamps value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linearly interpolates between a and b by t (unclamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Returns the interpolation factor of value between a and b. */
export function inverseLerp(a: number, b: number, value: number): number {
  const range = b - a;
  if (range === 0) return 0;
  return (value - a) / range;
}

/** Maps value from [inMin, inMax] to [outMin, outMax]. */
export function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Converts degrees to radians. */
export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

/** Converts radians to degrees. */
export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

/** Returns true if a and b are approximately equal within epsilon. */
export function approxEquals(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

/** Wraps value into [min, max) range. */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  if (range === 0) return min;
  return min + ((((value - min) % range) + range) % range);
}

/** PingPong — bounces value back and forth in [0, length]. */
export function pingPong(t: number, length: number): number {
  if (length === 0) return 0;
  const tt = wrap(t, 0, length * 2);
  return length - Math.abs(tt - length);
}

/** Hermite smooth interpolation (0→1) with zero first-derivative at edges. */
export function smoothStep(edge0: number, edge1: number, x: number): number {
  const range = edge1 - edge0;
  if (range === 0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / range, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Returns -1, 0, or 1. Unlike Math.sign, returns 0 for NaN. */
export function sign(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Shortest signed angle delta a - b, wrapped to [-pi, pi] (closed both ends — strict comparisons
 * leave exact +/-pi unwrapped). Branch form (single +/-2pi correction)
 * — byte-identical to hand-rolled aim/homing turn math; do NOT swap for a modulo form (it shifts
 * results by ULPs at the +/-pi boundary). */
export function angleDelta(a: number, b: number): number {
  let diff = a - b;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  else if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/** Rotates angle cur toward target by at most maxStep radians, shortest direction. Returns the new
 * angle (NOT re-wrapped). Branch-form step clamp — byte-identical to hand-rolled homing steering. */
export function rotateTowards(cur: number, target: number, maxStep: number): number {
  const diff = angleDelta(target, cur);
  const turn = diff > maxStep ? maxStep : diff < -maxStep ? -maxStep : diff;
  return cur + turn;
}
