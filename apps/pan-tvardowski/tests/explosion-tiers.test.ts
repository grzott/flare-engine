import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import { createTestWorld } from '@flare-engine/testing';
import { Lifetime } from '../src/components';
import {
  EXPLOSION_PRESETS,
  type ExplosionTier,
  _resetCapsForTest,
  triggerExplosion,
} from '../src/fx/explosions';
import type { AtlasHandle } from '../src/spawn';

function makeAtlas(): AtlasHandle {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-spark', x: 0, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-spark', 0);
  sheet.frames.push({ name: 'particle-smoke', x: 8, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-smoke', 1);
  return {
    image: {} as never,
    sheet,
  } as unknown as AtlasHandle;
}

describe('explosion tier presets', () => {
  test('particle counts match deck', () => {
    expect(EXPLOSION_PRESETS.chip.particles).toBe(8);
    expect(EXPLOSION_PRESETS.pop.particles).toBe(24);
    expect(EXPLOSION_PRESETS.burst.particles).toBe(64);
    expect(EXPLOSION_PRESETS.detonation.particles).toBe(128);
    expect(EXPLOSION_PRESETS.cataclysm.particles).toBe(256);
  });

  test('lifeMs match deck', () => {
    expect(EXPLOSION_PRESETS.chip.lifeMs).toBe(120);
    expect(EXPLOSION_PRESETS.pop.lifeMs).toBe(280);
    expect(EXPLOSION_PRESETS.burst.lifeMs).toBe(520);
    expect(EXPLOSION_PRESETS.detonation.lifeMs).toBe(900);
    expect(EXPLOSION_PRESETS.cataclysm.lifeMs).toBe(1600);
  });

  test('chip has no shake; pop has shake.amp 2', () => {
    expect(EXPLOSION_PRESETS.chip.shake).toBeUndefined();
    expect(EXPLOSION_PRESETS.pop.shake?.amp).toBe(2);
  });

  test('burst/detonation/cataclysm shake amplitudes', () => {
    expect(EXPLOSION_PRESETS.burst.shake?.amp).toBe(5);
    expect(EXPLOSION_PRESETS.detonation.shake?.amp).toBe(10);
    expect(EXPLOSION_PRESETS.cataclysm.shake?.amp).toBe(14);
  });

  test('triggerExplosion spawns N entities for tier', () => {
    _resetCapsForTest();
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const tier: ExplosionTier = 'pop';
    triggerExplosion(world, atlas, null, null, false, 100, 200, tier, 'z1');

    // Count entities that have both Position and Lifetime (= particles).
    const posQuery = world.query(Position);
    let count = 0;
    for (const id of posQuery) {
      if (world.get(id, Lifetime)) count++;
    }
    expect(count).toBe(EXPLOSION_PRESETS.pop.particles);
  });
});
