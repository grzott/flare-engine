import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp } from '../src/components';
import {
  WODNIK_HP_MAX,
  WODNIK_SHIELD_MINIONS,
  WODNIK_SHIELD_REBUILD_SEC,
} from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearBossFsms, computeBossStatus, updateBoss } from '../src/systems/boss';

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
    pattern: 'wodnik-wislanny',
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

describe('wodnik-wislanny FSM', () => {
  test('phase1 → phase2 at 50 % HP', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, WODNIK_HP_MAX);
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
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(WODNIK_HP_MAX * 0.4);

    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    });

    expect(world.get(id, Boss)?.phase).toBe('phase2');
  });

  test('phase2 entry raises shield and spawns WODNIK_SHIELD_MINIONS minions', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, WODNIK_HP_MAX);
    const query = world.query(Boss);

    const b0 = world.get(id, Boss);
    const pos0 = world.get(id, Position);
    if (b0 && pos0) {
      b0.phase = 'phase1';
      pos0.y = b0.targetY;
    }

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(WODNIK_HP_MAX * 0.4);

    let spawned = 0;
    let liveMinions = 0;
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnShieldMinion: () => {
        spawned += 1;
        liveMinions += 1;
      },
      countShieldMinions: () => liveMinions,
    });

    keepCooldownHigh(world, id);

    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnShieldMinion: () => {
        spawned += 1;
        liveMinions += 1;
      },
      countShieldMinions: () => liveMinions,
    });

    expect(spawned).toBe(WODNIK_SHIELD_MINIONS);
    const boss = world.get(id, Boss);
    expect(boss?.shieldActive).toBe(true);
    expect(boss?.minionsAlive).toBe(WODNIK_SHIELD_MINIONS);
    const status = computeBossStatus(world, query);
    expect(status.invulnerable).toBe(true);
  });

  test('shield drops when all minions die; onShieldBroken fires exactly once', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, WODNIK_HP_MAX);
    const query = world.query(Boss);
    const boss = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (boss && pos) {
      boss.phase = 'phase2';
      boss.shieldActive = true;
      boss.minionsAlive = WODNIK_SHIELD_MINIONS;
      pos.y = boss.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(WODNIK_HP_MAX * 0.4);

    const live = 0;
    let broken = 0;
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      countShieldMinions: () => live,
      onShieldBroken: () => {
        broken += 1;
      },
    });

    expect(broken).toBe(1);
    const boss2 = world.get(id, Boss);
    expect(boss2?.shieldActive).toBe(false);
    expect(boss2?.shieldDownFor).toBe(0);
  });

  test('shield rebuilds after WODNIK_SHIELD_REBUILD_SEC', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, WODNIK_HP_MAX);
    const query = world.query(Boss);
    const boss = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (boss && pos) {
      boss.phase = 'phase2';
      boss.shieldActive = false;
      boss.shieldDownFor = 0;
      pos.y = boss.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(WODNIK_HP_MAX * 0.4);

    let spawned = 0;
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnShieldMinion: () => {
        spawned += 1;
      },
      countShieldMinions: () => 0,
    };

    const dt = 0.1;
    const steps = Math.ceil(WODNIK_SHIELD_REBUILD_SEC / dt) + 2;
    for (let i = 0; i < steps; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, dt, deps);
    }

    expect(spawned).toBeGreaterThanOrEqual(WODNIK_SHIELD_MINIONS);
    const boss2 = world.get(id, Boss);
    expect(boss2?.shieldActive).toBe(true);
  });

  test('HP ≤ 0 transitions through dying into defeated', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoss(world, WODNIK_HP_MAX);
    const query = world.query(Boss);
    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase2';
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = 0;

    let defeated = false;
    for (let i = 0; i < 500; i++) {
      updateBoss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        countShieldMinions: () => 0,
        onDefeated: () => {
          defeated = true;
        },
      });
      const status = computeBossStatus(world, query);
      if (!status.alive) break;
    }
    expect(defeated).toBe(true);
  });
});
