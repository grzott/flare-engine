import { approxEquals } from './scalar.js';

/** Vec2 plain object type — no class, no GC pressure. */
export type Vec2 = { x: number; y: number };

/** Creates a Vec2 plain object. */
export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

// ─── Static namespace ───────────────────────────────────────────

export const Vec2 = {
  /** Returns { 0, 0 }. */
  zero(): Vec2 {
    return { x: 0, y: 0 };
  },
  /** Returns { 1, 1 }. */
  one(): Vec2 {
    return { x: 1, y: 1 };
  },
  /** Returns { 0, -1 }. */
  up(): Vec2 {
    return { x: 0, y: -1 };
  },
  /** Returns { 0, 1 }. */
  down(): Vec2 {
    return { x: 0, y: 1 };
  },
  /** Returns { -1, 0 }. */
  left(): Vec2 {
    return { x: -1, y: 0 };
  },
  /** Returns { 1, 0 }. */
  right(): Vec2 {
    return { x: 1, y: 0 };
  },

  /** Component-wise addition. Writes into out if provided. */
  add(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
    if (out) {
      out.x = a.x + b.x;
      out.y = a.y + b.y;
      return out;
    }
    return { x: a.x + b.x, y: a.y + b.y };
  },

  /** Component-wise subtraction a - b. */
  sub(a: Vec2, b: Vec2, out?: Vec2): Vec2 {
    if (out) {
      out.x = a.x - b.x;
      out.y = a.y - b.y;
      return out;
    }
    return { x: a.x - b.x, y: a.y - b.y };
  },

  /** Scales a vector by a scalar. */
  scale(v: Vec2, s: number, out?: Vec2): Vec2 {
    if (out) {
      out.x = v.x * s;
      out.y = v.y * s;
      return out;
    }
    return { x: v.x * s, y: v.y * s };
  },

  /** Returns a unit vector. Returns zero vector if length is 0. */
  normalize(v: Vec2, out?: Vec2): Vec2 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) {
      if (out) {
        out.x = 0;
        out.y = 0;
        return out;
      }
      return { x: 0, y: 0 };
    }
    const inv = 1 / len;
    if (out) {
      out.x = v.x * inv;
      out.y = v.y * inv;
      return out;
    }
    return { x: v.x * inv, y: v.y * inv };
  },

  /** Dot product. */
  dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
  },

  /** 2D cross product (z-component of the 3D cross). */
  cross(a: Vec2, b: Vec2): number {
    return a.x * b.y - a.y * b.x;
  },

  /** Linearly interpolates between a and b (unclamped). */
  lerp(a: Vec2, b: Vec2, t: number, out?: Vec2): Vec2 {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },

  /** Spherical linear interpolation for unit vectors. */
  slerp(a: Vec2, b: Vec2, t: number, out?: Vec2): Vec2 {
    let d = a.x * b.x + a.y * b.y;
    // Clamp dot to [-1, 1] for numerical safety
    d = d < -1 ? -1 : d > 1 ? 1 : d;
    const theta = Math.acos(d);
    if (theta < 1e-6) {
      return Vec2.lerp(a, b, t, out);
    }
    const sinTheta = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sinTheta;
    const wb = Math.sin(t * theta) / sinTheta;
    const x = a.x * wa + b.x * wb;
    const y = a.y * wa + b.y * wb;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },

  /** Euclidean distance between two points. */
  distance(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /** Squared distance (avoids sqrt). */
  distanceSq(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  },

  /** Length of a vector. */
  length(v: Vec2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },

  /** Squared length (avoids sqrt). */
  lengthSq(v: Vec2): number {
    return v.x * v.x + v.y * v.y;
  },

  /** Angle of vector in radians (atan2). */
  angle(v: Vec2): number {
    return Math.atan2(v.y, v.x);
  },

  /** Rotates a vector by angle (radians) around origin. */
  rotate(v: Vec2, angle: number, out?: Vec2): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = v.x * c - v.y * s;
    const y = v.x * s + v.y * c;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  },

  /** Component-wise approximate equality. */
  equals(a: Vec2, b: Vec2, epsilon = 1e-6): boolean {
    return approxEquals(a.x, b.x, epsilon) && approxEquals(a.y, b.y, epsilon);
  },

  /** Returns a copy of the vector. */
  clone(v: Vec2): Vec2 {
    return { x: v.x, y: v.y };
  },

  /** Clamps the length of a vector to maxLength. */
  clampLength(v: Vec2, maxLength: number, out?: Vec2): Vec2 {
    const lenSq = v.x * v.x + v.y * v.y;
    if (lenSq <= maxLength * maxLength) {
      if (out) {
        out.x = v.x;
        out.y = v.y;
        return out;
      }
      return { x: v.x, y: v.y };
    }
    const len = Math.sqrt(lenSq);
    const inv = maxLength / len;
    if (out) {
      out.x = v.x * inv;
      out.y = v.y * inv;
      return out;
    }
    return { x: v.x * inv, y: v.y * inv };
  },
} as const;
