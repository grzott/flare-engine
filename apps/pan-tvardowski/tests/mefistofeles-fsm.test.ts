import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp } from '../src/components';
import { MEFISTOFELES_HP_MAX } from '../src/config/gameplay';
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

function spawnMockMefi(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'mefistofeles',
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
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function keepCooldownHigh(world: World, id: number): void {
  const b = world.get(id, Boss);
  if (b) b.fireCooldown = 999;
}

describe('mefistofeles FSM', () => {
  test('three-phase transitions at 2/3 and 1/3 HP', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockMefi(world, MEFISTOFELES_HP_MAX);
    const query = world.query(Boss);

    const b0 = world.get(id, Boss);
    const pos0 = world.get(id, Position);
    if (b0 && pos0) {
      b0.phase = 'phase1';
      pos0.y = b0.targetY;
    }

    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnFirepit: () => {},
      onSpawnMirrorTwin: (): number => 9999,
      onDespawnMirrorTwin: () => {},
    };

    updateBoss(world, 0.016, deps);
    keepCooldownHigh(world, id);
    expect(world.get(id, Boss)?.phase).toBe('phase1');

    // Drop HP to just below 2/3 → phase2.
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(hp.max * 0.66);
    updateBoss(world, 0.016, deps);
    keepCooldownHigh(world, id);
    expect(world.get(id, Boss)?.phase).toBe('phase2');

    // Drop HP to just below 1/3 → phase3.
    if (hp) hp.current = Math.floor(hp.max * 0.33);
    updateBoss(world, 0.016, deps);
    keepCooldownHigh(world, id);
    expect(world.get(id, Boss)?.phase).toBe('phase3');
  });

  test('mirror-twin spawns exactly once on phase3 enter', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockMefi(world, MEFISTOFELES_HP_MAX);
    const query = world.query(Boss);

    const b0 = world.get(id, Boss);
    const pos0 = world.get(id, Position);
    if (b0 && pos0) {
      b0.phase = 'phase1';
      pos0.y = b0.targetY;
    }

    let twinSpawns = 0;
    let twinDespawns = 0;
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnFirepit: () => {},
      onSpawnMirrorTwin: (): number => {
        twinSpawns += 1;
        return 4242;
      },
      onDespawnMirrorTwin: () => {
        twinDespawns += 1;
      },
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(hp.max * 0.33);
    // Tick a handful of frames through phase2 entry + phase3 entry.
    for (let i = 0; i < 20; i++) {
      updateBoss(world, 0.016, deps);
      keepCooldownHigh(world, id);
    }
    expect(twinSpawns).toBe(1);
    expect(world.get(id, Boss)?.twinId).toBe(4242);

    // Kill boss — phase3 exits, twin should despawn.
    if (hp) hp.current = 0;
    updateBoss(world, 0.016, deps);
    expect(twinDespawns).toBe(1);
  });

  test('deterministic replay across two independent runs', () => {
    const run = (): Array<{ phase: string; y: number }> => {
      clearBossFsms();
      const { world, spawnCtx, bounds } = buildCtx();
      const id = spawnMockMefi(world, MEFISTOFELES_HP_MAX);
      const query = world.query(Boss);
      const b0 = world.get(id, Boss);
      const pos0 = world.get(id, Position);
      if (b0 && pos0) {
        b0.phase = 'phase1';
        pos0.y = b0.targetY;
      }
      const deps = {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onSpawnFirepit: () => {},
        onSpawnMirrorTwin: (): number => 1,
        onDespawnMirrorTwin: () => {},
      };
      const log: Array<{ phase: string; y: number }> = [];
      for (let i = 0; i < 50; i++) {
        updateBoss(world, 0.05, deps);
        keepCooldownHigh(world, id);
        const b = world.get(id, Boss);
        const p = world.get(id, Position);
        if (b && p) log.push({ phase: b.phase, y: Math.round(p.y * 100) / 100 });
      }
      return log;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });
});
