import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import type { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import { LUCYPER_HP_MAX, LUCYPER_SHATTER_CYCLE } from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearBossFsms, updateBoss } from '../src/systems/boss';

function buildCtx(world: World): {
  coll: CollisionWorld;
  spawnCtx: SpawnCtx;
  bounds: { width: number; height: number };
} {
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: { texture: {} as never, frames: {} },
  } as unknown as SpawnCtx['atlas'];
  const spawnCtx: SpawnCtx = { world, coll, atlas };
  return { coll, spawnCtx, bounds: { width: 360, height: 640 } };
}

function spawnMockLucyper(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'lucyper-ksiezycowy',
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
    teleportT: 0,
    twinId: -1,
    firepitCooldown: 0,
    shatterIdx: 0,
    shatterT: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function keepCooldownHigh(world: World, id: number): void {
  const b = world.get(id, Boss);
  if (b) b.fireCooldown = 999;
}

describe('lucyper FSM', () => {
  test('phase1 → phase2 at 2/3 HP gate, eclipse onEnter fires', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockLucyper(world, LUCYPER_HP_MAX);
    const query = world.query(Boss);

    const eclipse: boolean[] = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onEclipseChange: (active: boolean) => eclipse.push(active),
    };

    // Drive entering → phase1.
    const pos = world.get(id, Position);
    const b = world.get(id, Boss);
    if (pos && b) pos.y = b.targetY;
    for (let i = 0; i < 50; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, deps);
      if (world.get(id, Boss)?.phase === 'phase1') break;
    }
    expect(world.get(id, Boss)?.phase).toBe('phase1');

    // Drop HP below 2/3 to trigger phase1 → phase2.
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(LUCYPER_HP_MAX * 0.6);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);
    expect(world.get(id, Boss)?.phase).toBe('phase2');
    expect(eclipse[eclipse.length - 1]).toBe(true);
  });

  test('phase2 → phase3 at 1/3 HP gate, eclipse onExit fires', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockLucyper(world, LUCYPER_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase2';
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(LUCYPER_HP_MAX * 0.3);

    const eclipse: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onEclipseChange: (active: boolean) => eclipse.push(active),
      });
      if (world.get(id, Boss)?.phase === 'phase3') break;
    }
    expect(world.get(id, Boss)?.phase).toBe('phase3');
    expect(eclipse[eclipse.length - 1]).toBe(false);
  });

  test('phase3 advances shatterIdx every LUCYPER_SHATTER_CYCLE seconds', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockLucyper(world, LUCYPER_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase3';
      b.shatterIdx = 0;
      b.shatterT = 0;
      pos.y = b.targetY;
    }

    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    };

    const dt = 0.016;
    const steps = Math.ceil(LUCYPER_SHATTER_CYCLE / dt) + 1;
    for (let i = 0; i < steps; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, dt, deps);
    }
    expect(world.get(id, Boss)?.shatterIdx).toBe(1);
  });

  test('transitions to dying on zero HP', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockLucyper(world, LUCYPER_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase3';
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = 0;

    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    });
    expect(world.get(id, Boss)?.phase).toBe('dying');
  });
});
