import type { Vec2 } from './vec2.js';

/**
 * Parametric curves — quadratic/cubic Bézier and Catmull-Rom — plus approximate
 * arc length for each.
 *
 * Every sampler comes in two forms, per the repo's hot-path convention: an
 * allocating one returning a fresh `Vec2`, and an `…Into` one writing to a
 * caller-owned buffer. Sampling a path each frame is exactly the case the
 * `…Into` forms exist for.
 *
 * Control points are passed as loose numbers rather than `Vec2` objects so a
 * caller holding coordinates in a `Float32Array` — the documented storage for
 * bulk numeric data — can sample without building temporaries first.
 */

/** Quadratic Bézier at `t`, writing into `out`. `t` is clamped to [0, 1]. */
export function bezier2Into(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  t: number,
  out: Vec2,
): Vec2 {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const v = 1 - u;
  // Expanded Bernstein form: two multiplies fewer than nested lerps, and no
  // intermediate points to allocate.
  const a = v * v;
  const b = 2 * v * u;
  const c = u * u;
  out.x = a * p0x + b * p1x + c * p2x;
  out.y = a * p0y + b * p1y + c * p2y;
  return out;
}

/** Quadratic Bézier at `t`. Allocates — see `bezier2Into` for the hot path. */
export function bezier2(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  t: number,
): Vec2 {
  return bezier2Into(p0x, p0y, p1x, p1y, p2x, p2y, t, { x: 0, y: 0 });
}

/** Cubic Bézier at `t`, writing into `out`. `t` is clamped to [0, 1]. */
export function bezier3Into(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
  out: Vec2,
): Vec2 {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const v = 1 - u;
  const vv = v * v;
  const uu = u * u;
  const a = vv * v;
  const b = 3 * vv * u;
  const c = 3 * v * uu;
  const d = uu * u;
  out.x = a * p0x + b * p1x + c * p2x + d * p3x;
  out.y = a * p0y + b * p1y + c * p2y + d * p3y;
  return out;
}

/** Cubic Bézier at `t`. Allocates — see `bezier3Into` for the hot path. */
export function bezier3(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
): Vec2 {
  return bezier3Into(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t, { x: 0, y: 0 });
}

/**
 * Centripetal-free (uniform) Catmull-Rom spline at `t`, writing into `out`.
 *
 * The curve passes **through** `p1` and `p2`; `p0` and `p3` are the neighbouring
 * control points that set the tangents, and `t` runs from `p1` (0) to `p2` (1).
 * That interpolating property is the reason to reach for this over a Bézier when
 * a path must hit its waypoints exactly.
 */
export function catmullRomInto(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
  out: Vec2,
): Vec2 {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const uu = u * u;
  const uuu = uu * u;
  out.x =
    0.5 *
    (2 * p1x +
      (-p0x + p2x) * u +
      (2 * p0x - 5 * p1x + 4 * p2x - p3x) * uu +
      (-p0x + 3 * p1x - 3 * p2x + p3x) * uuu);
  out.y =
    0.5 *
    (2 * p1y +
      (-p0y + p2y) * u +
      (2 * p0y - 5 * p1y + 4 * p2y - p3y) * uu +
      (-p0y + 3 * p1y - 3 * p2y + p3y) * uuu);
  return out;
}

/** Catmull-Rom at `t`. Allocates — see `catmullRomInto` for the hot path. */
export function catmullRom(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
): Vec2 {
  return catmullRomInto(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t, { x: 0, y: 0 });
}

/** Scratch buffer for the length helpers — they are not reentrant, which is
 *  fine because they do not call user code. */
const _scratch: Vec2 = { x: 0, y: 0 };

/**
 * Approximate arc length by sampling `segments` chords.
 *
 * Always an **underestimate**: a chord is the shortest path between its
 * endpoints, so a polyline through the curve is never longer than the curve.
 * Error falls roughly with the square of `segments`; 16 is a reasonable default
 * for UI paths, more for anything a camera follows closely.
 */
export function bezier2Length(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  segments = 16,
): number {
  const n = segments < 1 ? 1 : segments | 0;
  let total = 0;
  let px = p0x;
  let py = p0y;
  for (let i = 1; i <= n; i++) {
    bezier2Into(p0x, p0y, p1x, p1y, p2x, p2y, i / n, _scratch);
    total += Math.hypot(_scratch.x - px, _scratch.y - py);
    px = _scratch.x;
    py = _scratch.y;
  }
  return total;
}

/** Approximate arc length of a cubic Bézier. See `bezier2Length`. */
export function bezier3Length(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  segments = 16,
): number {
  const n = segments < 1 ? 1 : segments | 0;
  let total = 0;
  let px = p0x;
  let py = p0y;
  for (let i = 1; i <= n; i++) {
    bezier3Into(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, i / n, _scratch);
    total += Math.hypot(_scratch.x - px, _scratch.y - py);
    px = _scratch.x;
    py = _scratch.y;
  }
  return total;
}

/**
 * Approximate arc length of the Catmull-Rom span between `p1` and `p2`.
 * See `bezier2Length` for the accuracy note.
 */
export function catmullRomLength(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  segments = 16,
): number {
  const n = segments < 1 ? 1 : segments | 0;
  let total = 0;
  let px = p1x;
  let py = p1y;
  for (let i = 1; i <= n; i++) {
    catmullRomInto(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, i / n, _scratch);
    total += Math.hypot(_scratch.x - px, _scratch.y - py);
    px = _scratch.x;
    py = _scratch.y;
  }
  return total;
}
