import type { Query } from './query.js';
import type { World } from './world.js';

/** A system function that processes entities matching a query. */
export type SystemFn = (query: Query, dt: number, world: World) => void;

/** A defined system with its query and function. */
export interface SystemDef {
  readonly query: Query;
  readonly fn: SystemFn;
  /** The wrapper registered on the World (used for removal). */
  readonly _worldFn: (world: World, dt: number) => void;
}

/**
 * Define a system that processes entities matching a query.
 *
 * Returns a SystemDef that can be added to a World via world.addSystem().
 * The system function receives the query's matching entities, dt, and world.
 *
 * Usage:
 *   const q = world.query(Position, Velocity);
 *   const moveSys = defineSystem(q, (query, dt, world) => {
 *     const ids = query.entities;
 *     for (let i = 0; i < ids.length; i++) { const id = ids[i]!; ... }
 *   });
 *   world.addSystem(moveSys._worldFn);
 *
 * Walk `query.entities` by index — that is the zero-alloc form. `for...of`
 * over the query works too but allocates an iterator per loop (and, on
 * Hermes, a result object per entity), which per system per frame is exactly
 * what a system must not do.
 */
export function defineSystem(query: Query, fn: SystemFn): SystemDef {
  const worldFn = (world: World, dt: number) => {
    fn(query, dt, world);
  };
  return { query, fn, _worldFn: worldFn };
}
