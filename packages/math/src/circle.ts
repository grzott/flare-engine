import type { Rect } from './rect.js';
import type { Vec2 } from './vec2.js';

/** Circle shape: center position + radius. */
export type Circle = { x: number; y: number; radius: number };

export const Circle = {
  /** Returns true if point is inside or on the circle. */
  contains(c: Circle, p: Vec2): boolean {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return dx * dx + dy * dy <= c.radius * c.radius;
  },

  /** Returns true if two circles overlap (share area). */
  intersects(a: Circle, b: Circle): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const radSum = a.radius + b.radius;
    return distSq < radSum * radSum;
  },

  /** Returns true if a circle and rect overlap. */
  intersectsRect(c: Circle, r: Rect): boolean {
    // Find closest point on rect to circle center
    const closestX = c.x < r.x ? r.x : c.x > r.x + r.width ? r.x + r.width : c.x;
    const closestY = c.y < r.y ? r.y : c.y > r.y + r.height ? r.y + r.height : c.y;
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return dx * dx + dy * dy <= c.radius * c.radius;
  },
} as const;
