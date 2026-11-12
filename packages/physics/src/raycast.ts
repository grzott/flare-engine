import type { Vec2 } from '@flare-engine/math';
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

/** Scratch record `raycast()` hands to `rayVsShapeInto` per candidate. */
const scratchHit: RaycastHit = {
  entity: -1,
  distance: 0,
  point: { x: 0, y: 0 },
  normal: { x: 0, y: 0 },
};

/**
 * Cast a ray against a list of targets. Returns the closest hit, or null.
 *
 * The returned hit is a fresh object — the caller may keep it; later calls do
 * not overwrite it. Among targets at equal distance the first in `targets` wins.
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
  // Every later hit overwrites the scratch, so the best candidate so far is
  // held in locals and only the winner becomes an object.
  let found = false;
  let entity = -1;
  let distance = 0;
  let px = 0;
  let py = 0;
  let nx = 0;
  let ny = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    const hit = rayVsShapeInto(ox, oy, dx, dy, maxDist, t.entity, t.shape, t.x, t.y, scratchHit);
    if (hit !== null && (!found || hit.distance < distance)) {
      found = true;
      entity = hit.entity;
      distance = hit.distance;
      px = hit.point.x;
      py = hit.point.y;
      nx = hit.normal.x;
      ny = hit.normal.y;
    }
  }

  if (!found) return null;
  return { entity, distance, point: { x: px, y: py }, normal: { x: nx, y: ny } };
}

/**
 * Zero-alloc ray-vs-shape test: writes into `out` and returns it, or returns
 * `null` without touching `out`.
 *
 * This is the single implementation of the ray math. `raycast()` above and
 * `CollisionWorld.raycast` both run every candidate through it into a scratch
 * record, so neither allocates per candidate tested.
 */
export function rayVsShapeInto(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  entity: number,
  shape: Shape,
  x: number,
  y: number,
  out: RaycastHit,
): RaycastHit | null {
  if (shape.type === 'aabb') {
    return rayVsAABBInto(ox, oy, dx, dy, maxDist, entity, x, y, shape.hw, shape.hh, out);
  }
  return rayVsCircleInto(ox, oy, dx, dy, maxDist, entity, x, y, shape.radius, out);
}

function rayVsAABBInto(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  entity: number,
  bx: number,
  by: number,
  hw: number,
  hh: number,
  out: RaycastHit,
): RaycastHit | null {
  if (dx === 0 && dy === 0) return null;

  // A ray parallel to an axis never crosses that slab's planes: it is inside
  // the slab for all t or for none. Scaling by an infinite inverse instead
  // gives 0 * Infinity = NaN when the origin sits exactly on a plane.
  let tMinX = Number.NEGATIVE_INFINITY;
  let tMaxX = Number.POSITIVE_INFINITY;
  if (dx === 0) {
    if (ox < bx - hw || ox > bx + hw) return null;
  } else {
    const invDx = 1 / dx;
    const tx1 = (bx - hw - ox) * invDx;
    const tx2 = (bx + hw - ox) * invDx;
    tMinX = Math.min(tx1, tx2);
    tMaxX = Math.max(tx1, tx2);
  }

  let tMinY = Number.NEGATIVE_INFINITY;
  let tMaxY = Number.POSITIVE_INFINITY;
  if (dy === 0) {
    if (oy < by - hh || oy > by + hh) return null;
  } else {
    const invDy = 1 / dy;
    const ty1 = (by - hh - oy) * invDy;
    const ty2 = (by + hh - oy) * invDy;
    tMinY = Math.min(ty1, ty2);
    tMaxY = Math.max(ty1, ty2);
  }

  const tMin = Math.max(tMinX, tMinY);
  const tMax = Math.min(tMaxX, tMaxY);
  if (tMax < 0 || tMin > tMax) return null;

  const t = tMin < 0 ? tMax : tMin;
  if (t > maxDist || t < 0) return null;

  out.entity = entity;
  out.distance = t;
  out.point.x = ox + dx * t;
  out.point.y = oy + dy * t;
  if (tMinX > tMinY) {
    out.normal.x = dx < 0 ? 1 : -1;
    out.normal.y = 0;
  } else {
    out.normal.x = 0;
    out.normal.y = dy < 0 ? 1 : -1;
  }
  return out;
}

function rayVsCircleInto(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  entity: number,
  cx: number,
  cy: number,
  radius: number,
  out: RaycastHit,
): RaycastHit | null {
  const fx = ox - cx;
  const fy = oy - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null; // Zero-length direction

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  let t = (-b - sqrtDisc) / (2 * a);
  // If the entry point is behind the origin, try the exit point.
  if (t < 0) t = (-b + sqrtDisc) / (2 * a);
  if (t < 0 || t > maxDist) return null;

  const px = ox + dx * t;
  const py = oy + dy * t;
  const nx = px - cx;
  const ny = py - cy;
  const len = Math.sqrt(nx * nx + ny * ny);

  out.entity = entity;
  out.distance = t;
  out.point.x = px;
  out.point.y = py;
  out.normal.x = len > 0 ? nx / len : 0;
  out.normal.y = len > 0 ? ny / len : 0;
  return out;
}
