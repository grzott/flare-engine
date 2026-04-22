export interface Direction2D {
  x: number;
  y: number;
}

/**
 * Normalize (dx, dy) to magnitude `speed` into `out`. Zero-alloc.
 */
export function normalizeDirection(
  dx: number,
  dy: number,
  speed: number,
  out: Direction2D,
): Direction2D {
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const inv = speed / len;
  out.x = dx * inv;
  out.y = dy * inv;
  return out;
}
