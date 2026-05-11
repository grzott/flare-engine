import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position, Velocity } from '@flare-engine/ecs';
import { createTestWorld } from '@flare-engine/testing';
import { applyShakePerlin, getParallaxVelocity, sigilOpacity } from '../src/a11y/reduced-motion';
import { Lifetime } from '../src/components';
import { createAmbienceState, tickAmbience } from '../src/fx/ambience';
import type { AtlasHandle } from '../src/spawn';
import { gameState, resetGameState } from '../src/state';
import { ZONE_PALETTES } from '../src/visual-spec/zones-palette';

function makeAtlas(): AtlasHandle {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-smoke', x: 0, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-smoke', 0);
  return { image: {} as never, sheet } as unknown as AtlasHandle;
}

const BOUNDS = { width: 360, height: 640 };

describe('applyShakePerlin reduced-motion gate', () => {
  afterEach(() => {
    resetGameState();
  });

  test('reducedMotion=true: sets redFlash=true, does not call shakePerlin', () => {
    gameState.settings.reducedMotion = true;
    gameState.settings.screenShake = true;
    const spyShakePerlin = mock(() => {});
    const camera = { shakePerlin: spyShakePerlin };

    applyShakePerlin(camera, 10, 0.32);

    expect(gameState.redFlash).toBe(true);
    expect(spyShakePerlin).not.toHaveBeenCalled();
  });
});

describe('reduced-motion extended helpers', () => {
  test('sigilOpacity returns 1.0 when reducedMotion=false', () => {
    expect(sigilOpacity(false)).toBe(1.0);
  });

  test('sigilOpacity returns 0.7 when reducedMotion=true', () => {
    expect(sigilOpacity(true)).toBe(0.7);
  });

  test('getParallaxVelocity passes base through when reducedMotion=false', () => {
    expect(getParallaxVelocity(20, false)).toBe(20);
    expect(getParallaxVelocity(-5, false)).toBe(-5);
  });

  test('getParallaxVelocity returns 0 for any base when reducedMotion=true', () => {
    expect(getParallaxVelocity(20, true)).toBe(0);
    expect(getParallaxVelocity(8, true)).toBe(0);
    expect(getParallaxVelocity(-3, true)).toBe(0);
  });

  test('tickAmbience reducedMotion=true spawns particles with vx=0 and vy=0', () => {
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const state = createAmbienceState(world, atlas);
    const palette = ZONE_PALETTES[1];

    tickAmbience(state, 1.0, palette, BOUNDS, true, false);

    const posQuery = world.query(Position);
    let spawned = 0;
    for (const id of posQuery) {
      if (!world.get(id, Lifetime)) continue;
      spawned++;
      const vel = world.get(id, Velocity);
      expect(vel).toBeDefined();
      expect(vel!.x).toBe(0);
      expect(vel!.y).toBe(0);
    }
    expect(spawned).toBeGreaterThanOrEqual(1);
  });
});
