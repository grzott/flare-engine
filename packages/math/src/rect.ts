import type { Vec2 } from './vec2.js';

/** Axis-aligned bounding box. */
export type Rect = { x: number; y: number; width: number; height: number };

export const Rect = {
  /** Returns true if point is inside rect (inclusive). */
  contains(r: Rect, p: Vec2): boolean {
    return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  },

  /** Returns true if two rects overlap (share area). */
  intersects(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    );
  },

  /** Returns the overlapping rect, or null if no overlap. */
  intersection(a: Rect, b: Rect): Rect | null {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    if (right <= x || bottom <= y) return null;
    return { x, y, width: right - x, height: bottom - y };
  },

  /** Returns the smallest rect containing both rects. */
  union(a: Rect, b: Rect): Rect {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);
    return { x, y, width: right - x, height: bottom - y };
  },

  /** Creates a rect from an array of points (bounding box). */
  fromPoints(points: readonly Vec2[]): Rect {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = points[0]!.x;
    let minY = points[0]!.y;
    let maxX = minX;
    let maxY = minY;
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  },

  /** Returns the center point of the rect. */
  center(r: Rect): Vec2 {
    return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
  },

  /** Returns a new rect expanded by amount on each side. */
  expand(r: Rect, amount: number): Rect {
    return {
      x: r.x - amount,
      y: r.y - amount,
      width: r.width + amount * 2,
      height: r.height + amount * 2,
    };
  },
} as const;
