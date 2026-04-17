import { describe, expect, it } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp } from '../components';
import type { SpawnCtx } from '../spawn';
import { spawnBoss } from '../spawn';
import { createStubAtlas } from '../test-utils';
import { computeBossStatus, updateBoss } from './boss';

function makeCtx(): { world: World; ctx: SpawnCtx } {
  const world = new World();
  const coll = new CollisionWorld();
  return { world, ctx: { world, coll, atlas: createStubAtlas() } };
}

const BOUNDS = { width: 360, height: 640 };

describe('boss FSM', () => {
  it('starts in entering phase', () => {
    const { world, ctx } = makeCtx();
    const id = spawnBoss(ctx, 180, -40, 40);
    const bossQuery = world.query(Boss);
    const status = computeBossStatus(world, bossQuery);
    expect(status.alive).toBe(true);
    expect(status.phase).toBe('entering');
    expect(status.invulnerable).toBe(true);
    expect(status.hp).toBe(40);
    void id;
  });

  it('transitions to phase1 when reaching target y', () => {
    const { world, ctx } = makeCtx();
    const id = spawnBoss(ctx, 180, 70, 40);
    const bossQuery = world.query(Boss);
    const calls: string[] = [];

    // integrate manually — updateBoss only sets velocity
    const boss = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (!boss || !pos) throw new Error('missing');

    // move boss position past target to trigger phase1
    pos.y = boss.targetY + 1;
    updateBoss(world, 0.016, {
      spawnCtx: ctx,
      query: bossQuery,
      playerX: 180,
      playerY: 600,
      bounds: BOUNDS,
      onPhaseChange: (p) => calls.push(p),
    });

    const status = computeBossStatus(world, bossQuery);
    expect(status.phase).toBe('phase1');
    expect(calls).toContain('phase1');
  });

  it('transitions from phase1 to phase2 at 50% hp', () => {
    const { world, ctx } = makeCtx();
    const id = spawnBoss(ctx, 180, 100, 40);
    const bossQuery = world.query(Boss);
    const boss = world.get(id, Boss);
    const hp = world.get(id, Hp);
    if (!boss || !hp) throw new Error('missing');
    boss.phase = 'phase1';
    hp.current = 20;
    const calls: string[] = [];

    updateBoss(world, 0.016, {
      spawnCtx: ctx,
      query: bossQuery,
      playerX: 180,
      playerY: 600,
      bounds: BOUNDS,
      onPhaseChange: (p) => calls.push(p),
    });

    expect(computeBossStatus(world, bossQuery).phase).toBe('phase2');
    expect(calls).toContain('phase2');
  });

  it('enters dying when hp hits zero', () => {
    const { world, ctx } = makeCtx();
    const id = spawnBoss(ctx, 180, 100, 40);
    const bossQuery = world.query(Boss);
    const boss = world.get(id, Boss);
    const hp = world.get(id, Hp);
    if (!boss || !hp) throw new Error('missing');
    boss.phase = 'phase2';
    hp.current = 0;

    updateBoss(world, 0.016, {
      spawnCtx: ctx,
      query: bossQuery,
      playerX: 180,
      playerY: 600,
      bounds: BOUNDS,
    });

    expect(computeBossStatus(world, bossQuery).phase).toBe('dying');
  });

  it('reports defeated when no boss exists', () => {
    const { world } = makeCtx();
    const bossQuery = world.query(Boss);
    const status = computeBossStatus(world, bossQuery);
    expect(status.alive).toBe(false);
    expect(status.phase).toBe('defeated');
  });
});
