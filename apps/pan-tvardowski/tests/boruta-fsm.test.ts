import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp } from '../src/components';
import { BORUTA_HP_MAX, BORUTA_SUMMON_COUNT } from '../src/config/gameplay';
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

function spawnMockBoruta(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'boruta',
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

describe('boruta FSM', () => {
  test('phase1 → phase2 at 50% HP, summons spawn exactly BORUTA_SUMMON_COUNT times', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoruta(world, BORUTA_HP_MAX);
    const query = world.query(Boss);

    // Force phase1 from start.
    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase1';
      pos.y = b.targetY;
    }

    const summonPositions: Array<{ x: number; y: number }> = [];
    const onSpawnSummon = (x: number, y: number): void => {
      summonPositions.push({ x, y });
    };

    // Tick with HP above 50% — no phase transition.
    for (let i = 0; i < 10; i++) {
      updateBoss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onSpawnSummon,
      });
      keepCooldownHigh(world, id);
    }
    expect(summonPositions.length).toBe(0);
    expect(world.get(id, Boss)?.phase).toBe('phase1');

    // Drop HP below phase gate → expect exactly BORUTA_SUMMON_COUNT summons.
    const hp = world.get(id, Hp);
    if (hp) hp.current = BORUTA_HP_MAX * 0.4;

    for (let i = 0; i < 80; i++) {
      updateBoss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onSpawnSummon,
      });
      keepCooldownHigh(world, id);
      if ((world.get(id, Boss)?.phase ?? '') === 'phase2') break;
    }

    expect(world.get(id, Boss)?.phase).toBe('phase2');
    expect(summonPositions.length).toBe(BORUTA_SUMMON_COUNT);

    // Running more phase2 ticks must NOT re-trigger summons.
    for (let i = 0; i < 30; i++) {
      updateBoss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onSpawnSummon,
      });
      keepCooldownHigh(world, id);
    }
    expect(summonPositions.length).toBe(BORUTA_SUMMON_COUNT);
  });

  test('HP ≤ 0 transitions through dying into defeated', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoruta(world, BORUTA_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase2';
      b.summonsSpawned = BORUTA_SUMMON_COUNT;
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
});
