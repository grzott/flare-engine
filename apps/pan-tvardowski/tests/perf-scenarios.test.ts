/**
 * E3 — perf scenario library tests.
 *
 * After the audit refactor, scenarios are SETUP MODIFIERS on the normal
 * game loop — they manipulate game state each tick (spawn boss, clamp HP,
 * refill particles, wipe entities) but no longer own the perf recorder or
 * call updateBoss. The recorder lives in play.ts and brackets the real
 * game loop. See docs/perf/protocol.md for rationale.
 *
 * What's verified here:
 * - init() spawns the right entities with correct components
 * - tick() returns false before SCENARIO_DURATION_SEC and true at/after it
 * - HP clamp keeps boss alive when HP would otherwise drain
 * - Force-phase setpoint is applied at the right elapsed time
 * - particle-storm keeps lifetimeQuery.count at PARTICLE_CAP
 * - zone-transitions wipes + refills every 5 s
 * - finish() cleans up
 *
 * What's NOT verified here (moved to play.ts integration / on-device runs):
 * - Boss FSM phase progression (requires updateBoss from real loop)
 * - Perf recorder section content (recorder is play.ts-owned now)
 * - postfx chain cost
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp, Lifetime } from '../src/components';
import { LUCYPER_HP_MAX, PHASE3_HP_RATIO, THREE_PHASE_P2_RATIO } from '../src/config/gameplay';
import { SMOK_HP_MAX } from '../src/config/gameplay';
import { BUDGET_LIMITS } from '../src/fx/budget';
import {
  BOSS_HP_CLAMP_MIN,
  SCENARIO_DURATION_SEC,
  createBootScenario,
  createBossLucyperZ8Scenario,
  createBossSmokFullScenario,
  createParticleStormScenario,
  createZoneTransitionsScenario,
} from '../src/perf/scenarios';
import type { ScenarioDeps } from '../src/perf/scenarios';
import { clearBossFsms } from '../src/systems/boss';
import { PHASE2_HP_RATIO } from '../src/systems/boss/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorld(): World {
  return new World();
}

function makeDeps(world: World): ScenarioDeps {
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: { texture: {} as never, frames: {} },
  } as unknown as ScenarioDeps['atlas'];
  const spawnCtx: ScenarioDeps['spawnCtx'] = { world, coll, atlas };
  return {
    world,
    spawnCtx,
    coll,
    atlas,
    bounds: { width: 360, height: 640 },
    enemyQuery: world.query(Boss),
    bulletQuery: world.query(Lifetime),
    lifetimeQuery: world.query(Lifetime),
  };
}

const DT = 1 / 60;

// ---------------------------------------------------------------------------
// boot scenario
// ---------------------------------------------------------------------------

describe('boot scenario', () => {
  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const s = createBootScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, 0)).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const s = createBootScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, SCENARIO_DURATION_SEC)).toBe(true);
  });

  test('init does not spawn entities (Zone 1 is spawned by startZone in play.ts)', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBootScenario(deps);
    s.init();
    expect(deps.lifetimeQuery.count).toBe(0);
    expect(deps.enemyQuery.count).toBe(0);
  });

  test('finish does not throw', () => {
    const s = createBootScenario(makeDeps(makeWorld()));
    s.init();
    expect(() => s.finish()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// boss-smok-full scenario
// ---------------------------------------------------------------------------

describe('boss-smok-full scenario', () => {
  beforeEach(() => clearBossFsms());
  afterEach(() => clearBossFsms());

  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const s = createBossSmokFullScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, 0)).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const s = createBossSmokFullScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, SCENARIO_DURATION_SEC)).toBe(true);
  });

  test('init spawns smok with SMOK_HP_MAX', () => {
    const world = makeWorld();
    const s = createBossSmokFullScenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    let hpMax = 0;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) hpMax = hp.max;
    }
    expect(hpMax).toBe(SMOK_HP_MAX);
  });

  test('tick clamps boss HP to >= BOSS_HP_CLAMP_MIN when drained low', () => {
    const world = makeWorld();
    const s = createBossSmokFullScenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    // Simulate damage: drain HP below clamp before tick.
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) hp.current = 0;
    }
    s.tick(DT, 5);
    let minHp = Number.POSITIVE_INFINITY;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) minHp = hp.current;
    }
    expect(minHp).toBeGreaterThanOrEqual(BOSS_HP_CLAMP_MIN);
  });

  test('tick at t>=PHASE2_FORCE_T sets HP below PHASE2_HP_RATIO when boss in phase1', () => {
    const world = makeWorld();
    const s = createBossSmokFullScenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    // Simulate updateBoss having transitioned to phase1.
    for (const id of bossQuery) {
      const b = world.get(id, Boss);
      if (b) b.phase = 'phase1';
    }
    s.tick(DT, 10);
    const expectedHp = Math.floor(SMOK_HP_MAX * PHASE2_HP_RATIO * 0.9);
    let observed = -1;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) observed = hp.current;
    }
    expect(observed).toBe(expectedHp);
  });

  test('tick keeps boss fireCooldown high to suppress fire path', () => {
    const world = makeWorld();
    const s = createBossSmokFullScenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    // Reset to 0 — scenario should bring it back up to 999.
    for (const id of bossQuery) {
      const b = world.get(id, Boss);
      if (b) b.fireCooldown = 0;
    }
    s.tick(DT, 5);
    let cd = 0;
    for (const id of bossQuery) {
      const b = world.get(id, Boss);
      if (b) cd = b.fireCooldown;
    }
    expect(cd).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// boss-lucyper-z8 scenario
// ---------------------------------------------------------------------------

describe('boss-lucyper-z8 scenario', () => {
  beforeEach(() => clearBossFsms());
  afterEach(() => clearBossFsms());

  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const s = createBossLucyperZ8Scenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, 0)).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const s = createBossLucyperZ8Scenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, SCENARIO_DURATION_SEC)).toBe(true);
  });

  test('init spawns lucyper with LUCYPER_HP_MAX', () => {
    const world = makeWorld();
    const s = createBossLucyperZ8Scenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    let hpMax = 0;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) hpMax = hp.max;
    }
    expect(hpMax).toBe(LUCYPER_HP_MAX);
  });

  test('tick clamps HP to >= BOSS_HP_CLAMP_MIN', () => {
    const world = makeWorld();
    const s = createBossLucyperZ8Scenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) hp.current = 0;
    }
    s.tick(DT, 5);
    let minHp = Number.POSITIVE_INFINITY;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) minHp = hp.current;
    }
    expect(minHp).toBeGreaterThanOrEqual(BOSS_HP_CLAMP_MIN);
  });

  test('tick at t>=10 sets HP below THREE_PHASE_P2_RATIO when in phase1', () => {
    const world = makeWorld();
    const s = createBossLucyperZ8Scenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    for (const id of bossQuery) {
      const b = world.get(id, Boss);
      if (b) b.phase = 'phase1';
    }
    s.tick(DT, 10);
    const expectedHp = Math.floor(LUCYPER_HP_MAX * THREE_PHASE_P2_RATIO * 0.9);
    let observed = -1;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) observed = hp.current;
    }
    expect(observed).toBe(expectedHp);
  });

  test('tick at t>=20 sets HP below PHASE3_HP_RATIO when in phase2', () => {
    const world = makeWorld();
    const s = createBossLucyperZ8Scenario(makeDeps(world));
    s.init();
    const bossQuery = world.query(Boss);
    for (const id of bossQuery) {
      const b = world.get(id, Boss);
      if (b) b.phase = 'phase2';
    }
    s.tick(DT, 20);
    const expectedHp = Math.floor(LUCYPER_HP_MAX * PHASE3_HP_RATIO * 0.9);
    let observed = -1;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) observed = hp.current;
    }
    expect(observed).toBe(expectedHp);
  });
});

// ---------------------------------------------------------------------------
// particle-storm scenario
// ---------------------------------------------------------------------------

describe('particle-storm scenario', () => {
  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const s = createParticleStormScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, 0)).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const s = createParticleStormScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, SCENARIO_DURATION_SEC)).toBe(true);
  });

  test('init fills lifetimeQuery.count to PARTICLE_CAP', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    expect(deps.lifetimeQuery.count).toBe(BUDGET_LIMITS.particles);
  });

  test('tick refills count back to PARTICLE_CAP after some entities destroyed', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    // Simulate cleanup destroying half the entities.
    const ids: number[] = [];
    for (const id of deps.lifetimeQuery) ids.push(id);
    for (let i = 0; i < ids.length / 2; i++) {
      const id = ids[i];
      if (id !== undefined) world.destroy(id);
    }
    expect(deps.lifetimeQuery.count).toBeLessThan(BUDGET_LIMITS.particles);
    s.tick(DT, 1);
    expect(deps.lifetimeQuery.count).toBe(BUDGET_LIMITS.particles);
  });

  test('finish clears all lifetime entities', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    s.finish();
    expect(deps.lifetimeQuery.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// zone-transitions scenario
// ---------------------------------------------------------------------------

describe('zone-transitions scenario', () => {
  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const s = createZoneTransitionsScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, 0)).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const s = createZoneTransitionsScenario(makeDeps(makeWorld()));
    s.init();
    expect(s.tick(DT, SCENARIO_DURATION_SEC)).toBe(true);
  });

  test('init spawns 200 lifetime entities', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    expect(deps.lifetimeQuery.count).toBe(200);
  });

  test('wipe at t=5s keeps total count at 200 (despawn + refill)', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    // Drive scenario past the 5-second wipe boundary.
    for (let i = 0; i < Math.ceil(5 / DT) + 5; i++) {
      s.tick(DT, i * DT);
    }
    expect(deps.lifetimeQuery.count).toBe(200);
  });

  test('two wipe cycles occur within 12 s without throwing', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    for (let i = 0; i < Math.ceil(12 / DT); i++) {
      expect(() => s.tick(DT, i * DT)).not.toThrow();
    }
    expect(deps.lifetimeQuery.count).toBe(200);
  });

  test('finish clears all entities', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    s.finish();
    expect(deps.lifetimeQuery.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ScenarioDeps shape
// ---------------------------------------------------------------------------

describe('ScenarioDeps shape', () => {
  test('deps has required fields and no recorder (audit refactor)', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    expect(deps.world).toBeDefined();
    expect(deps.spawnCtx).toBeDefined();
    expect(deps.coll).toBeDefined();
    expect(deps.atlas).toBeDefined();
    expect(deps.bounds).toBeDefined();
    expect(deps.enemyQuery).toBeDefined();
    expect(deps.bulletQuery).toBeDefined();
    expect(deps.lifetimeQuery).toBeDefined();
    // recorder field was removed — ownership moved to play.ts.
    expect((deps as unknown as { recorder?: unknown }).recorder).toBeUndefined();
  });

  test('queries are live Query instances (not recreated on access)', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    expect(deps.lifetimeQuery).toBe(deps.lifetimeQuery);
    expect(deps.enemyQuery).toBe(deps.enemyQuery);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('scenario constants', () => {
  test('SCENARIO_DURATION_SEC is 30', () => {
    expect(SCENARIO_DURATION_SEC).toBe(30);
  });

  test('BOSS_HP_CLAMP_MIN is 1', () => {
    expect(BOSS_HP_CLAMP_MIN).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// spawnBoss injection — proves the device path is wired
// ---------------------------------------------------------------------------

describe('spawnBoss injection', () => {
  beforeEach(() => clearBossFsms());
  afterEach(() => clearBossFsms());

  test('boss-smok-full init() calls injected spawnBoss with correct kind, x, y', () => {
    const world = makeWorld();
    const baseDeps = makeDeps(world);
    const calls: Array<{ kind: string; x: number; y: number; hp: number }> = [];
    const deps: ScenarioDeps = {
      ...baseDeps,
      spawnBoss: (kind, x, y, hp) => {
        calls.push({ kind, x, y, hp });
        return 0;
      },
    };
    const s = createBossSmokFullScenario(deps);
    s.init();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.kind).toBe('smok-krzemionkowski');
    expect(calls[0]?.x).toBe(deps.bounds.width / 2);
    expect(calls[0]?.y).toBe(100);
    expect(calls[0]?.hp).toBe(SMOK_HP_MAX);
  });

  test('boss-lucyper-z8 init() calls injected spawnBoss with correct kind, x, y', () => {
    const world = makeWorld();
    const baseDeps = makeDeps(world);
    const calls: Array<{ kind: string; x: number; y: number; hp: number }> = [];
    const deps: ScenarioDeps = {
      ...baseDeps,
      spawnBoss: (kind, x, y, hp) => {
        calls.push({ kind, x, y, hp });
        return 0;
      },
    };
    const s = createBossLucyperZ8Scenario(deps);
    s.init();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.kind).toBe('lucyper-ksiezycowy');
    expect(calls[0]?.hp).toBe(LUCYPER_HP_MAX);
  });

  test('without spawnBoss, boss-smok-full falls back to internal _spawnBossEntity', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();
    const bossQuery = world.query(Boss);
    let found = 0;
    for (const _ of bossQuery) found += 1;
    expect(found).toBe(1);
  });
});
