import type { Vec2 } from './vec2.js';

/** 2D transform: position, rotation (radians), and scale. */
export type Transform2D = {
  position: Vec2;
  rotation: number;
  scale: Vec2;
};

export const Transform2D = {
  /** Creates an identity transform. */
  identity(): Transform2D {
    return { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
  },

  /** Creates a transform from components. */
  create(x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1): Transform2D {
    return {
      position: { x, y },
      rotation,
      scale: { x: scaleX, y: scaleY },
    };
  },

  /** Transforms a local-space point to world-space. */
  localToWorld(t: Transform2D, point: Vec2): Vec2 {
    const c = Math.cos(t.rotation);
    const s = Math.sin(t.rotation);
    const sx = point.x * t.scale.x;
    const sy = point.y * t.scale.y;
    return {
      x: sx * c - sy * s + t.position.x,
      y: sx * s + sy * c + t.position.y,
    };
  },

  /** Transforms a world-space point to local-space. */
  worldToLocal(t: Transform2D, point: Vec2): Vec2 {
    const dx = point.x - t.position.x;
    const dy = point.y - t.position.y;
    const c = Math.cos(-t.rotation);
    const s = Math.sin(-t.rotation);
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    return {
      x: t.scale.x !== 0 ? rx / t.scale.x : 0,
      y: t.scale.y !== 0 ? ry / t.scale.y : 0,
    };
  },

  /** Returns a copy of the transform. */
  clone(t: Transform2D): Transform2D {
    return {
      position: { x: t.position.x, y: t.position.y },
      rotation: t.rotation,
      scale: { x: t.scale.x, y: t.scale.y },
    };
  },
} as const;
