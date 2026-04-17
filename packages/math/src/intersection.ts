import type { Circle } from './circle.js';
import type { Rect } from './rect.js';
import type { Vec2 } from './vec2.js';

/** Returns true if point is inside rect (inclusive). */
export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Returns true if point is inside circle (inclusive). */
export function pointInCircle(p: Vec2, c: Circle): boolean {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return dx * dx + dy * dy <= c.radius * c.radius;
}

/** Returns true if two rects overlap. */
export function rectVsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Returns true if rect and circle overlap. */
export function rectVsCircle(r: Rect, c: Circle): boolean {
  const closestX = c.x < r.x ? r.x : c.x > r.x + r.width ? r.x + r.width : c.x;
  const closestY = c.y < r.y ? r.y : c.y > r.y + r.height ? r.y + r.height : c.y;
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  return dx * dx + dy * dy <= c.radius * c.radius;
}

/** Returns true if two circles overlap. */
export function circleVsCircle(a: Circle, b: Circle): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const radSum = a.radius + b.radius;
  return dx * dx + dy * dy < radSum * radSum;
}

/** Line segment intersection with AABB. Uses Liang-Barsky algorithm. */
export function lineVsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;

  let tMin = 0;
  let tMax = 1;

  // Check each edge
  const edges = [
    { p: -dx, q: x1 - r.x },
    { p: dx, q: r.x + r.width - x1 },
    { p: -dy, q: y1 - r.y },
    { p: dy, q: r.y + r.height - y1 },
  ];

  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-12) {
      // Parallel to edge
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > tMax) return false;
        if (t > tMin) tMin = t;
      } else {
        if (t < tMin) return false;
        if (t < tMax) tMax = t;
      }
    }
  }

  return tMin <= tMax;
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

/** Ray intersection with AABB. Returns t (distance) or null if no hit. */
export function rayVsRect(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  r: Rect,
): number | null {
  const invDx = dirX !== 0 ? 1 / dirX : Number.POSITIVE_INFINITY;
  const invDy = dirY !== 0 ? 1 / dirY : Number.POSITIVE_INFINITY;

  const tx1 = (r.x - originX) * invDx;
  const tx2 = (r.x + r.width - originX) * invDx;
  const ty1 = (r.y - originY) * invDy;
  const ty2 = (r.y + r.height - originY) * invDy;

  const tMin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
  const tMax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));

  if (tMax < 0 || tMin > tMax) return null;

  return tMin >= 0 ? tMin : tMax;
}
