import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import type { BossPattern, BossPhase } from '../src/components';
import { BABA_JAGA_HP_MAX, SMOK_HP_MAX } from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearBossFsms, updateBoss } from '../src/systems/boss';

function makeSpawnCtx(world: ReturnType<typeof createTestWorld>['world']): SpawnCtx {
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: { texture: {} as never, frames: {} },
  } as unknown as SpawnCtx['atlas'];
  return { world, coll, atlas };
}

function keepCooldownHigh(world: ReturnType<typeof createTestWorld>['world'], id: number): void {
  const b = world.get(id, Boss);
  if (b) b.fireCooldown = 999;
}

function spawnBoss(
  world: ReturnType<typeof createTestWorld>['world'],
  pattern: BossPattern,
  hp: number,
): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: 100 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern,
    phase: 'phase1',
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

describe('boss-phase-palette M1', () => {
  test('smok: onPaletteShift called with phase1 terracotta on enter', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'smok-krzemionkowski', SMOK_HP_MAX);
    const query = world.query(Boss);

    // Set to entering so FSM transitions entering→phase1, firing onPhase1Enter.
    const b = world.get(id, Boss);
    if (b) b.phase = 'entering';
    const pos = world.get(id, Position);
    if (b && pos) pos.y = b.targetY;

    const calls: Array<{ phase: BossPhase; accent: number }> = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => calls.push({ phase, accent }),
    };

    for (let i = 0; i < 5; i++) {
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, deps);
      if (world.get(id, Boss)?.phase === 'phase1') break;
    }

    const p1Call = calls.find((c) => c.phase === 'phase1');
    expect(p1Call).toBeDefined();
    expect(p1Call?.accent).toBe(0xffb05a3c);
  });

  test('smok: onPaletteShift called with phase2 rust on phase transition', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'smok-krzemionkowski', SMOK_HP_MAX);
    const query = world.query(Boss);

    const calls: Array<{ phase: BossPhase; accent: number }> = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => calls.push({ phase, accent }),
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(SMOK_HP_MAX * 0.49);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    const p2Call = calls.find((c) => c.phase === 'phase2');
    expect(p2Call).toBeDefined();
    expect(p2Call?.accent).toBe(0xff8b3a1f);
  });

  test('baba-jaga: onPaletteShift called with white-out 0xffffffff on phase3 enter', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'baba-jaga', BABA_JAGA_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    if (b) b.phase = 'phase2';
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BABA_JAGA_HP_MAX * 0.3);

    const calls: Array<{ phase: BossPhase; accent: number }> = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => calls.push({ phase, accent }),
    };

    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);
    expect(world.get(id, Boss)?.phase).toBe('phase3');

    const p3Call = calls.find((c) => c.phase === 'phase3');
    expect(p3Call).toBeDefined();
    expect(p3Call?.accent).toBe(0xffffffff);
  });
});
