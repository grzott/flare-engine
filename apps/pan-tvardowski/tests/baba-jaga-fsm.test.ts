import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import type { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import { BABA_JAGA_HP_MAX } from '../src/config/gameplay';
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

function spawnMockBaba(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'baba-jaga',
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

describe('baba-jaga FSM', () => {
  test('phase1 → phase2 at 66 % HP (2/3 gate)', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBaba(world, BABA_JAGA_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase1';
      pos.y = b.targetY;
    }

    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    });
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BABA_JAGA_HP_MAX * 0.6);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
    });

    expect(world.get(id, Boss)?.phase).toBe('phase2');
  });

  test('phase2 → phase3 at 33 % HP (1/3 gate)', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBaba(world, BABA_JAGA_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase2';
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BABA_JAGA_HP_MAX * 0.3);

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

  test('HP ≤ 0 from phase3 transitions into defeated', () => {
    clearBossFsms();
    const { world, clock } = createTestWorld();
    void clock;
    const { spawnCtx, bounds } = buildCtx(world);
    const id = spawnMockBaba(world, BABA_JAGA_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase3';
      pos.y = b.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = 0;

    let defeated = false;
    for (let i = 0; i < 800; i++) {
      updateBoss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onDefeated: () => {
          defeated = true;
        },
      });
      if (defeated) break;
    }
    expect(defeated).toBe(true);
  });

  test('deterministic replay: identical setup → identical boss position after N frames', () => {
    // Two independent test worlds driven by identical dt sequences must produce
    // identical Boss.t + Position values. Exercises @flare-engine/testing harness.
    const run = (): { t: number; x: number; y: number; phase: string } => {
      clearBossFsms();
      const { world } = createTestWorld();
      const { spawnCtx, bounds } = buildCtx(world);
      const id = spawnMockBaba(world, BABA_JAGA_HP_MAX);
      const query = world.query(Boss);
      const b = world.get(id, Boss);
      const pos = world.get(id, Position);
      if (b && pos) {
        b.phase = 'phase1';
        pos.y = b.targetY;
      }
      for (let i = 0; i < 240; i++) {
        // Suppress firing so the mock atlas isn't touched — we only assert on
        // deterministic movement + phase transitions here.
        keepCooldownHigh(world, id);
        updateBoss(world, 1 / 60, {
          spawnCtx,
          query,
          playerX: 180,
          playerY: 540,
          bounds,
        });
      }
      const bOut = world.get(id, Boss);
      const posOut = world.get(id, Position);
      return {
        t: bOut?.t ?? 0,
        x: posOut?.x ?? 0,
        y: posOut?.y ?? 0,
        phase: bOut?.phase ?? '',
      };
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });
});
