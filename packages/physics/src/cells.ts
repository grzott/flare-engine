// Uniform-grid cell arithmetic shared by SpatialIndex and CollisionWorld's
// broadphase. Internal — not exported from the package.

// Uniform grid cell size in world units. Tuned for typical game-object sizes (16–64 px).
const CELL = 64;

// Packed cell-key encoding.  Supports cell coords in [-32768, 32767],
// i.e. world coordinates ±2 097 152.  All keys fit within Number.MAX_SAFE_INTEGER.
const KEY_RANGE = 65536; // 2^16
const KEY_OFFSET = 32768; // 2^15

export function cellKey(cx: number, cy: number): number {
  return (cx + KEY_OFFSET) * KEY_RANGE + (cy + KEY_OFFSET);
}

// Supported cell-coordinate range for the packed key above.
const MIN_CELL = -KEY_OFFSET;
const MAX_CELL = KEY_OFFSET - 1;

// Bounds a derived cell coordinate to the packed-key range. Without this, a
// non-finite world coordinate (±Infinity — an unbounded raycast maxDist, or an
// entity parked at Infinity) makes cxMin/cxMax/cyMin/cyMax infinite, and
// `for (cx = cxMin; cx <= cxMax; cx++)` never exits: once cx itself is
// Infinity, `cx <= Infinity` stays true and `cx++` is a no-op, so the loop
// spins forever pushing/reading the same bucket (unbounded memory growth on
// the link side). NaN is left untouched: every comparison against NaN is
// false, so the loop already runs zero times, which is the existing (safe)
// behaviour for a degenerate direction like `0 * Infinity`.
function clampCell(c: number): number {
  if (c > MAX_CELL) return MAX_CELL;
  if (c < MIN_CELL) return MIN_CELL;
  return c;
}

/** Inclusive first cell, clamped, that contains world coordinate `v`. */
export function cellMin(v: number): number {
  return clampCell(Math.floor(v / CELL));
}

/**
 * Inclusive last cell, clamped, for a range ending at world coordinate `v`.
 * Exclusive-end: a coord falling exactly on a cell boundary is NOT part of the
 * adjacent cell — matches the strict-inequality overlap semantics of a query.
 */
export function cellMax(v: number): number {
  return clampCell(Math.ceil(v / CELL) - 1);
}
