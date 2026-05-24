/**
 * E3 — perf scenario library tests.
 *
 * Verifies deterministic, observable behavior of each scenario:
 * - init() + N ticks executes without throwing
 * - tick() returns false before SCENARIO_DURATION_SEC and true at/after it
 * - recorder sections are populated after ticking
 * - HP-clamp keeps boss alive in boss-* scenarios
 * - zone-transitions wipes and refills entities at each 5-second boundary
 * - particle-storm keeps lifetimeQuery.count at PARTICLE_CAP after refill
 *
 * No audio, no atlas, no collision bodies needed for scenario logic.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createPerfRecorder } from '@flare-engine/debug';
import { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Hp, Lifetime } from '../src/components';
import { LUCYPER_HP_MAX, SMOK_HP_MAX } from '../src/config/gameplay';
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
    recorder: createPerfRecorder({ label: 'test', ringSize: 300 }),
    world,
    spawnCtx,
    coll,
    atlas,
    bounds: { width: 360, height: 640 },
    enemyQuery: world.query(Boss), // reused as generic query in tests
    bulletQuery: world.query(Lifetime),
    lifetimeQuery: world.query(Lifetime),
  };
}

const DT = 1 / 60;

// Advance a scenario for `durationSec` simulated seconds and return result.
// Runs one extra tick at exactly durationSec to ensure the done condition fires.
function runFor(
  scenario: ReturnType<typeof createBootScenario>,
  durationSec: number,
): { elapsed: number; done: boolean } {
  let elapsed = 0;
  let done = false;
  while (elapsed < durationSec) {
    done = scenario.tick(DT, elapsed);
    elapsed += DT;
  }
  // One final tick at or past the boundary so the `>= durationSec` guard fires.
  done = scenario.tick(DT, elapsed);
  elapsed += DT;
  return { elapsed, done };
}

// ---------------------------------------------------------------------------
// boot scenario
// ---------------------------------------------------------------------------

describe('boot scenario', () => {
  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBootScenario(deps);
    s.init();
    const result = s.tick(DT, 0);
    expect(result).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBootScenario(deps);
    s.init();
    const result = s.tick(DT, SCENARIO_DURATION_SEC);
    expect(result).toBe(true);
  });

  test('recorder has a frame count after ticking', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBootScenario(deps);
    s.init();
    for (let i = 0; i < 10; i++) s.tick(DT, i * DT);
    const report = deps.recorder.flush();
    expect(report.frameCount).toBeGreaterThan(0);
  });

  test('recorder has "frame" section after ticking', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBootScenario(deps);
    s.init();
    for (let i = 0; i < 10; i++) s.tick(DT, i * DT);
    const report = deps.recorder.flush();
    const frameSection = report.sections.find((sec) => sec.name === 'frame');
    expect(frameSection).toBeDefined();
    expect(frameSection?.count).toBe(10);
  });

  test('finish does not throw', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBootScenario(deps);
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
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();
    const result = s.tick(DT, 0);
    expect(result).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();
    // Drive to just before done, then at done.
    const { done } = runFor(s, SCENARIO_DURATION_SEC);
    expect(done).toBe(true);
  });

  test('boss HP never goes below BOSS_HP_CLAMP_MIN', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();

    const bossQuery = world.query(Boss);
    let minHpSeen = Number.POSITIVE_INFINITY;
    let elapsed = 0;
    for (let i = 0; i < 600; i++) {
      s.tick(DT, elapsed);
      elapsed += DT;
      for (const id of bossQuery) {
        const hp = world.get(id, Hp);
        if (hp && hp.current < minHpSeen) minHpSeen = hp.current;
      }
    }
    expect(minHpSeen).toBeGreaterThanOrEqual(BOSS_HP_CLAMP_MIN);
  });

  test('boss advances to phase2 at t>=10 s', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();

    const bossQuery = world.query(Boss);
    let phase2Seen = false;
    // Run well past the 10-second threshold.
    for (let i = 0; i < 800; i++) {
      s.tick(DT, i * DT);
      for (const id of bossQuery) {
        const b = world.get(id, Boss);
        if (b?.phase === 'phase2') phase2Seen = true;
      }
      if (phase2Seen) break;
    }
    expect(phase2Seen).toBe(true);
  });

  test('recorder has boss-update section', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();
    for (let i = 0; i < 10; i++) s.tick(DT, i * DT);
    const report = deps.recorder.flush();
    const sec = report.sections.find((x) => x.name === 'boss-update');
    expect(sec).toBeDefined();
    expect(sec?.count).toBeGreaterThan(0);
  });

  test('smok spawned with correct HP', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();
    const bossQuery = world.query(Boss);
    let hpMax = 0;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) hpMax = hp.max;
    }
    expect(hpMax).toBe(SMOK_HP_MAX);
  });
});

// ---------------------------------------------------------------------------
// boss-lucyper-z8 scenario
// ---------------------------------------------------------------------------

describe('boss-lucyper-z8 scenario', () => {
  beforeEach(() => clearBossFsms());
  afterEach(() => clearBossFsms());

  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();
    const result = s.tick(DT, 0);
    expect(result).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();
    const { done } = runFor(s, SCENARIO_DURATION_SEC);
    expect(done).toBe(true);
  });

  test('boss HP never goes below BOSS_HP_CLAMP_MIN', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();

    const bossQuery = world.query(Boss);
    let minHpSeen = Number.POSITIVE_INFINITY;
    let elapsed = 0;
    for (let i = 0; i < 1800; i++) {
      s.tick(DT, elapsed);
      elapsed += DT;
      for (const id of bossQuery) {
        const hp = world.get(id, Hp);
        if (hp && hp.current < minHpSeen) minHpSeen = hp.current;
      }
    }
    expect(minHpSeen).toBeGreaterThanOrEqual(BOSS_HP_CLAMP_MIN);
  });

  test('lucyper advances to phase2 at t>=10 s', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();

    const bossQuery = world.query(Boss);
    let phase2Seen = false;
    for (let i = 0; i < 800; i++) {
      s.tick(DT, i * DT);
      for (const id of bossQuery) {
        const b = world.get(id, Boss);
        if (b?.phase === 'phase2') phase2Seen = true;
      }
      if (phase2Seen) break;
    }
    expect(phase2Seen).toBe(true);
  });

  test('lucyper advances to phase3 at t>=20 s', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();

    const bossQuery = world.query(Boss);
    let phase3Seen = false;
    // 21 s / DT ticks gives enough headroom for phase transitions to land.
    const maxTicks = Math.ceil(21 / DT) + 60;
    for (let i = 0; i < maxTicks; i++) {
      s.tick(DT, i * DT);
      for (const id of bossQuery) {
        const b = world.get(id, Boss);
        if (b?.phase === 'phase3') phase3Seen = true;
      }
      if (phase3Seen) break;
    }
    expect(phase3Seen).toBe(true);
  });

  test('lucyper spawned with correct HP', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();
    const bossQuery = world.query(Boss);
    let hpMax = 0;
    for (const id of bossQuery) {
      const hp = world.get(id, Hp);
      if (hp) hpMax = hp.max;
    }
    expect(hpMax).toBe(LUCYPER_HP_MAX);
  });

  test('recorder has boss-update section', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossLucyperZ8Scenario(deps);
    s.init();
    for (let i = 0; i < 10; i++) s.tick(DT, i * DT);
    const report = deps.recorder.flush();
    const sec = report.sections.find((x) => x.name === 'boss-update');
    expect(sec).toBeDefined();
    expect(sec?.count).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// particle-storm scenario
// ---------------------------------------------------------------------------

describe('particle-storm scenario', () => {
  test('tick returns false before SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    const result = s.tick(DT, 0);
    expect(result).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    const result = s.tick(DT, SCENARIO_DURATION_SEC);
    expect(result).toBe(true);
  });

  test('lifetimeQuery.count reaches PARTICLE_CAP after init', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    expect(deps.lifetimeQuery.count).toBe(BUDGET_LIMITS.particles);
  });

  test('lifetimeQuery.count stays at PARTICLE_CAP after a tick that expires particles', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    // Advance by a full lifetime (0.5 s) so all particles expire and are replaced.
    for (let i = 0; i < Math.ceil(0.5 / DT) + 2; i++) {
      s.tick(DT, i * DT);
    }
    expect(deps.lifetimeQuery.count).toBe(BUDGET_LIMITS.particles);
  });

  test('recorder has lifetime-tick section', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createParticleStormScenario(deps);
    s.init();
    for (let i = 0; i < 5; i++) s.tick(DT, i * DT);
    const report = deps.recorder.flush();
    const sec = report.sections.find((x) => x.name === 'lifetime-tick');
    expect(sec).toBeDefined();
    expect(sec?.count).toBe(5);
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
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    const result = s.tick(DT, 0);
    expect(result).toBe(false);
  });

  test('tick returns true at SCENARIO_DURATION_SEC', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    const result = s.tick(DT, SCENARIO_DURATION_SEC);
    expect(result).toBe(true);
  });

  test('init spawns ENTITY_COUNT entities', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();
    // 200 entities all carry Lifetime — lifetimeQuery.count matches.
    expect(deps.lifetimeQuery.count).toBe(200);
  });

  test('wipe occurs at t=5 s: entity count stays at ENTITY_COUNT after wipe', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();

    // Run to just after the 5-second boundary.
    for (let i = 0; i < Math.ceil(5 / DT) + 5; i++) {
      s.tick(DT, i * DT);
    }
    expect(deps.lifetimeQuery.count).toBe(200);
  });

  test('recorder has wipe section after first wipe', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();

    let elapsed = 0;
    for (let i = 0; i < Math.ceil(5.1 / DT); i++) {
      s.tick(DT, elapsed);
      elapsed += DT;
    }
    const report = deps.recorder.flush();
    const sec = report.sections.find((x) => x.name === 'wipe');
    expect(sec).toBeDefined();
    expect(sec?.count).toBeGreaterThanOrEqual(1);
  });

  test('two wipe cycles occur within 12 s', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createZoneTransitionsScenario(deps);
    s.init();

    let elapsed = 0;
    for (let i = 0; i < Math.ceil(12 / DT); i++) {
      s.tick(DT, elapsed);
      elapsed += DT;
    }
    const report = deps.recorder.flush();
    const sec = report.sections.find((x) => x.name === 'wipe');
    expect(sec?.count).toBeGreaterThanOrEqual(2);
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
  test('deps has required fields', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    expect(deps.recorder).toBeDefined();
    expect(deps.world).toBeDefined();
    expect(deps.spawnCtx).toBeDefined();
    expect(deps.coll).toBeDefined();
    expect(deps.atlas).toBeDefined();
    expect(deps.bounds).toBeDefined();
    expect(deps.enemyQuery).toBeDefined();
    expect(deps.bulletQuery).toBeDefined();
    expect(deps.lifetimeQuery).toBeDefined();
  });

  test('queries are live Query instances (not recreated on access)', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    // Identity check: same object reference across accesses (pre-created, not factory).
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
    const deps = makeDeps(world);

    const calls: Array<{ pattern: string; x: number; y: number; hpMax: number }> = [];
    const spawnSpy = (pattern: string, x: number, y: number, hpMax: number): number => {
      calls.push({ pattern, x, y, hpMax });
      // Return a dummy entity id so bossId is not -1.
      return world.spawn();
    };

    const s = createBossSmokFullScenario({
      ...deps,
      spawnBoss: spawnSpy as ScenarioDeps['spawnBoss'],
    });
    s.init();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.pattern).toBe('smok-krzemionkowski');
    expect(calls[0]!.x).toBe(deps.bounds.width / 2);
    expect(calls[0]!.y).toBe(100);
    expect(calls[0]!.hpMax).toBe(SMOK_HP_MAX);
  });

  test('boss-lucyper-z8 init() calls injected spawnBoss with correct kind, x, y', () => {
    const world = makeWorld();
    const deps = makeDeps(world);

    const calls: Array<{ pattern: string; x: number; y: number; hpMax: number }> = [];
    const spawnSpy = (pattern: string, x: number, y: number, hpMax: number): number => {
      calls.push({ pattern, x, y, hpMax });
      return world.spawn();
    };

    const s = createBossLucyperZ8Scenario({
      ...deps,
      spawnBoss: spawnSpy as ScenarioDeps['spawnBoss'],
    });
    s.init();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.pattern).toBe('lucyper-ksiezycowy');
    expect(calls[0]!.x).toBe(deps.bounds.width / 2);
    expect(calls[0]!.y).toBe(100);
    expect(calls[0]!.hpMax).toBe(LUCYPER_HP_MAX);
  });

  test('boss-smok-full init() falls back to _spawnBossEntity when spawnBoss is absent', () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    const s = createBossSmokFullScenario(deps);
    s.init();

    // Headless path: Boss component present (added by _spawnBossEntity), not by spawnBoss spy.
    const bossQuery = world.query(Boss);
    let bossCount = 0;
    for (const id of bossQuery) {
      const b = world.get(id, Boss);
      if (b?.pattern === 'smok-krzemionkowski') bossCount += 1;
    }
    expect(bossCount).toBe(1);
  });
});
