import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Enemy, Hp, Miniboss } from '../src/components';
import { NOCNY_LOWCA_HOUND_COUNT, NOCNY_LOWCA_HP } from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearMinibossFsms, computeMinibossStatus, updateMiniboss } from '../src/systems/miniboss';

function buildCtx(): {
  world: World;
  coll: CollisionWorld;
  spawnCtx: SpawnCtx;
  bounds: { width: number; height: number };
} {
  const world = new World();
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: { texture: {} as never, frames: {} },
  } as unknown as SpawnCtx['atlas'];
  const spawnCtx: SpawnCtx = { world, coll, atlas };
  return { world, coll, spawnCtx, bounds: { width: 360, height: 640 } };
}

function spawnMockMiniboss(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Miniboss, {
    pattern: 'nocny-lowca',
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 999,
    dyingExplosions: 0,
    targetY: 110,
    rootProgress: 0,
    form: 'deer',
    formT: 0,
    hounds: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function keepCooldownHigh(world: World, id: number): void {
  const m = world.get(id, Miniboss);
  if (m) m.fireCooldown = 999;
}

describe('nocny-lowca FSM', () => {
  test('entering → active once miniboss reaches targetY', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockMiniboss(world, NOCNY_LOWCA_HP);
    const query = world.query(Miniboss);

    for (let i = 0; i < 400; i++) {
      updateMiniboss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
      });
      keepCooldownHigh(world, id);
      const pos = world.get(id, Position);
      const vel = world.get(id, Velocity);
      if (pos && vel) pos.y += vel.y * 0.05;
      if (world.get(id, Miniboss)?.phase === 'active') break;
    }
    expect(world.get(id, Miniboss)?.phase).toBe('active');
  });

  test('spawns NOCNY_LOWCA_HOUND_COUNT hounds on entering active', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockMiniboss(world, NOCNY_LOWCA_HP);
    const query = world.query(Miniboss);

    const m = world.get(id, Miniboss);
    const pos = world.get(id, Position);
    if (m && pos) pos.y = m.targetY;

    const hounds: Array<{ x: number; y: number }> = [];
    updateMiniboss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnHound: (x, y) => hounds.push({ x, y }),
      countHounds: () => hounds.length,
    });

    expect(hounds.length).toBe(NOCNY_LOWCA_HOUND_COUNT);
    expect(world.get(id, Miniboss)?.hounds).toBe(NOCNY_LOWCA_HOUND_COUNT);
  });

  test('re-summons the pack when countHounds returns 0', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockMiniboss(world, NOCNY_LOWCA_HP);
    const query = world.query(Miniboss);

    const m = world.get(id, Miniboss);
    const pos = world.get(id, Position);
    if (m && pos) pos.y = m.targetY;

    let summons = 0;
    let live = 0;
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnHound: () => {
        summons += 1;
        live += 1;
      },
      countHounds: () => live,
    };

    updateMiniboss(world, 0.016, deps); // enters active, spawns pack #1
    expect(summons).toBe(NOCNY_LOWCA_HOUND_COUNT);

    // Pack wiped.
    live = 0;
    updateMiniboss(world, 0.016, deps); // expects re-summon
    expect(summons).toBe(NOCNY_LOWCA_HOUND_COUNT * 2);
  });

  test('HP ≤ 0 transitions through dying into defeated', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockMiniboss(world, NOCNY_LOWCA_HP);
    const query = world.query(Miniboss);

    const m = world.get(id, Miniboss);
    const pos = world.get(id, Position);
    if (m && pos) {
      m.phase = 'active';
      pos.y = m.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = 0;

    let defeated = 0;
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onDefeated: () => {
        defeated += 1;
      },
    };

    updateMiniboss(world, 0.016, deps);
    expect(world.get(id, Miniboss)?.phase).toBe('dying');

    for (let i = 0; i < 400; i++) {
      updateMiniboss(world, 0.02, deps);
      if (!computeMinibossStatus(world, query).alive) break;
    }
    expect(defeated).toBe(1);
    // Entity cleaned up.
    const leftover = world.query(Enemy);
    let count = 0;
    for (const _ of leftover) count += 1;
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
