import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp } from '../src/components';
import { BOROWY_HP_MAX } from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearBossFsms, updateBoss } from '../src/systems/boss';

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

function spawnMockBoss(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'borowy-krol',
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 999,
    dyingExplosions: 0,
    targetY: 100,
    shieldActive: false,
    minionsAlive: 0,
    shieldDownFor: 0,
    summonsSpawned: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function keepCooldownHigh(world: World, id: number): void {
  const b = world.get(id, Boss);
  if (b) b.fireCooldown = 999;
}

describe('borowy-krol FSM', () => {
  test('phase1 → phase2 at 50 % HP', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, BOROWY_HP_MAX);
    const query = world.query(Boss);

    const b0 = world.get(id, Boss);
    const pos0 = world.get(id, Position);
    if (b0 && pos0) {
      b0.phase = 'phase1';
      pos0.y = b0.targetY;
    }

    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    });
    keepCooldownHigh(world, id);
    expect(world.get(id, Boss)?.phase).toBe('phase1');

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(hp.max * 0.49);
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    });
    keepCooldownHigh(world, id);
    expect(world.get(id, Boss)?.phase).toBe('phase2');
  });

  test('HP ≤ 0 transitions through dying into defeated', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, BOROWY_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase2';
      pos.y = b.targetY;
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

    updateBoss(world, 0.016, deps);
    expect(world.get(id, Boss)?.phase).toBe('dying');

    for (let i = 0; i < 400; i++) {
      updateBoss(world, 0.02, deps);
      if (defeated > 0) break;
    }
    expect(defeated).toBe(1);
  });
});
