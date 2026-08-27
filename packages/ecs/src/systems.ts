import { Follower, Lifetime, Position, Velocity } from './components.js';
import type { Query } from './query.js';
import type { SystemDef } from './system.js';
import { defineSystem } from './system.js';
import type { World } from './world.js';

/**
 * Plain camera-space bounding box used by createBoundsCullSystem.
 * Keep plain numbers — do NOT import physics AABB/Bounds (layer inversion).
 */
export interface CullBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * createMovementSystem — integrates Position by Velocity * dt each frame.
 *
 * Recommended priority: run BEFORE createFollowerSystem (0).
 */
export function createMovementSystem(world: World): SystemDef {
  const q = world.query(Position, Velocity);
  return defineSystem(q, (entities, dt, w) => {
    for (const id of entities) {
      const pos = w.get(id, Position)!;
      const vel = w.get(id, Velocity)!;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
    }
  });
}

/**
 * createLifetimeSystem — decrements Lifetime.remaining each frame.
 * Entities whose remaining reaches <= 0 are collected, then onExpire is called
 * for each AFTER the read loop.
 *
 * Deferred removal: destroying inside a live for…of over query.entities splices
 * the array mid-iteration and would skip entities. Collect first, act after.
 *
 * The scratch array is closure-owned and grow-only — zero steady-state alloc.
 *
 * @param onExpire  Destroy / pool policy — ecs never destroys on its own.
 * @param query     Optional caller-supplied Query. When omitted the system
 *                  registers world.query(Lifetime) itself. Pass a narrower
 *                  query to avoid scanning unrelated Lifetime holders and to
 *                  share an already-registered query (eliminates duplicate
 *                  World.query registration cost).
 */
export function createLifetimeSystem(
  world: World,
  onExpire: (entity: number, world: World) => void,
  query?: Query,
): SystemDef {
  const q = query ?? world.query(Lifetime);
  const scratch: number[] = [];
  return defineSystem(q, (entities, dt, w) => {
    scratch.length = 0;
    for (const id of entities) {
      const life = w.get(id, Lifetime)!;
      life.remaining -= dt;
      if (life.remaining <= 0) {
        scratch.push(id);
      }
    }
    for (let i = 0; i < scratch.length; i++) {
      onExpire(scratch[i]!, w);
    }
  });
}

/**
 * createBoundsCullSystem — culls entities whose Position falls outside bounds.
 * Reads bounds LIVE each frame so callers can mutate it to follow a camera.
 * Entities outside are collected, then onCull is called for each after the read loop.
 *
 * Deferred removal: same splice-during-iteration reason as createLifetimeSystem.
 *
 * Recommended priority: run AFTER createMovementSystem and createFollowerSystem.
 *
 * @param bounds   Mutable bounding box read each frame.
 * @param onCull   Destroy / pool policy — ecs never destroys on its own.
 * @param query    Optional caller-supplied Query. When omitted the system
 *                 registers world.query(Position) itself, scanning all
 *                 Position holders. Pass a narrower query (e.g. bullets
 *                 only) to avoid scanning unrelated entities such as
 *                 scrolling backgrounds, and to share an already-registered
 *                 query with the caller.
 */
export function createBoundsCullSystem(
  world: World,
  bounds: CullBounds,
  onCull: (entity: number, world: World) => void,
  query?: Query,
): SystemDef {
  const q = query ?? world.query(Position);
  const scratch: number[] = [];
  return defineSystem(q, (entities, _dt, w) => {
    scratch.length = 0;
    for (const id of entities) {
      const pos = w.get(id, Position)!;
      if (
        pos.x < bounds.minX ||
        pos.x > bounds.maxX ||
        pos.y < bounds.minY ||
        pos.y > bounds.maxY
      ) {
        scratch.push(id);
      }
    }
    for (let i = 0; i < scratch.length; i++) {
      onCull(scratch[i]!, w);
    }
  });
}

/**
 * createFollowerSystem — pins each Follower entity's Position to
 * target.Position + (offsetX, offsetY).
 * If the target is gone or has no Position, the entity is silently skipped.
 *
 * Recommended priority: run AFTER createMovementSystem (1) so the target's
 * position is already integrated before the follower snaps to it.
 */
export function createFollowerSystem(world: World): SystemDef {
  const q = world.query(Position, Follower);
  return defineSystem(q, (entities, _dt, w) => {
    for (const id of entities) {
      const follower = w.get(id, Follower)!;
      const t = w.get(follower.target, Position);
      if (t === undefined) continue;
      const pos = w.get(id, Position)!;
      pos.x = t.x + follower.offsetX;
      pos.y = t.y + follower.offsetY;
    }
  });
}

/**
 * createOrphanCullSystem — fires onOrphan for each Follower whose target entity
 * no longer exists. Does NOT move or destroy anything itself.
 *
 * Split from createFollowerSystem so games that want to orphan-cull can opt in
 * without coupling destruction to the follower pin logic.
 *
 * Recommended priority: run AFTER createFollowerSystem (2) so the follower is
 * pinned before orphans are detected.
 *
 * Deferred removal: same splice-during-iteration reason as createLifetimeSystem.
 *
 * @param onOrphan  Called once per orphaned entity after the read loop.
 */
export function createOrphanCullSystem(
  world: World,
  onOrphan: (entity: number, world: World) => void,
): SystemDef {
  const q = world.query(Follower);
  const scratch: number[] = [];
  return defineSystem(q, (entities, _dt, w) => {
    scratch.length = 0;
    for (const id of entities) {
      const follower = w.get(id, Follower)!;
      if (!w.exists(follower.target)) {
        scratch.push(id);
      }
    }
    for (let i = 0; i < scratch.length; i++) {
      onOrphan(scratch[i]!, w);
    }
  });
}
