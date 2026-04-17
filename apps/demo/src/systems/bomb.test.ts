import { describe, expect, it } from 'bun:test';
import { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Bullet, Enemy, Hp } from '../components';
import { Layer } from '../layers';
import type { SpawnCtx } from '../spawn';
import { spawnBoss, spawnBullet, spawnEnemy } from '../spawn';
import { createStubAtlas } from '../test-utils';
import { bombFlashAlpha, createBombFlashState, tickBombFlash, tryBomb } from './bomb';

function makeCtx(): { world: World; ctx: SpawnCtx } {
  const world = new World();
  const coll = new CollisionWorld();
  const ctx: SpawnCtx = { world, coll, atlas: createStubAtlas() };
  return { world, ctx };
}

describe('tryBomb', () => {
  it('does nothing when button not pressed', () => {
    const { world, ctx } = makeCtx();
    spawnEnemy(ctx, 'straight', 10, 10);
    const enemyQuery = world.query(Enemy);
    const bulletQuery = world.query(Bullet);
    const bossQuery = world.query(Boss);
    const flash = createBombFlashState();
    const next = tryBomb(world, 3, false, {
      coll: ctx.coll,
      enemyQuery,
      bulletQuery,
      bossQuery,
      flash,
    });
    expect(next).toBe(3);
    expect(enemyQuery.count).toBe(1);
    expect(flash.remaining).toBe(0);
  });

  it('does nothing when no charges remain', () => {
    const { world, ctx } = makeCtx();
    spawnEnemy(ctx, 'straight', 10, 10);
    const enemyQuery = world.query(Enemy);
    const bulletQuery = world.query(Bullet);
    const bossQuery = world.query(Boss);
    const flash = createBombFlashState();
    const next = tryBomb(world, 0, true, {
      coll: ctx.coll,
      enemyQuery,
      bulletQuery,
      bossQuery,
      flash,
    });
    expect(next).toBe(0);
    expect(enemyQuery.count).toBe(1);
    expect(flash.remaining).toBe(0);
  });

  it('clears all enemies and enemy bullets, keeps player bullets', () => {
    const { world, ctx } = makeCtx();
    spawnEnemy(ctx, 'straight', 10, 10);
    spawnEnemy(ctx, 'sine', 50, 20);
    spawnBullet(ctx, 30, 30, 0, 200, Layer.enemy);
    spawnBullet(ctx, 40, 40, 0, -200, Layer.player);
    const enemyQuery = world.query(Enemy);
    const bulletQuery = world.query(Bullet);
    const bossQuery = world.query(Boss);
    const flash = createBombFlashState();

    const next = tryBomb(world, 3, true, {
      coll: ctx.coll,
      enemyQuery,
      bulletQuery,
      bossQuery,
      flash,
    });

    expect(next).toBe(2);
    expect(enemyQuery.count).toBe(0);
    expect(bulletQuery.count).toBe(1);
    let survivor = -1;
    for (const id of bulletQuery) survivor = id;
    const b = world.get(survivor, Bullet);
    expect(b?.ownerLayer).toBe(Layer.player);
    expect(flash.remaining).toBeGreaterThan(0);
  });

  it('applies 25% max HP damage to an active boss', () => {
    const { world, ctx } = makeCtx();
    const bossId = spawnBoss(ctx, 100, 100, 40);
    const boss = world.get(bossId, Boss);
    if (boss) boss.phase = 'phase1';
    const enemyQuery = world.query(Enemy);
    const bulletQuery = world.query(Bullet);
    const bossQuery = world.query(Boss);
    const flash = createBombFlashState();

    tryBomb(world, 3, true, {
      coll: ctx.coll,
      enemyQuery,
      bulletQuery,
      bossQuery,
      flash,
    });

    const hp = world.get(bossId, Hp);
    expect(hp?.current).toBe(30);
  });

  it('does not damage an invulnerable boss (entering)', () => {
    const { world, ctx } = makeCtx();
    const bossId = spawnBoss(ctx, 100, 100, 40);
    const enemyQuery = world.query(Enemy);
    const bulletQuery = world.query(Bullet);
    const bossQuery = world.query(Boss);
    const flash = createBombFlashState();

    tryBomb(world, 3, true, {
      coll: ctx.coll,
      enemyQuery,
      bulletQuery,
      bossQuery,
      flash,
    });

    const hp = world.get(bossId, Hp);
    expect(hp?.current).toBe(40);
  });
});

describe('bomb flash state', () => {
  it('starts at zero alpha', () => {
    const flash = createBombFlashState();
    expect(bombFlashAlpha(flash)).toBe(0);
  });

  it('decays to zero after duration', () => {
    const flash = createBombFlashState();
    flash.remaining = flash.duration;
    expect(bombFlashAlpha(flash)).toBeCloseTo(1);
    tickBombFlash(flash, flash.duration);
    expect(bombFlashAlpha(flash)).toBe(0);
  });

  it('does not go negative', () => {
    const flash = createBombFlashState();
    flash.remaining = 0.1;
    tickBombFlash(flash, 10);
    expect(flash.remaining).toBe(0);
  });
});
