import { beforeEach, describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { createTestWorld } from '@flare-engine/testing';
import {
  _resetCapsForTest,
  _resetNowForTest,
  _setNowForTest,
  resetCataclysmGate,
  triggerExplosion,
} from '../src/fx/explosions';
import type { AtlasHandle } from '../src/spawn';

function makeAtlas(): AtlasHandle {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-spark', x: 0, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-spark', 0);
  sheet.frames.push({ name: 'particle-smoke', x: 8, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-smoke', 1);
  return { image: {} as never, sheet } as unknown as AtlasHandle;
}

describe('explosion concurrent caps', () => {
  beforeEach(() => {
    _resetNowForTest();
    _resetCapsForTest();
    resetCataclysmGate('z1');
  });

  test('Tier III: first 4 fire as burst, 5th degrades to pop', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();

    for (let i = 0; i < 4; i++) {
      const tier = triggerExplosion(world, atlas, null, null, false, 0, 0, 'burst', 'z1');
      expect(tier).toBe('burst');
    }
    const fifth = triggerExplosion(world, atlas, null, null, false, 0, 0, 'burst', 'z1');
    expect(fifth).toBe('pop');
  });

  test('Tier IV: first fires as detonation, 2nd degrades to burst', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();

    const first = triggerExplosion(world, atlas, null, null, false, 0, 0, 'detonation', 'z1');
    expect(first).toBe('detonation');

    const second = triggerExplosion(world, atlas, null, null, false, 0, 0, 'detonation', 'z1');
    expect(second).toBe('burst');
  });

  test('Tier V same zone: first fires as cataclysm, 2nd degrades to detonation', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();

    const first = triggerExplosion(world, atlas, null, null, false, 0, 0, 'cataclysm', 'z1');
    expect(first).toBe('cataclysm');

    const second = triggerExplosion(world, atlas, null, null, false, 0, 0, 'cataclysm', 'z1');
    expect(second).toBe('detonation');
  });

  test('Tier V after zone reset: fires as cataclysm again', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();

    triggerExplosion(world, atlas, null, null, false, 0, 0, 'cataclysm', 'z1');
    resetCataclysmGate('z1');

    const again = triggerExplosion(world, atlas, null, null, false, 0, 0, 'cataclysm', 'z1');
    expect(again).toBe('cataclysm');
  });

  test('caps expire after lifetime: burst slot frees when expiry passes', () => {
    let now = 1000;
    _setNowForTest(() => now);

    const { world } = createTestWorld();
    const atlas = makeAtlas();

    // Fill 4 burst slots.
    for (let i = 0; i < 4; i++) {
      triggerExplosion(world, atlas, null, null, false, 0, 0, 'burst', 'z1');
    }

    // 5th should degrade to pop.
    const fifth = triggerExplosion(world, atlas, null, null, false, 0, 0, 'burst', 'z1');
    expect(fifth).toBe('pop');

    // Advance time past burst lifeMs (520 ms).
    now += 600;

    // Now burst slot is free — should fire as burst again.
    const afterExpiry = triggerExplosion(world, atlas, null, null, false, 0, 0, 'burst', 'z1');
    expect(afterExpiry).toBe('burst');
  });
});
