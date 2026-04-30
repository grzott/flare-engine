import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import { createTestWorld } from '@flare-engine/testing';
import { Lifetime } from '../src/components';
import { createAmbienceState, tickAmbience } from '../src/fx/ambience';
import { ZONE_PALETTES } from '../src/palette';
import type { AtlasHandle } from '../src/spawn';

function makeAtlas(): AtlasHandle {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-smoke', x: 0, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-smoke', 0);
  return { image: {} as never, sheet } as unknown as AtlasHandle;
}

const BOUNDS = { width: 360, height: 640 };

describe('zone-ambience', () => {
  test('all 8 ZONE_PALETTES entries have correct ambienceName and ambienceParticles', () => {
    expect(ZONE_PALETTES[1].ambienceName).toBe('ember');
    expect(ZONE_PALETTES[1].ambienceParticles).toBe(32);

    expect(ZONE_PALETTES[2].ambienceName).toBe('pollen');
    expect(ZONE_PALETTES[2].ambienceParticles).toBe(80);

    expect(ZONE_PALETTES[3].ambienceName).toBe('spray');
    expect(ZONE_PALETTES[3].ambienceParticles).toBe(48);

    expect(ZONE_PALETTES[4].ambienceName).toBe('ember');
    expect(ZONE_PALETTES[4].ambienceParticles).toBe(96);

    expect(ZONE_PALETTES[5].ambienceName).toBe('ash');
    expect(ZONE_PALETTES[5].ambienceParticles).toBe(128);

    expect(ZONE_PALETTES[6].ambienceName).toBe('dust');
    expect(ZONE_PALETTES[6].ambienceParticles).toBe(24);

    expect(ZONE_PALETTES[7].ambienceName).toBe('smoke');
    expect(ZONE_PALETTES[7].ambienceParticles).toBe(16);

    expect(ZONE_PALETTES[8].ambienceName).toBe('float');
    expect(ZONE_PALETTES[8].ambienceParticles).toBe(64);
  });

  test('createAmbienceState returns expected shape', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);

    expect(state.ring).toBeInstanceOf(Int32Array);
    expect(state.ringHead).toBe(0);
    expect(state.accumulator).toBe(0);
    expect(state.lcg).not.toBe(0);
  });

  test('tickAmbience with reducedMotion=false, bossActive=false spawns >= 1 entity', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    const palette = ZONE_PALETTES[1];

    // Use dt large enough to guarantee at least one emit interval.
    // spawnRate = 32 / 8 = 4 per second, interval = 0.25 s.
    const dt = 1.0;
    tickAmbience(state, dt, palette, BOUNDS, false, false);

    const posQuery = world.query(Position);
    let count = 0;
    for (const id of posQuery) {
      if (world.get(id, Lifetime)) count++;
    }
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('tickAmbience with reducedMotion=true spawns 0 entities', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    const palette = ZONE_PALETTES[1];

    for (let i = 0; i < 10; i++) {
      tickAmbience(state, 1.0, palette, BOUNDS, true, false);
    }

    const posQuery = world.query(Position);
    let count = 0;
    for (const id of posQuery) {
      if (world.get(id, Lifetime)) count++;
    }
    expect(count).toBe(0);
  });

  test('tickAmbience with bossActive=true spawns 0 entities', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    const palette = ZONE_PALETTES[1];

    for (let i = 0; i < 10; i++) {
      tickAmbience(state, 1.0, palette, BOUNDS, false, true);
    }

    const posQuery = world.query(Position);
    let count = 0;
    for (const id of posQuery) {
      if (world.get(id, Lifetime)) count++;
    }
    expect(count).toBe(0);
  });
});
