import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import type { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import { BAZYLISZEK_HP_MAX, BAZYLISZEK_TELEPORT_SEC } from '../src/config/gameplay';
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

function spawnMockBazyliszek(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'bazyliszek-warszawski',
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
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function keepCooldownHigh(world: World, id: number): void {
  const b = world.get(id, Boss);
  if (b) b.fireCooldown = 999;
}

describe('bazyliszek FSM', () => {
  test('phase1 onEnter/onExit toggles gaze via onGazeChange', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBazyliszek(world, BAZYLISZEK_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) pos.y = b.targetY;

    const events: boolean[] = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onGazeChange: (active: boolean) => events.push(active),
    };

    // Drive entering → phase1.
    for (let i = 0; i < 50; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, deps);
      if (world.get(id, Boss)?.phase === 'phase1') break;
    }
    expect(events[0]).toBe(true);

    // Drop HP to 2/3 to trigger phase1 → phase2 (gaze off).
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BAZYLISZEK_HP_MAX * 0.6);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);
    expect(world.get(id, Boss)?.phase).toBe('phase2');
    expect(events[events.length - 1]).toBe(false);
  });

  test('phase2 → phase3 at 33 % HP (1/3 gate)', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBazyliszek(world, BAZYLISZEK_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase2';
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BAZYLISZEK_HP_MAX * 0.3);

    for (let i = 0; i < 5; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
      });
      if (world.get(id, Boss)?.phase === 'phase3') break;
    }
    expect(world.get(id, Boss)?.phase).toBe('phase3');
  });

  test('phase3 teleport relocates x inside viewport bounds', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBazyliszek(world, BAZYLISZEK_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase3';
      b.teleportT = 0;
      b.t = 5;
      pos.x = 180;
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BAZYLISZEK_HP_MAX * 0.2);

    const startX = world.get(id, Position)?.x ?? 0;
    const xs = new Set<number>([startX]);
    // Drive the FSM long enough to trip several teleports.
    for (let i = 0; i < 600; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, BAZYLISZEK_TELEPORT_SEC / 10, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
      });
      const p = world.get(id, Position);
      if (p) xs.add(p.x);
    }
    // At least one teleport occurred (x changed) and stayed within bounds.
    expect(xs.size).toBeGreaterThan(1);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(bounds.width);
    }
  });

  test('HP ≤ 0 from phase3 transitions into defeated', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBazyliszek(world, BAZYLISZEK_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase3';
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
    for (let i = 0; i < 800; i++) {
      updateBoss(world, 0.02, deps);
      if (defeated > 0) break;
    }
    expect(defeated).toBe(1);
  });
});
