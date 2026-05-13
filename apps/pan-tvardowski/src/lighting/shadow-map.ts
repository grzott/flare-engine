/**
 * 1D polar shadow map — CPU-side reduction (PT lighting §2b).
 *
 * Algorithm: for each of `SHADOW_ANGLES` directions from the light,
 * cast a ray and find the minimum distance to any occluder rect.
 * The result is a Float32Array of length `SHADOW_ANGLES` where each
 * entry is the distance to the nearest occluder in that angular bucket.
 *
 * Reference: LWJGL 2D Pixel-Perfect Shadows
 * (https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows)
 *
 * FBO_SIZE fallback note: if the shadow shader fails to compile on target
 * devices (GLES2 driver with very low uniform ceiling), halve FBO_SIZE to 128
 * and set SHADOW_ANGLES = 128 before retrying.
 */

/** Angular resolution of the shadow map (number of buckets = number of rays). */
export const SHADOW_ANGLES = 256;

/** Side length of the conceptual FBO used to bound rays (px). */
export const FBO_SIZE = 256;

/**
 * Axis-aligned bounding rectangle for an occluder.
 * All coordinates are in the same space as the light position (screen-space px).
 */
export interface OccluderRect {
  /** Left edge (min X). */
  readonly x: number;
  /** Top edge (min Y). */
  readonly y: number;
  /** Width (px). */
  readonly w: number;
  /** Height (px). */
  readonly h: number;
}

/**
 * Ray–AABB intersection: returns the distance along `(dx, dy)` (unit vector)
 * at which the ray from `(ox, oy)` first enters the rectangle, or `Infinity`
 * if it never hits.
 *
 * Uses the slab method. Only positive-t (forward) intersections are returned.
 */
export function rayRectIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  rect: OccluderRect,
): number {
  const invDx = dx === 0 ? Number.POSITIVE_INFINITY : 1 / dx;
  const invDy = dy === 0 ? Number.POSITIVE_INFINITY : 1 / dy;

  const tx1 = (rect.x - ox) * invDx;
  const tx2 = (rect.x + rect.w - ox) * invDx;
  const ty1 = (rect.y - oy) * invDy;
  const ty2 = (rect.y + rect.h - oy) * invDy;

  const tMin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
  const tMax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));

  if (tMax < 0 || tMin > tMax) return Number.POSITIVE_INFINITY;
  return tMin >= 0 ? tMin : tMax;
}

/**
 * Build the 1D polar shadow map.
 *
 * For each angular bucket `i` (angle = `i / SHADOW_ANGLES * 2π - π`), cast a
 * ray from `(lightX, lightY)` and record the minimum occluder-entry distance
 * clamped to `[0, maxDist]`. When `occluders` is empty every bucket is
 * `maxDist`.
 *
 * @param out       Pre-allocated Float32Array of length `angles` — mutated in place.
 * @param occluders Bounding-rect list (3-element pre-allocated array for Smok).
 * @param lightX    Light position X (screen-space px).
 * @param lightY    Light position Y (screen-space px).
 * @param angles    Number of angular buckets (default SHADOW_ANGLES = 256).
 * @param maxDist   Maximum ray distance; defaults to FBO_SIZE.
 */
export function buildShadowMap(
  out: Float32Array,
  occluders: readonly OccluderRect[],
  lightX: number,
  lightY: number,
  angles: number = SHADOW_ANGLES,
  maxDist: number = FBO_SIZE,
): void {
  const TWO_PI = 2 * Math.PI;
  for (let i = 0; i < angles; i++) {
    const theta = (i / angles) * TWO_PI - Math.PI;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);

    let minDist = maxDist;
    for (let j = 0; j < occluders.length; j++) {
      const rect = occluders[j] as OccluderRect;
      const d = rayRectIntersect(lightX, lightY, dx, dy, rect);
      if (d < minDist) minDist = d;
    }
    out[i] = minDist;
  }
}

/**
 * Sample the shadow map at a given angle.
 *
 * Converts the angle (radians, range [-π, π]) to a bucket index and returns
 * the stored distance. Wraps correctly at ±π.
 *
 * @param map    Shadow map Float32Array of length `angles`.
 * @param angle  Query angle in radians (−π … π). Values outside the range are
 *               wrapped via modular arithmetic.
 * @param angles Number of buckets (must match the length of `map`).
 * @returns      Distance to nearest occluder at that angle.
 */
export function sampleShadowMap(map: Float32Array, angle: number, angles: number): number {
  const TWO_PI = 2 * Math.PI;
  // Normalise angle to [0, 1).
  let norm = (angle + Math.PI) / TWO_PI;
  // Wrap to [0, 1) handling floating-point imprecision.
  norm = norm - Math.floor(norm);
  const idx = Math.min(Math.floor(norm * angles), angles - 1);
  return map[idx] as number;
}

/**
 * Encode the 1D shadow map as a packed RGBA Uint8Array suitable for uploading
 * to a 256×1 texture via `renderShapesToImage`.
 *
 * Each distance value is normalised to [0, 255] as a single-channel value
 * stored in the red channel; green/blue/alpha are 0/0/255.
 *
 * The encoded range is [0, maxDist]. Values beyond maxDist clamp to 255.
 *
 * @param out     Pre-allocated Uint8Array of length `angles * 4` — mutated in place.
 * @param map     Shadow map Float32Array of length `angles`.
 * @param angles  Bucket count.
 * @param maxDist Normalisation ceiling (should match the `maxDist` passed to `buildShadowMap`).
 */
export function encodeShadowMap(
  out: Uint8Array,
  map: Float32Array,
  angles: number,
  maxDist: number,
): void {
  for (let i = 0; i < angles; i++) {
    const d = (map[i] as number) / maxDist;
    const encoded = Math.min(255, Math.round(d * 255));
    const base = i * 4;
    out[base] = encoded; // R — distance
    out[base + 1] = 0; // G
    out[base + 2] = 0; // B
    out[base + 3] = 255; // A — fully opaque
  }
}
