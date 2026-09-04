import type { Rect } from '@flare-engine/math';

/** AABB shape — axis-aligned bounding box. */
export interface AABBShape {
  readonly type: 'aabb';
  /** Half-width. */
  readonly hw: number;
  /** Half-height. */
  readonly hh: number;
}

/** Circle shape. */
export interface CircleShape {
  readonly type: 'circle';
  readonly radius: number;
}

/** Union of supported physics shapes. */
export type Shape = AABBShape | CircleShape;

/** Create an AABB shape from width and height. */
export function AABB(width: number, height: number): AABBShape {
  return { type: 'aabb', hw: width * 0.5, hh: height * 0.5 };
}

/** Create a circle shape from radius. */
export function CircleShape(radius: number): CircleShape {
  return { type: 'circle', radius };
}

/** Compute the bounding rect of a shape at a given position. */
export function shapeBounds(shape: Shape, x: number, y: number): Rect {
  if (shape.type === 'aabb') {
    return { x: x - shape.hw, y: y - shape.hh, width: shape.hw * 2, height: shape.hh * 2 };
  }
  return {
    x: x - shape.radius,
    y: y - shape.radius,
    width: shape.radius * 2,
    height: shape.radius * 2,
  };
}

/** Zero-alloc variant — writes the shape bounds into the provided output rect. */
export function shapeBoundsInto(shape: Shape, x: number, y: number, out: Rect): Rect {
  if (shape.type === 'aabb') {
    out.x = x - shape.hw;
    out.y = y - shape.hh;
    out.width = shape.hw * 2;
    out.height = shape.hh * 2;
    return out;
  }
  out.x = x - shape.radius;
  out.y = y - shape.radius;
  out.width = shape.radius * 2;
  out.height = shape.radius * 2;
  return out;
}

/** Test overlap between two positioned shapes. Returns true if overlapping. */
export function shapeOverlap(
  shapeA: Shape,
  ax: number,
  ay: number,
  shapeB: Shape,
  bx: number,
  by: number,
): boolean {
  if (shapeA.type === 'aabb' && shapeB.type === 'aabb') {
    return aabbVsAabb(ax, ay, shapeA.hw, shapeA.hh, bx, by, shapeB.hw, shapeB.hh);
  }
  if (shapeA.type === 'circle' && shapeB.type === 'circle') {
    return circleVsCircle(ax, ay, shapeA.radius, bx, by, shapeB.radius);
  }
  // Mixed: one AABB, one circle
  if (shapeA.type === 'aabb' && shapeB.type === 'circle') {
    return aabbVsCircle(ax, ay, shapeA.hw, shapeA.hh, bx, by, shapeB.radius);
  }
  return aabbVsCircle(
    bx,
    by,
    (shapeB as AABBShape).hw,
    (shapeB as AABBShape).hh,
    ax,
    ay,
    (shapeA as CircleShape).radius,
  );
}

function aabbVsAabb(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

function circleVsCircle(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const radSum = ar + br;
  return dx * dx + dy * dy < radSum * radSum;
}

function aabbVsCircle(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  cx: number,
  cy: number,
  cr: number,
): boolean {
  const left = ax - ahw;
  const right = ax + ahw;
  const top = ay - ahh;
  const bottom = ay + ahh;
  const closestX = cx < left ? left : cx > right ? right : cx;
  const closestY = cy < top ? top : cy > bottom ? bottom : cy;
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= cr * cr;
}

/**
 * Minimum translation vector: the shortest push that separates two overlapping
 * shapes.
 *
 * `shapeOverlap` answers *whether* two shapes collide and nothing more, which
 * leaves a detection-only consumer with no way to resolve the collision. This is
 * that missing step: `out.x`/`out.y` are a unit axis and `out.depth` is how far
 * along it `b` must move to just stop touching `a`.
 *
 * Returns `null` when the shapes are not overlapping, leaving `out` untouched so
 * a caller may reuse one buffer across many pairs.
 *
 * The degenerate concentric case (identical centres) has no meaningful axis;
 * `(1, 0)` is returned so the caller still gets a usable separation instead of
 * `NaN` from normalising a zero vector.
 */
export interface Overlap {
  /** Unit separation axis, pointing from `a` toward `b`. */
  x: number;
  y: number;
  /** Penetration depth along that axis. */
  depth: number;
}

/** A fresh, zeroed overlap record. Allocate once outside the loop and reuse. */
export function createOverlap(): Overlap {
  return { x: 0, y: 0, depth: 0 };
}

export function overlapInto(
  shapeA: Shape,
  ax: number,
  ay: number,
  shapeB: Shape,
  bx: number,
  by: number,
  out: Overlap,
): Overlap | null {
  if (shapeA.type === 'aabb' && shapeB.type === 'aabb') {
    return aabbAabbOverlap(ax, ay, shapeA.hw, shapeA.hh, bx, by, shapeB.hw, shapeB.hh, out);
  }
  if (shapeA.type === 'circle' && shapeB.type === 'circle') {
    return circleCircleOverlap(ax, ay, shapeA.radius, bx, by, shapeB.radius, out);
  }
  if (shapeA.type === 'aabb' && shapeB.type === 'circle') {
    return aabbCircleOverlap(ax, ay, shapeA.hw, shapeA.hh, bx, by, shapeB.radius, out, false);
  }
  // Circle vs AABB — solve as AABB vs circle, then flip the axis so it still
  // points from `a` to `b`.
  return aabbCircleOverlap(
    bx,
    by,
    (shapeB as AABBShape).hw,
    (shapeB as AABBShape).hh,
    ax,
    ay,
    (shapeA as CircleShape).radius,
    out,
    true,
  );
}

/** Minimum translation vector. Allocates — see `overlapInto` for the hot path. */
export function overlap(
  shapeA: Shape,
  ax: number,
  ay: number,
  shapeB: Shape,
  bx: number,
  by: number,
): Overlap | null {
  return overlapInto(shapeA, ax, ay, shapeB, bx, by, createOverlap());
}

function aabbAabbOverlap(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
  out: Overlap,
): Overlap | null {
  const dx = bx - ax;
  const dy = by - ay;
  const overlapX = ahw + bhw - Math.abs(dx);
  if (overlapX <= 0) return null;
  const overlapY = ahh + bhh - Math.abs(dy);
  if (overlapY <= 0) return null;

  // The minimum translation is along whichever axis is least penetrated.
  if (overlapX < overlapY) {
    out.x = dx < 0 ? -1 : 1;
    out.y = 0;
    out.depth = overlapX;
  } else {
    out.x = 0;
    out.y = dy < 0 ? -1 : 1;
    out.depth = overlapY;
  }
  return out;
}

function circleCircleOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
  out: Overlap,
): Overlap | null {
  const dx = bx - ax;
  const dy = by - ay;
  const radSum = ar + br;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radSum * radSum) return null;

  const dist = Math.sqrt(distSq);
  if (dist === 0) {
    // Concentric: no meaningful axis, so pick one rather than divide by zero.
    out.x = 1;
    out.y = 0;
    out.depth = radSum;
    return out;
  }
  out.x = dx / dist;
  out.y = dy / dist;
  out.depth = radSum - dist;
  return out;
}

function aabbCircleOverlap(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  cx: number,
  cy: number,
  cr: number,
  out: Overlap,
  flip: boolean,
): Overlap | null {
  const left = ax - ahw;
  const right = ax + ahw;
  const top = ay - ahh;
  const bottom = ay + ahh;
  const closestX = cx < left ? left : cx > right ? right : cx;
  const closestY = cy < top ? top : cy > bottom ? bottom : cy;
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > 0) {
    // Centre outside the box: separate along the closest-point normal.
    if (distSq >= cr * cr) return null;
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    out.x = flip ? -nx : nx;
    out.y = flip ? -ny : ny;
    out.depth = cr - dist;
    return out;
  }

  // Centre inside the box: push out through the nearest face.
  const toLeft = cx - left;
  const toRight = right - cx;
  const toTop = cy - top;
  const toBottom = bottom - cy;
  let nx = -1;
  let ny = 0;
  let depth = toLeft;
  if (toRight < depth) {
    nx = 1;
    ny = 0;
    depth = toRight;
  }
  if (toTop < depth) {
    nx = 0;
    ny = -1;
    depth = toTop;
  }
  if (toBottom < depth) {
    nx = 0;
    ny = 1;
    depth = toBottom;
  }
  out.x = flip ? -nx : nx;
  out.y = flip ? -ny : ny;
  out.depth = depth + cr;
  return out;
}
