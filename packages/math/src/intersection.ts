import { Circle } from './circle.js';
import { Rect } from './rect.js';
import type { Vec2 } from './vec2.js';

/** Returns true if point is inside rect (inclusive). */
export function pointInRect(p: Vec2, r: Rect): boolean {
  return Rect.contains(r, p);
}

/** Returns true if point is inside circle (inclusive). */
export function pointInCircle(p: Vec2, c: Circle): boolean {
  return Circle.contains(c, p);
}

/** Returns true if two rects overlap. */
export function rectVsRect(a: Rect, b: Rect): boolean {
  return Rect.intersects(a, b);
}

/** Returns true if rect and circle overlap. */
export function rectVsCircle(r: Rect, c: Circle): boolean {
  return Circle.intersectsRect(c, r);
}

/** Returns true if two circles overlap. */
export function circleVsCircle(a: Circle, b: Circle): boolean {
  return Circle.intersects(a, b);
}

/** Line segment intersection with AABB. Uses Liang-Barsky algorithm. */
export function lineVsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  clipT[0] = 0;
  clipT[1] = 1;
  // Same four edges, in the same order, as the Liang-Barsky form this replaced.
  return (
    clipEdge(-dx, x1 - r.x) &&
    clipEdge(dx, r.x + r.width - x1) &&
    clipEdge(-dy, y1 - r.y) &&
    clipEdge(dy, r.y + r.height - y1) &&
    (clipT[0] as number) <= (clipT[1] as number)
  );
}

// [tMin, tMax] for lineVsRect; module scratch so the test allocates nothing (it never re-enters).
const clipT = new Float64Array(2);

function clipEdge(p: number, q: number): boolean {
  if (Math.abs(p) < 1e-12) return !(q < 0); // parallel to this edge; written so a NaN q passes, as before
  const t = q / p;
  if (p < 0) {
    if (t > (clipT[1] as number)) return false;
    if (t > (clipT[0] as number)) clipT[0] = t;
  } else {
    if (t < (clipT[0] as number)) return false;
    if (t < (clipT[1] as number)) clipT[1] = t;
  }
  return true;
}

/** Line segment intersection with circle. */
export function lineVsCircle(x1: number, y1: number, x2: number, y2: number, c: Circle): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - c.x;
  const fy = y1 - c.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - c.radius * c.radius;

  // Zero-length segment: just a point-in-circle test
  if (a < 1e-12) {
    return cc <= 0;
  }

  let discriminant = b * b - 4 * a * cc;
  if (discriminant < 0) return false;

  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  // Check if any intersection is within segment [0, 1]
  if (t1 >= 0 && t1 <= 1) return true;
  if (t2 >= 0 && t2 <= 1) return true;
  // Segment fully inside circle
  if (t1 < 0 && t2 > 1) return true;

  return false;
}

/**
 * Ray intersection with AABB. Returns t (distance in units of the direction's
 * length) or null if no hit. A ray starting inside returns the exit distance.
 *
 * Edges are inclusive: a ray that only touches an edge or corner hits, and an
 * axis-parallel ray running exactly along an edge hits. A zero direction
 * (`dirX === 0 && dirY === 0`) returns null.
 */
export function rayVsRect(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  r: Rect,
): number | null {
  if (dirX === 0 && dirY === 0) return null;

  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;

  // A zero component never leaves its slab: the origin decides, and dividing
  // would give 0 * Infinity = NaN for an origin exactly on the slab edge.
  if (dirX === 0) {
    if (originX < r.x || originX > r.x + r.width) return null;
  } else {
    const invDx = 1 / dirX;
    const tx1 = (r.x - originX) * invDx;
    const tx2 = (r.x + r.width - originX) * invDx;
    tMin = Math.min(tx1, tx2);
    tMax = Math.max(tx1, tx2);
  }

  if (dirY === 0) {
    if (originY < r.y || originY > r.y + r.height) return null;
  } else {
    const invDy = 1 / dirY;
    const ty1 = (r.y - originY) * invDy;
    const ty2 = (r.y + r.height - originY) * invDy;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
  }

  if (tMax < 0 || tMin > tMax) return null;

  return tMin >= 0 ? tMin : tMax;
}

/**
 * Is `p` on the segment `a`→`b`? Assumes neither is degenerate.
 */
function pointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  if ((px - ax) * (by - ay) - (py - ay) * (bx - ax) !== 0) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dot < 0) return false;
  const len2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  return dot <= len2;
}

/**
 * Do two segments intersect, including collinear overlap?
 *
 * The companion to `segmentIntersection`: that returns *where* two segments
 * cross and is `null` when there is no single crossing point, which includes
 * collinear segments lying on top of each other. Those genuinely do intersect,
 * so a caller who only needs the yes/no answer asks here instead.
 */
export function segmentsIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): boolean {
  const d1x = x2 - x1;
  const d1y = y2 - y1;
  const d2x = x4 - x3;
  const d2y = y4 - y3;
  const denom = d1x * d2y - d1y * d2x;
  const ex = x3 - x1;
  const ey = y3 - y1;

  if (denom === 0) {
    // A zero-length segment makes both `denom` and the collinearity test
    // trivially 0, so it would otherwise be judged collinear with everything
    // and then overlap-tested on one axis while the other is ignored.
    const aPoint = d1x === 0 && d1y === 0;
    const bPoint = d2x === 0 && d2y === 0;
    if (aPoint && bPoint) return x1 === x3 && y1 === y3;
    if (aPoint) return pointOnSegment(x1, y1, x3, y3, x4, y4);
    if (bPoint) return pointOnSegment(x3, y3, x1, y1, x2, y2);
    // Parallel. Collinear only if the offset between origins is parallel too.
    if (ex * d1y - ey * d1x !== 0) return false;
    // Collinear: overlap iff the projected intervals overlap. Project onto the
    // dominant axis to stay exact for vertical segments.
    const useX = Math.abs(d1x) >= Math.abs(d1y);
    const aMin = useX ? Math.min(x1, x2) : Math.min(y1, y2);
    const aMax = useX ? Math.max(x1, x2) : Math.max(y1, y2);
    const bMin = useX ? Math.min(x3, x4) : Math.min(y3, y4);
    const bMax = useX ? Math.max(x3, x4) : Math.max(y3, y4);
    return aMin <= bMax && bMin <= aMax;
  }

  const t = (ex * d2y - ey * d2x) / denom;
  const u = (ex * d1y - ey * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Where two segments cross, written into `out`.
 *
 * Returns `null` when there is no **single** crossing point — segments that miss
 * each other, are parallel, or are collinear. Collinear overlap is the case
 * worth knowing about: the segments do intersect, at infinitely many points, so
 * there is no one answer to write into `out`. Use `segmentsIntersect` when the
 * yes/no answer is what you need.
 *
 * `out` is left untouched when the result is `null`.
 */
export function segmentIntersectionInto(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
  out: Vec2,
): Vec2 | null {
  const d1x = x2 - x1;
  const d1y = y2 - y1;
  const d2x = x4 - x3;
  const d2y = y4 - y3;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) {
    // A degenerate segment lying on the other one *does* have a unique
    // intersection — itself — so answer it rather than reporting no hit.
    const aPoint = d1x === 0 && d1y === 0;
    const bPoint = d2x === 0 && d2y === 0;
    if (aPoint && !bPoint && pointOnSegment(x1, y1, x3, y3, x4, y4)) {
      out.x = x1;
      out.y = y1;
      return out;
    }
    if (bPoint && !aPoint && pointOnSegment(x3, y3, x1, y1, x2, y2)) {
      out.x = x3;
      out.y = y3;
      return out;
    }
    if (aPoint && bPoint && x1 === x3 && y1 === y3) {
      out.x = x1;
      out.y = y1;
      return out;
    }
    return null; // parallel, or collinear with no unique point
  }

  const ex = x3 - x1;
  const ey = y3 - y1;
  const t = (ex * d2y - ey * d2x) / denom;
  if (t < 0 || t > 1) return null;
  const u = (ex * d1y - ey * d1x) / denom;
  if (u < 0 || u > 1) return null;

  out.x = x1 + t * d1x;
  out.y = y1 + t * d1y;
  return out;
}

/**
 * Where two segments cross. Allocates — see `segmentIntersectionInto` for the
 * hot path.
 */
export function segmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): Vec2 | null {
  return segmentIntersectionInto(x1, y1, x2, y2, x3, y3, x4, y4, { x: 0, y: 0 });
}
