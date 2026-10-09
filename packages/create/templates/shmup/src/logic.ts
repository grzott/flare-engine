/**
 * Shmup game logic — RN/Skia-free core.
 *
 * This module contains ZERO React or Skia imports so it can be unit-tested
 * in a plain bun/node environment without mocking any native modules.
 *
 * Design decisions:
 *   - Position objects are pooled (pre-allocated) so fireBullet/spawnEnemy
 *     never create heap garbage in steady state.
 *   - Velocity and Sprite are shared singleton references stored once on
 *     each entity; mutating them would affect all entities of that type.
 *   - Queries are registered once in createShmupState (World.query() is
 *     permanent — never call it inside a frame update).
 *   - hitBullets/hitEnemies scratch arrays are grow-only (length=0 reset
 *     each call, never re-allocated once grown to peak frame size).
 *   - world.step(dt) is NOT called here — the shell's onUpdate must call it
 *     before stepShmup so movement and bounds-cull run first.
 */
import {
  type CullBounds,
  Position,
  Velocity,
  createBoundsCullSystem,
  createMovementSystem,
  defineComponent,
} from '@flare-engine/ecs';
import type { Query, World } from '@flare-engine/ecs';
import type { SpriteData } from '@flare-engine/render';
import { Sprite } from '@flare-engine/render';

// ─── Tag components ──────────────────────────────────────────────────────────

/** Marks an entity as a player bullet. */
export const Bullet = defineComponent('Bullet');

/** Marks an entity as an enemy. */
export const Enemy = defineComponent('Enemy');

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bullet travel speed in px/s (upward). */
export const BULLET_SPEED = 420;
/** Enemy travel speed in px/s (downward). */
export const ENEMY_SPEED = 80;
/** Seconds between shots. */
export const FIRE_INTERVAL = 0.12;
/** Seconds between enemy spawns. */
export const SPAWN_INTERVAL = 1.4;
/** Maximum live bullets (bounds the pool size). */
export const MAX_BULLETS = 64;
/** Maximum live enemies (bounds the pool size). */
export const MAX_ENEMIES = 16;

/** AABB half-extents for collision detection (pixels). */
export const BULLET_HW = 3;
export const BULLET_HH = 6;
export const ENEMY_HW = 12;
export const ENEMY_HH = 12;

/** Deterministic spawn X positions across a ~320 px wide screen. */
const SPAWN_XS = [24, 72, 120, 168, 216, 264, 312] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Mutable version of CullBounds so the shell can resize after layout. */
export interface ShmupBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Handle returned by setupShmup. */
export interface ShmupSetup {
  /** Live screen bounds for the cull system — mutate after layout. */
  bounds: ShmupBounds;
  /**
   * Ref the shell MUST populate after createShmupState so the onCull
   * callback can return Positions to the right pool.
   */
  stateRef: { current: ShmupState | null };
}

/** All mutable game state for one shmup session. */
export interface ShmupState {
  /** Pre-allocated Position free-list for bullets. */
  bulletPool: Array<{ x: number; y: number }>;
  /** Pre-allocated Position free-list for enemies. */
  enemyPool: Array<{ x: number; y: number }>;
  /** Shared velocity applied to every bullet entity. */
  readonly bulletVel: { x: number; y: number };
  /** Shared velocity applied to every enemy entity. */
  readonly enemyVel: { x: number; y: number };
  /** Shared SpriteData reference reused for every bullet entity. */
  readonly bulletSprite: SpriteData;
  /** Shared SpriteData reference reused for every enemy entity. */
  readonly enemySprite: SpriteData;
  /** Seconds elapsed since the last bullet was fired. */
  fireTimer: number;
  /** Seconds elapsed since the last enemy was spawned. */
  spawnTimer: number;
  /** Total enemies destroyed this session. */
  score: number;
  /** Permanent ECS query for (Position, Bullet) — created once, never inside onUpdate. */
  readonly bulletQuery: Query;
  /** Permanent ECS query for (Position, Enemy) — created once, never inside onUpdate. */
  readonly enemyQuery: Query;
  /** Incremented each spawn to cycle through SPAWN_XS deterministically. */
  spawnCounter: number;
  /** Scratch: bullet IDs involved in this frame's collisions — grow-only, reused. */
  readonly hitBullets: number[];
  /** Scratch: enemy IDs involved in this frame's collisions — grow-only, reused. */
  readonly hitEnemies: number[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true when two axis-aligned boxes overlap (inclusive edge-touch).
 *
 * Parameters are center positions and half-extents (px).
 */
export function aabbOverlap(
  ax: number, ay: number, ahw: number, ahh: number,
  bx: number, by: number, bhw: number, bhh: number,
): boolean {
  return Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Register the movement and bounds-cull world systems, then return a handle
 * so the shell can size the bounds to the viewport and wire up the state pool.
 *
 * Usage in onReady:
 *   const { bounds, stateRef } = setupShmup(ctx.world);
 *   // optionally: bounds.maxX = camera.viewportWidth; ...
 *   const state = createShmupState(ctx.world, bulletSprite, enemySprite);
 *   stateRef.current = state;     ← REQUIRED before the first frame runs
 */
export function setupShmup(world: World): ShmupSetup {
  const moveSys = createMovementSystem(world);
  world.addSystem(moveSys._worldFn, 0); // priority 0: integrate positions first

  // Sensible defaults for a portrait phone; shell mutates after layout if needed.
  const bounds: ShmupBounds = { minX: -32, minY: -64, maxX: 432, maxY: 900 };

  // Forward reference so onCull can access pools even though state is created after setup.
  const stateRef: { current: ShmupState | null } = { current: null };

  const cullSys = createBoundsCullSystem(
    world,
    bounds as CullBounds,
    (id, w) => {
      const state = stateRef.current;
      if (state === null) return;

      // Return pooled Position before destroying; player has neither tag → skip.
      if (w.has(id, Bullet)) {
        const pos = w.get(id, Position);
        if (pos !== undefined) state.bulletPool.push(pos);
        w.destroy(id);
      } else if (w.has(id, Enemy)) {
        const pos = w.get(id, Position);
        if (pos !== undefined) state.enemyPool.push(pos);
        w.destroy(id);
      }
    },
  );
  world.addSystem(cullSys._worldFn, 2); // priority 2: cull after movement

  return { bounds, stateRef };
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Allocate all mutable game state and register permanent ECS queries.
 *
 * Call ONCE in onReady, after setupShmup, then assign the result to
 * stateRef.current so the cull callback can return pooled Positions.
 */
export function createShmupState(
  world: World,
  bulletSprite: SpriteData,
  enemySprite: SpriteData,
): ShmupState {
  // Pre-allocate Position free-lists — no heap writes during play.
  const bulletPool: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < MAX_BULLETS; i++) bulletPool.push({ x: 0, y: 0 });

  const enemyPool: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < MAX_ENEMIES; i++) enemyPool.push({ x: 0, y: 0 });

  return {
    bulletPool,
    enemyPool,
    bulletVel: { x: 0, y: -BULLET_SPEED },
    enemyVel: { x: 0, y: ENEMY_SPEED },
    bulletSprite,
    enemySprite,
    fireTimer: 0,
    spawnTimer: 0,
    score: 0,
    // Registered here and never re-created — World.query() is permanent.
    bulletQuery: world.query(Position, Bullet),
    enemyQuery: world.query(Position, Enemy),
    spawnCounter: 0,
    hitBullets: [],
    hitEnemies: [],
  };
}

// ─── Per-entity helpers ───────────────────────────────────────────────────────

/**
 * Fire one bullet from the pool at (x, y).
 *
 * Zero heap allocation: Position is taken from the pre-allocated bulletPool;
 * Velocity and Sprite are stored as shared references (no copy).
 * Silently skips when the pool is exhausted — no throw, no new allocation.
 */
export function fireBullet(
  world: World,
  state: ShmupState,
  x: number,
  y: number,
  sprite: SpriteData,
): void {
  const pos = state.bulletPool.pop();
  if (pos === undefined) return; // pool exhausted — skip silently

  pos.x = x;
  pos.y = y;
  const id = world.spawn();
  world.add(id, Position, pos);
  world.add(id, Velocity, state.bulletVel); // shared ref — no copy
  world.add(id, Sprite, sprite);            // shared ref — no copy
  world.add(id, Bullet);
}

/**
 * Spawn one enemy from the pool at (x, -16) moving downward.
 *
 * Zero heap allocation: same discipline as fireBullet.
 */
export function spawnEnemy(
  world: World,
  state: ShmupState,
  x: number,
  sprite: SpriteData,
): void {
  const pos = state.enemyPool.pop();
  if (pos === undefined) return; // pool exhausted — skip silently

  pos.x = x;
  pos.y = -16; // spawn above the visible area
  const id = world.spawn();
  world.add(id, Position, pos);
  world.add(id, Velocity, state.enemyVel); // shared ref
  world.add(id, Sprite, sprite);           // shared ref
  world.add(id, Enemy);
}

// ─── Frame update ─────────────────────────────────────────────────────────────

/**
 * Advance game logic for one frame.
 *
 * Fires bullets and spawns enemies on timers, detects bullet-enemy AABB
 * collisions, destroys hits, returns pooled Positions, and returns the
 * number of new kills.
 *
 * No per-frame object literals or `new` expressions in this module.
 * (Iterating an engine Query allocates a short-lived iterator on Hermes —
 *  an engine detail, not template garbage.)
 * Other hot-path facts:
 *   - hitBullets/hitEnemies reset via `.length = 0` (no free/alloc)
 *   - Pool push reuses pre-allocated array capacity
 *
 * Calling order per onUpdate frame (shell responsibility):
 *   1. Move player in-place from joystick input
 *   2. ctx.world.step(dt)   ← run movement + bounds-cull systems
 *   3. stepShmup(...)        ← fire, spawn, detect collisions
 */
export function stepShmup(
  world: World,
  state: ShmupState,
  dt: number,
  playerX: number,
  playerY: number,
): number {
  // ── Fire bullets ────────────────────────────────────────────────────────────
  state.fireTimer += dt;
  while (state.fireTimer >= FIRE_INTERVAL) {
    state.fireTimer -= FIRE_INTERVAL;
    fireBullet(world, state, playerX, playerY - 16, state.bulletSprite);
  }

  // ── Spawn enemies (deterministic x, NOT Math.random) ────────────────────────
  state.spawnTimer += dt;
  if (state.spawnTimer >= SPAWN_INTERVAL) {
    state.spawnTimer -= SPAWN_INTERVAL;
    const spawnX = SPAWN_XS[state.spawnCounter % SPAWN_XS.length] ?? SPAWN_XS[0]!;
    state.spawnCounter++;
    spawnEnemy(world, state, spawnX, state.enemySprite);
  }

  // ── Collect bullet-enemy collision pairs ────────────────────────────────────
  // Reset scratch arrays without freeing — grow-only, zero steady-state alloc.
  state.hitBullets.length = 0;
  state.hitEnemies.length = 0;

  // Indexed walk over the live id arrays: `for...of` over a Query allocates an
  // iterator per loop (and, on Hermes, a result object per entity), and this
  // nest would pay that once per bullet per frame.
  const bulletIds = state.bulletQuery.entities;
  const enemyIds = state.enemyQuery.entities;
  for (let b = 0; b < bulletIds.length; b++) {
    const bId = bulletIds[b]!;
    const bPos = world.get(bId, Position);
    if (bPos === undefined) continue;
    for (let e = 0; e < enemyIds.length; e++) {
      const eId = enemyIds[e]!;
      const ePos = world.get(eId, Position);
      if (ePos === undefined) continue;
      if (aabbOverlap(bPos.x, bPos.y, BULLET_HW, BULLET_HH, ePos.x, ePos.y, ENEMY_HW, ENEMY_HH)) {
        state.hitBullets.push(bId);
        state.hitEnemies.push(eId);
        break; // one bullet can only hit one enemy per frame
      }
    }
  }

  // ── Destroy hits AFTER the query loops (no mid-iteration splice) ────────────
  let kills = 0;
  for (let i = 0; i < state.hitBullets.length; i++) {
    const bId = state.hitBullets[i]!;
    const eId = state.hitEnemies[i]!;
    if (world.exists(bId)) {
      const bPos = world.get(bId, Position);
      if (bPos !== undefined) state.bulletPool.push(bPos);
      world.destroy(bId);
    }
    if (world.exists(eId)) {
      const ePos = world.get(eId, Position);
      if (ePos !== undefined) state.enemyPool.push(ePos);
      world.destroy(eId);
      kills++;
    }
  }

  state.score += kills;
  return kills;
}
