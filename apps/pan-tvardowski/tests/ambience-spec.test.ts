import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position, Velocity } from '@flare-engine/ecs';
import { createTestWorld } from '@flare-engine/testing';
import {
  AMBIENCE_DRIFT_SPREAD,
  DEFAULT_TINT_ALPHA,
  VEL_FAST,
  VEL_SLOW,
  createAmbienceState,
  tickAmbience,
} from '../src/fx/ambience';
import type { AtlasHandle } from '../src/spawn';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';
import type { ZoneBackground } from '../src/visual-spec/types';
import { ZONE_PALETTES } from '../src/visual-spec/zones-palette';

type AmbienceSpec = ZoneBackground['ambience'];

function makeAtlas(): AtlasHandle {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-smoke', x: 0, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-smoke', 0);
  return { image: {} as never, sheet } as unknown as AtlasHandle;
}

const BOUNDS = { width: 360, height: 640 };
const PALETTE = ZONE_PALETTES[1];
const DT_Z1 = 1 / (32 / 8);

function spawnOne(ambienceSpec?: AmbienceSpec): { vx: number; vy: number } {
  const { world } = createTestWorld();
  const atlas = makeAtlas();
  const state = createAmbienceState(world, atlas);
  tickAmbience(state, DT_Z1, PALETTE, BOUNDS, false, false, ambienceSpec);
  const velQ = world.query(Velocity);
  const posQ = world.query(Position);
  let vx = 0;
  let vy = 0;
  for (const id of velQ) {
    const v = world.get(id, Velocity);
    if (v) {
      vx = v.x;
      vy = v.y;
    }
  }
  let spawned = 0;
  for (const _id of posQ) spawned++;
  expect(spawned).toBe(1);
  return { vx, vy };
}

describe('ambience-spec — exported default constants', () => {
  test('VEL_SLOW is 10', () => {
    expect(VEL_SLOW).toBe(10);
  });

  test('VEL_FAST is 20', () => {
    expect(VEL_FAST).toBe(20);
  });

  test('AMBIENCE_DRIFT_SPREAD is 16', () => {
    expect(AMBIENCE_DRIFT_SPREAD).toBe(16);
  });

  test('DEFAULT_TINT_ALPHA is 0.6', () => {
    expect(DEFAULT_TINT_ALPHA).toBeCloseTo(0.6);
  });
});

describe('ambience-spec — createAmbienceState defaults', () => {
  test('lastTintAlpha initialised to DEFAULT_TINT_ALPHA', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    expect(state.lastTintAlpha).toBeCloseTo(DEFAULT_TINT_ALPHA);
  });
});

describe('ambience-spec — tickAmbience without ambienceSpec uses hardcoded defaults', () => {
  test('spawned particle vy is VEL_SLOW or VEL_FAST (no override)', () => {
    const { vy } = spawnOne();
    expect(vy === VEL_SLOW || vy === VEL_FAST).toBe(true);
  });

  test('spawned particle |vx| <= AMBIENCE_DRIFT_SPREAD / 2 (no override)', () => {
    const { vx } = spawnOne();
    expect(Math.abs(vx)).toBeLessThanOrEqual(AMBIENCE_DRIFT_SPREAD / 2);
  });
});

describe('ambience-spec — per-zone velocity overrides take effect', () => {
  test('velSlowPxPerSec override propagates to slow-layer particle', () => {
    const spec: AmbienceSpec = {
      kind: 'ember',
      count: 32,
      velSlowPxPerSec: 5,
      velFastPxPerSec: 10,
    };
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    // Drive LCG to a known slow-layer slot: seed 12345 → first r < 0.5 check.
    // We sample multiple ticks until we find a slow-layer spawn.
    let foundSlow = false;
    for (let i = 0; i < 50; i++) {
      const s2 = createAmbienceState(world, atlas);
      for (let j = 0; j < i; j++) {
        s2.lcg = (s2.lcg * 16807) % 2147483647;
      }
      tickAmbience(s2, DT_Z1, PALETTE, BOUNDS, false, false, spec);
      const velQ = world.query(Velocity);
      for (const id of velQ) {
        const v = world.get(id, Velocity);
        if (v?.y === 5) {
          foundSlow = true;
          break;
        }
      }
      if (foundSlow) break;
    }
    expect(foundSlow).toBe(true);
    void state;
  });

  test('driftSpreadPx override bounds vx to narrower range', () => {
    const narrowSpread = 4;
    const spec: AmbienceSpec = { kind: 'ember', count: 32, driftSpreadPx: narrowSpread };
    const { vx } = spawnOne(spec);
    expect(Math.abs(vx)).toBeLessThanOrEqual(narrowSpread / 2);
  });

  test('tintAlpha override stored in state.lastTintAlpha after first tick', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    const spec: AmbienceSpec = { kind: 'ember', count: 32, tintAlpha: 0.3 };
    tickAmbience(state, DT_Z1, PALETTE, BOUNDS, false, false, spec);
    expect(state.lastTintAlpha).toBeCloseTo(0.3);
  });

  test('no ambienceSpec leaves state.lastTintAlpha at DEFAULT_TINT_ALPHA', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    tickAmbience(state, DT_Z1, PALETTE, BOUNDS, false, false);
    expect(state.lastTintAlpha).toBeCloseTo(DEFAULT_TINT_ALPHA);
  });
});

describe('ambience-spec — ZoneBackground.ambience optional fields are optional', () => {
  test('schema accepts ambience with only kind and count (no optional fields)', () => {
    const spec: AmbienceSpec = { kind: 'ember', count: 32 };
    expect(spec.velSlowPxPerSec).toBeUndefined();
    expect(spec.velFastPxPerSec).toBeUndefined();
    expect(spec.driftSpreadPx).toBeUndefined();
    expect(spec.tintAlpha).toBeUndefined();
  });

  test('schema accepts all 4 optional fields when provided', () => {
    const spec: AmbienceSpec = {
      kind: 'float',
      count: 64,
      velSlowPxPerSec: 3,
      velFastPxPerSec: 8,
      driftSpreadPx: 10,
      tintAlpha: 0.4,
    };
    expect(spec.velSlowPxPerSec).toBe(3);
    expect(spec.velFastPxPerSec).toBe(8);
    expect(spec.driftSpreadPx).toBe(10);
    expect(spec.tintAlpha).toBeCloseTo(0.4);
  });
});

describe('ambience-spec — Zone 5 (Łysa Góra) demo override reaches particle velocities', () => {
  test('ZONE_VISUAL_SPECS[5].bg.ambience carries the Z5 velocity override', () => {
    const spec = ZONE_VISUAL_SPECS[5].bg.ambience;
    expect(spec.velSlowPxPerSec).toBe(14);
    expect(spec.velFastPxPerSec).toBe(28);
  });

  test('Z5 ambienceSpec produces only 14 or 28 vy values across 100 sampled spawns', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const palette = ZONE_PALETTES[5];
    const spec = ZONE_VISUAL_SPECS[5].bg.ambience;
    // spawnRate = 128 / 8 = 16/s; interval = 1/16 s
    const dt = 1 / (palette.ambienceParticles / 8);

    const vyValues = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const state = createAmbienceState(world, atlas);
      // Advance LCG by i steps so we sample different LCG branches.
      for (let j = 0; j < i; j++) {
        state.lcg = (state.lcg * 16807) % 2147483647;
      }
      tickAmbience(state, dt, palette, BOUNDS, false, false, spec);
      const velQ = world.query(Velocity);
      for (const id of velQ) {
        const v = world.get(id, Velocity);
        if (v) vyValues.add(v.y);
      }
    }

    // Every spawned particle must have vy of 14 (slow) or 28 (fast) — never 10 or 20.
    for (const vy of vyValues) {
      expect(vy === 14 || vy === 28).toBe(true);
    }
    // Both layers must appear across 100 samples.
    expect(vyValues.has(14)).toBe(true);
    expect(vyValues.has(28)).toBe(true);
  });
});
