import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp, Miniboss } from '../src/components';
import {
  BORUTA_HP_MAX,
  BORUTA_SUMMON_COUNT,
  NOCNY_LOWCA_HOUND_COUNT,
  NOCNY_LOWCA_HP,
  WODNIK_HP_MAX,
  WODNIK_SHIELD_MINIONS,
} from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearBossFsms, updateBoss } from '../src/systems/boss';
import { clearMinibossFsms, updateMiniboss } from '../src/systems/miniboss';
import { BOSS_LAYOUT_DEFS } from '../src/visual-spec/boss-layouts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    twinId: -1,
    firepitCooldown: 0,
    shatterIdx: 0,
    shatterT: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function spawnMockWodnik(world: World, hp: number): number {
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

function spawnMockNocnyLowca(world: World, hp: number): number {
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
    spikeIndex: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

// ---------------------------------------------------------------------------
// BOSS_LAYOUT_DEFS — structure tests
// ---------------------------------------------------------------------------

describe('BOSS_LAYOUT_DEFS — structure', () => {
  test('contains entries for boruta, nocny-lowca and wodnik-wislanny', () => {
    const ids = BOSS_LAYOUT_DEFS.map((d) => d.id);
    expect(ids).toContain('boruta');
    expect(ids).toContain('nocny-lowca');
    expect(ids).toContain('wodnik-wislanny');
  });

  test('boruta summon: kind=bies, ox=60, oy=40, origin omitted', () => {
    const def = BOSS_LAYOUT_DEFS.find((d) => d.id === 'boruta');
    expect(def).toBeDefined();
    const s = def?.summons?.[0];
    expect(s?.kind).toBe('bies');
    expect(s?.ox).toBe(60);
    expect(s?.oy).toBe(40);
    expect(s?.origin).toBeUndefined();
  });

  test('nocny-lowca summon: kind=hound, ox=46, oy=30, origin omitted', () => {
    const def = BOSS_LAYOUT_DEFS.find((d) => d.id === 'nocny-lowca');
    expect(def).toBeDefined();
    const s = def?.summons?.[0];
    expect(s?.kind).toBe('hound');
    expect(s?.ox).toBe(46);
    expect(s?.oy).toBe(30);
    expect(s?.origin).toBeUndefined();
  });

  test("wodnik-wislanny summon: kind=topielec, ox=70, oy=40, origin='screen-bottom'", () => {
    const def = BOSS_LAYOUT_DEFS.find((d) => d.id === 'wodnik-wislanny');
    expect(def).toBeDefined();
    const s = def?.summons?.[0];
    expect(s?.kind).toBe('topielec');
    expect(s?.ox).toBe(70);
    expect(s?.oy).toBe(40);
    expect(s?.origin).toBe('screen-bottom');
  });

  test('no two entries share the same id', () => {
    const ids = BOSS_LAYOUT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Runtime semantics — boruta summon positions
// ---------------------------------------------------------------------------

describe('BOSS_LAYOUT_DEFS — boruta runtime parity', () => {
  test('spawns BORUTA_SUMMON_COUNT bies centred on boss X with ox=60 spacing', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockBoruta(world, BORUTA_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase1';
      pos.y = b.targetY;
    }

    // Drive to phase-2 threshold.
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(hp.max * 0.49);

    const summons: Array<{ x: number; y: number }> = [];
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnSummon: (x, y) => summons.push({ x, y }),
    });

    expect(summons.length).toBe(BORUTA_SUMMON_COUNT);

    // Verify centred layout: xs should be symmetric around boss.x (180).
    const bossX = world.get(id, Position)?.x ?? 180;
    const xs = summons.map((s) => s.x);
    const half = (BORUTA_SUMMON_COUNT - 1) / 2;
    for (let i = 0; i < BORUTA_SUMMON_COUNT; i++) {
      const expected = bossX + (i - half) * 60;
      expect(xs[i]).toBeCloseTo(expected, 1);
    }

    // Y must be boss-relative (pos.y + 40), not screen-bottom.
    const bossY = world.get(id, Position)?.y ?? 100;
    for (const s of summons) {
      expect(s.y).toBeCloseTo(bossY + 40, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Runtime semantics — wodnik screen-bottom spawn
// ---------------------------------------------------------------------------

describe('BOSS_LAYOUT_DEFS — wodnik runtime parity', () => {
  test('topielec minions spawn at bounds.height + 40 (screen-bottom)', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockWodnik(world, WODNIK_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase1';
      pos.y = b.targetY;
    }

    // Drive to phase-2 threshold.
    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(hp.max * 0.49);

    const minions: Array<{ x: number; y: number }> = [];
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnShieldMinion: (x, y) => minions.push({ x, y }),
    });

    expect(minions.length).toBe(WODNIK_SHIELD_MINIONS);

    // All Y values must equal bounds.height + 40.
    for (const m of minions) {
      expect(m.y).toBe(bounds.height + 40);
    }

    // X values must be within [40, bounds.width - 40] (clamp guard preserved).
    for (const m of minions) {
      expect(m.x).toBeGreaterThanOrEqual(40);
      expect(m.x).toBeLessThanOrEqual(bounds.width - 40);
    }
  });

  test('topielec X values are centred on boss X with ox=70 spacing', () => {
    clearBossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockWodnik(world, WODNIK_HP_MAX);
    const query = world.query(Boss);

    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    if (b && pos) {
      b.phase = 'phase1';
      pos.y = b.targetY;
    }

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(hp.max * 0.49);

    const minions: Array<{ x: number; y: number }> = [];
    updateBoss(world, 0.016, {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds,
      onSpawnShieldMinion: (x, y) => minions.push({ x, y }),
    });

    const bossX = 180;
    const half = (WODNIK_SHIELD_MINIONS - 1) / 2;
    for (let i = 0; i < WODNIK_SHIELD_MINIONS; i++) {
      const raw = bossX + (i - half) * 70;
      const clamped = Math.max(40, Math.min(bounds.width - 40, raw));
      expect(minions[i]?.x).toBeCloseTo(clamped, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Runtime semantics — nocny-lowca hound positions
// ---------------------------------------------------------------------------

describe('BOSS_LAYOUT_DEFS — nocny-lowca runtime parity', () => {
  test('spawns NOCNY_LOWCA_HOUND_COUNT hounds centred on miniboss X with ox=46 spacing', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockNocnyLowca(world, NOCNY_LOWCA_HP);
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

    const bossX = world.get(id, Position)?.x ?? 180;
    const half = (NOCNY_LOWCA_HOUND_COUNT - 1) / 2;
    for (let i = 0; i < NOCNY_LOWCA_HOUND_COUNT; i++) {
      expect(hounds[i]?.x).toBeCloseTo(bossX + (i - half) * 46, 1);
    }

    // Y must be boss-relative (pos.y + 30), not screen-bottom.
    const bossY = world.get(id, Position)?.y ?? 110;
    for (const h of hounds) {
      expect(h.y).toBeCloseTo(bossY + 30, 1);
    }
  });
});
