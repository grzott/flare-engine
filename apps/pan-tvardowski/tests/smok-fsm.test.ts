import { describe, expect, test } from 'bun:test';
import { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp } from '../src/components';
import { SMOK_HP_MAX } from '../src/config/gameplay';
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
    // Fake atlas — fire paths are never triggered in tests because we hold
    // fireCooldown above dt, so atlas frame lookups do not run.
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
    pattern: 'smok-krzemionkowski',
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 999, // prevent fire paths from running in tests
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

describe('smok-krzemionkowski FSM', () => {
  test('entering → phase1 once boss reaches targetY', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, SMOK_HP_MAX);
    const query = world.query(Boss);

    // Simulate descent — Velocity.y=60 set by entering state, plus we must
    // integrate position manually because the test owns the tick order.
    for (let i = 0; i < 200; i++) {
      updateBoss(world, 0.05, {
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
      const b = world.get(id, Boss);
      if (b && b.phase === 'phase1') break;
    }

    const b = world.get(id, Boss);
    expect(b?.phase).toBe('phase1');
  });

  test('phase1 → phase2 when HP drops below 50 %', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, SMOK_HP_MAX);
    const query = world.query(Boss);

    const boss = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (boss && pos) {
      boss.phase = 'phase1';
      pos.y = boss.targetY;
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

  test('HP ≤ 0 in any combat phase transitions to dying then defeated', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, SMOK_HP_MAX);
    const query = world.query(Boss);

    const boss = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (boss && pos) {
      boss.phase = 'phase2';
      pos.y = boss.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = 0;

    let defeatCalled = 0;
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onDefeated: () => {
        defeatCalled += 1;
      },
    };

    updateBoss(world, 0.016, deps);
    expect(world.get(id, Boss)?.phase).toBe('dying');

    // Tick through the dying timeline; each tick advances fireCooldown → spawn
    // explosion. DYING_INTERVAL=0.18, DYING_TOTAL=14 → ≈2.5 s of wall time.
    for (let i = 0; i < 400; i++) {
      updateBoss(world, 0.02, deps);
      if (defeatCalled > 0) break;
    }
    expect(defeatCalled).toBe(1);
  });
});
