import type { Vec2 } from '@flare/math';
import type { Shape } from './shape.js';

/** Result of a raycast hit. */
export interface RaycastHit {
  /** The entity that was hit. */
  entity: number;
  /** Distance from ray origin to hit point. */
  distance: number;
  /** World-space hit point. */
  point: Vec2;
  /** Surface normal at hit point. */
  normal: Vec2;
}

/** Entity entry for raycast — position + shape. */
export interface RaycastTarget {
  entity: number;
  shape: Shape;
  x: number;
  y: number;
}

/**
 * Cast a ray against a list of targets. Returns the closest hit, or null.
 * @param ox Ray origin X
 * @param oy Ray origin Y
 * @param dx Ray direction X (should be normalized)
 * @param dy Ray direction Y (should be normalized)
 * @param maxDist Maximum raycast distance
 * @param targets Array of entities to test against
 */
export function raycast(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  targets: readonly RaycastTarget[],
): RaycastHit | null {
  let closest: RaycastHit | null = null;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    const hit = rayVsShape(ox, oy, dx, dy, maxDist, t);
    if (hit && (closest === null || hit.distance < closest.distance)) {
      closest = hit;
    }
  }

  return closest;
}

function rayVsShape(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  target: RaycastTarget,
): RaycastHit | null {
  if (target.shape.type === 'aabb') {
    return rayVsAABB(
      ox,
      oy,
      dx,
      dy,
      maxDist,
      target.entity,
      target.x,
      target.y,
      target.shape.hw,
      target.shape.hh,
    );
  }
  return rayVsCircle(
    ox,
    oy,
    dx,
    dy,
    maxDist,
    target.entity,
    target.x,
    target.y,
    target.shape.radius,
  );
}

function rayVsAABB(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  entity: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): RaycastHit | null {
  const minX = cx - hw;
  const maxX = cx + hw;
  const minY = cy - hh;
  const maxY = cy + hh;

  const invDx = dx !== 0 ? 1 / dx : dx >= 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  const invDy = dy !== 0 ? 1 / dy : dy >= 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  const tx1 = (minX - ox) * invDx;
  const tx2 = (maxX - ox) * invDx;
  const ty1 = (minY - oy) * invDy;
  const ty2 = (maxY - oy) * invDy;

  const tMinX = Math.min(tx1, tx2);
  const tMaxX = Math.max(tx1, tx2);
  const tMinY = Math.min(ty1, ty2);
  const tMaxY = Math.max(ty1, ty2);

  const tMin = Math.max(tMinX, tMinY);
  const tMax = Math.min(tMaxX, tMaxY);

  if (tMax < 0 || tMin > tMax || tMin > maxDist) return null;

  const t = tMin >= 0 ? tMin : tMax;
  if (t > maxDist || t < 0) return null;

  const px = ox + dx * t;
  const py = oy + dy * t;

  // Compute normal
  let nx = 0;
  let ny = 0;
  if (tMinX > tMinY) {
    nx = dx < 0 ? 1 : -1;
  } else {
    ny = dy < 0 ? 1 : -1;
  }

  return {
    entity,
    distance: t,
    point: { x: px, y: py },
    normal: { x: nx, y: ny },
  };
}

function rayVsCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  entity: number,
  cx: number,
  cy: number,
  radius: number,
): RaycastHit | null {
  const fx = ox - cx;
  const fy = oy - cy;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  if (a < 1e-12) return null; // Zero-length direction

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  let t = (-b - sqrtDisc) / (2 * a);

  // If entry point is behind, try exit point
  if (t < 0) {
    t = (-b + sqrtDisc) / (2 * a);
  }
  if (t < 0 || t > maxDist) return null;

  const px = ox + dx * t;
  const py = oy + dy * t;
  const nx = px - cx;
  const ny = py - cy;
  const len = Math.sqrt(nx * nx + ny * ny);

  return {
    entity,
    distance: t,
    point: { x: px, y: py },
    normal: len > 0 ? { x: nx / len, y: ny / len } : { x: 0, y: 0 },
  };
}
