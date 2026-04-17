import type { Shape } from './shape.js';

/** Collider component data attached to an ECS entity. */
export interface Collider {
  /** The collision shape. */
  shape: Shape;
  /** If true, generates trigger events but no physical response. */
  isTrigger: boolean;
  /** Collision layer bitmask — which layer this collider belongs to. */
  layer: number;
  /** Collision mask — which layers this collider can interact with. */
  mask: number;
}

/** Create a collider with default settings. */
export function createCollider(shape: Shape, opts?: Partial<Omit<Collider, 'shape'>>): Collider {
  return {
    shape,
    isTrigger: opts?.isTrigger ?? false,
    layer: opts?.layer ?? 1,
    mask: opts?.mask ?? 0xffffffff,
  };
}
