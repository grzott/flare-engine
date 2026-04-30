import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import { createTestWorld } from '@flare-engine/testing';
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
const RING_SIZE = 256;

describe('ambient-density', () => {
  test('ring-buffer size >= max ambienceParticles across all 8 zones', () => {
    const maxParticles = Math.max(
      ...([1, 2, 3, 4, 5, 6, 7, 8] as const).map((id) => ZONE_PALETTES[id].ambienceParticles),
    );
    expect(RING_SIZE).toBeGreaterThanOrEqual(maxParticles);
  });

  test('Z5 (128 particles): dt=0.0625 s spawns exactly 1 entity per tick', () => {
    // spawnRate = 128 / 8 = 16 per second, interval = 1/16 = 0.0625 s
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    const palette = ZONE_PALETTES[5];

    const dt = 1 / 16;
    tickAmbience(state, dt, palette, BOUNDS, false, false);

    const posQuery = world.query(Position);
    let count = 0;
    for (const _id of posQuery) count++;
    expect(count).toBe(1);
  });
});
