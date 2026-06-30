import type { Vec2 } from '@flare-engine/math';
import { defineComponent } from './component.js';

/**
 * Built-in ECS components using @flare-engine/math types.
 */

/** 2D position component. */
export const Position = defineComponent<Vec2>('Position', () => ({
  x: 0,
  y: 0,
}));

/** 2D velocity component. */
export const Velocity = defineComponent<Vec2>('Velocity', () => ({
  x: 0,
  y: 0,
}));

/** Rotation in radians. */
export const Rotation = defineComponent<{ angle: number }>('Rotation', () => ({
  angle: 0,
}));

/** 2D scale component. */
export const Scale = defineComponent<Vec2>('Scale', () => ({ x: 1, y: 1 }));

/** Parent entity reference. */
export const Parent = defineComponent<{ entity: number }>('Parent', () => ({
  entity: 0,
}));

/** Countdown timer in seconds; entity expires when remaining reaches 0. */
export const Lifetime = defineComponent<{ remaining: number }>('Lifetime', () => ({
  remaining: 0,
}));

/** Pins an entity's position to a target entity plus a fixed offset. */
export const Follower = defineComponent<{ target: number; offsetX: number; offsetY: number }>(
  'Follower',
  () => ({ target: 0, offsetX: 0, offsetY: 0 }),
);
