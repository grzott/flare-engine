let _scratch = new Float32Array(32);

/**
 * One Sutherland-Hodgman pass: keep the part of the polygon where `sign * (coordinate - limit)`
 * is not negative, `axis` 0 being x and 1 being y. Returns the vertex count written to `dst`.
 */
function clipHalfPlane(
  src: Float32Array,
  n: number,
  dst: Float32Array,
  axis: 0 | 1,
  limit: number,
  sign: number,
): number {
  if (n === 0) return 0;
  let m = 0;
  let px = src[(n - 1) * 2]!;
  let py = src[(n - 1) * 2 + 1]!;
  let pd = sign * ((axis === 0 ? px : py) - limit);
  for (let i = 0; i < n; i++) {
    const cx = src[i * 2]!;
    const cy = src[i * 2 + 1]!;
    const cd = sign * ((axis === 0 ? cx : cy) - limit);
    // A vertex on the boundary counts as inside and is kept as it is, so an edge that only
    // touches the boundary adds no second copy of it.
    if ((pd > 0 && cd < 0) || (pd < 0 && cd > 0)) {
      const t = pd / (pd - cd);
      dst[m * 2] = axis === 0 ? limit : px + (cx - px) * t;
      dst[m * 2 + 1] = axis === 1 ? limit : py + (cy - py) * t;
      m++;
    }
    if (cd >= 0) {
      dst[m * 2] = cx;
      dst[m * 2 + 1] = cy;
      m++;
    }
    px = cx;
    py = cy;
    pd = cd;
  }
  return m;
}

/**
 * Clip a convex polygon to the unit square (Sutherland-Hodgman). `src` holds `n` vertices as
 * x, y pairs; the result is written to `out` in the same winding and its vertex count returned.
 * Fewer than 3 means nothing of the polygon is left. Vertices that were inside keep their exact
 * values, and new ones lie exactly on the edge they were cut by.
 *
 * Clipping can add one vertex per edge of the square, so `out` needs room for `n + 4` vertices;
 * throws a `RangeError` when it is shorter. `out` must not be `src`.
 */
export function clipPolygonToUnitInto(src: Float32Array, n: number, out: Float32Array): number {
  const room = (n + 4) * 2;
  if (out.length < room) {
    throw new RangeError(
      `clipPolygonToUnitInto: out needs ${room} numbers for ${n} vertices, got ${out.length}`,
    );
  }
  // Grows only when a polygon has more vertices than any clipped before it.
  if (_scratch.length < room) _scratch = new Float32Array(room);
  let m = clipHalfPlane(src, n, _scratch, 0, 0, 1);
  m = clipHalfPlane(_scratch, m, out, 0, 1, -1);
  m = clipHalfPlane(out, m, _scratch, 1, 0, 1);
  return clipHalfPlane(_scratch, m, out, 1, 1, -1);
}
