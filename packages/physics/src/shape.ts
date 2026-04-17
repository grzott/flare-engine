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
