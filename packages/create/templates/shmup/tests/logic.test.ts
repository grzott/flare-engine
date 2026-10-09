/**
 * Headless tests for the shmup logic module.
 *
 * No Skia, no React Native — just a real World and the pure game logic.
 * This is the "old shmup leaked Positions / new shmup pools them" proof.
 *
 * World.query() registers permanent queries — do NOT call _resetComponentIds()
 * here; component IDs are module-level and stable across the whole test run.
 */
import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import type { SpriteData } from '@flare-engine/render';
import {
  BULLET_HH,
  BULLET_HW,
  BULLET_SPEED,
  ENEMY_HH,
  ENEMY_HW,
  MAX_BULLETS,
  MAX_ENEMIES,
  aabbOverlap,
  createShmupState,
  fireBullet,
  setupShmup,
  spawnEnemy,
  stepShmup,
} from '../src/logic';

// Fake SpriteData — logic.ts stores the reference but never accesses fields.
const FAKE_SPRITE = {} as unknown as SpriteData;

// ─── aabbOverlap ─────────────────────────────────────────────────────────────

describe('aabbOverlap', () => {
  test('true when boxes overlap', () => {
    // A: center (0,0) hw=5 hh=5; B: center (3,3) hw=5 hh=5 — clearly overlapping
    expect(aabbOverlap(0, 0, 5, 5, 3, 3, 5, 5)).toBe(true);
  });

  test('false when boxes are clearly separated', () => {
    // A: center (0,0) hw=5; B: center (20,0) hw=5 — gap of 10
    expect(aabbOverlap(0, 0, 5, 5, 20, 0, 5, 5)).toBe(false);
  });

  test('true on edge-touch (inclusive boundary)', () => {
    // A right edge at 0+5=5; B left edge at 10-5=5 → touching, inclusive → true
    expect(aabbOverlap(0, 0, 5, 5, 10, 0, 5, 5)).toBe(true);
  });

  test('false just outside touch boundary', () => {
    // x-distance = 11, sum of hw = 10 → separated
    expect(aabbOverlap(0, 0, 5, 5, 11, 0, 5, 5)).toBe(false);
  });
});

// ─── AABB constants sanity ────────────────────────────────────────────────────

describe('AABB constants', () => {
  test('BULLET_HW / BULLET_HH are positive', () => {
    expect(BULLET_HW).toBeGreaterThan(0);
    expect(BULLET_HH).toBeGreaterThan(0);
  });

  test('ENEMY_HW / ENEMY_HH are positive', () => {
    expect(ENEMY_HW).toBeGreaterThan(0);
    expect(ENEMY_HH).toBeGreaterThan(0);
  });

  test('bullet and enemy at same center overlap', () => {
    expect(aabbOverlap(0, 0, BULLET_HW, BULLET_HH, 0, 0, ENEMY_HW, ENEMY_HH)).toBe(true);
  });

  test('BULLET_SPEED is positive', () => {
    expect(BULLET_SPEED).toBeGreaterThan(0);
  });
});

// ─── fireBullet pool behaviour ────────────────────────────────────────────────

describe('fireBullet', () => {
  test('bullet query count rises after firing', () => {
    const world = new World();
    const { stateRef } = setupShmup(world);
    const state = createShmupState(world, FAKE_SPRITE, FAKE_SPRITE);
    stateRef.current = state;

    fireBullet(world, state, 100, 400, FAKE_SPRITE);
    fireBullet(world, state, 100, 400, FAKE_SPRITE);
    fireBullet(world, state, 100, 400, FAKE_SPRITE);

    let count = 0;
    for (const _ of state.bulletQuery) count++;
    expect(count).toBe(3);
  });

  test('bullets culled at top bound — query empties, pool fully returned (no leak)', () => {
    // This is the fail-old / pass-new proof: the old shmup never returned
    // Positions to a pool; the new one does so in the cull callback.
    const world = new World();
    const { bounds, stateRef } = setupShmup(world);
    const state = createShmupState(world, FAKE_SPRITE, FAKE_SPRITE);
    stateRef.current = state;

    // Cull anything above y = 0 (bullets travel upward).
    bounds.minY = 0;
    bounds.maxY = 1000;
    bounds.minX = -1000;
    bounds.maxX = 1000;

    // Fire 4 bullets from y = 10.
    // BULLET_SPEED px/s upward; dt = 0.1 → dy = -42 → new y = -32 < minY = 0 → culled.
    for (let i = 0; i < 4; i++) fireBullet(world, state, 100, 10, FAKE_SPRITE);

    let countBefore = 0;
    for (const _ of state.bulletQuery) countBefore++;
    expect(countBefore).toBe(4);
    expect(state.bulletPool.length).toBe(MAX_BULLETS - 4);

    // world.step runs: movement (priority 0) → cull (priority 2).
    world.step(0.1);

    let countAfter = 0;
    for (const _ of state.bulletQuery) countAfter++;
    expect(countAfter).toBe(0); // all culled

    // All Positions must be back in the pool — zero leak.
    expect(state.bulletPool.length).toBe(MAX_BULLETS);
  });

  test('pool exhaustion silently skips — no throw, count stays at cap', () => {
    const world = new World();
    const { stateRef } = setupShmup(world);
    const state = createShmupState(world, FAKE_SPRITE, FAKE_SPRITE);
    stateRef.current = state;

    for (let i = 0; i < MAX_BULLETS; i++) fireBullet(world, state, 100, 400, FAKE_SPRITE);
    expect(state.bulletPool.length).toBe(0);

    // Extra fires must silently no-op — no throw, no new entities.
    expect(() => {
      fireBullet(world, state, 100, 400, FAKE_SPRITE);
      fireBullet(world, state, 100, 400, FAKE_SPRITE);
    }).not.toThrow();

    let count = 0;
    for (const _ of state.bulletQuery) count++;
    expect(count).toBe(MAX_BULLETS); // unchanged
  });
});

// ─── spawnEnemy pool behaviour ────────────────────────────────────────────────

describe('spawnEnemy', () => {
  test('enemy pool exhaustion silently skips', () => {
    const world = new World();
    const { stateRef } = setupShmup(world);
    const state = createShmupState(world, FAKE_SPRITE, FAKE_SPRITE);
    stateRef.current = state;

    for (let i = 0; i < MAX_ENEMIES; i++) spawnEnemy(world, state, 100, FAKE_SPRITE);
    expect(state.enemyPool.length).toBe(0);

    expect(() => spawnEnemy(world, state, 100, FAKE_SPRITE)).not.toThrow();

    let count = 0;
    for (const _ of state.enemyQuery) count++;
    expect(count).toBe(MAX_ENEMIES);
  });
});

// ─── Collision and score ──────────────────────────────────────────────────────

describe('stepShmup collision', () => {
  test('bullet-enemy overlap destroys both, increments score, returns pools', () => {
    const world = new World();
    const { bounds, stateRef } = setupShmup(world);
    // Wide bounds so nothing is culled during this test.
    bounds.minX = -9999; bounds.maxX = 9999;
    bounds.minY = -9999; bounds.maxY = 9999;

    const state = createShmupState(world, FAKE_SPRITE, FAKE_SPRITE);
    stateRef.current = state;

    // Spawn a bullet and an enemy.
    fireBullet(world, state, 100, 100, FAKE_SPRITE);
    spawnEnemy(world, state, 100, FAKE_SPRITE); // enemy starts at y=-16

    // Move the enemy to the bullet's y so they overlap.
    // world.get with the live Position ComponentDef (same module-cache entry).
    let enemyId: number | undefined;
    for (const id of state.enemyQuery) { enemyId = id; break; }
    expect(enemyId).not.toBeUndefined();

    const ePos = world.get(enemyId!, Position);
    expect(ePos).not.toBeUndefined();
    ePos!.y = 100; // bullet is at (100, 100); now enemy is too

    // With dt = 0.001: fireTimer stays below FIRE_INTERVAL, spawnTimer stays
    // below SPAWN_INTERVAL → only collision detection runs.
    const kills = stepShmup(world, state, 0.001, 0, 900);

    expect(kills).toBe(1);
    expect(state.score).toBe(1);

    // Both entities destroyed.
    let bCount = 0;
    for (const _ of state.bulletQuery) bCount++;
    expect(bCount).toBe(0);

    let eCount = 0;
    for (const _ of state.enemyQuery) eCount++;
    expect(eCount).toBe(0);

    // Positions returned to pools — zero leak.
    expect(state.bulletPool.length).toBe(MAX_BULLETS);
    expect(state.enemyPool.length).toBe(MAX_ENEMIES);
  });

  test('non-overlapping bullet and enemy produce zero kills', () => {
    const world = new World();
    const { bounds, stateRef } = setupShmup(world);
    bounds.minX = -9999; bounds.maxX = 9999;
    bounds.minY = -9999; bounds.maxY = 9999;

    const state = createShmupState(world, FAKE_SPRITE, FAKE_SPRITE);
    stateRef.current = state;

    fireBullet(world, state, 100, 100, FAKE_SPRITE);
    spawnEnemy(world, state, 300, FAKE_SPRITE); // far away in x

    const kills = stepShmup(world, state, 0.001, 0, 900);
    expect(kills).toBe(0);
    expect(state.score).toBe(0);
  });
});
