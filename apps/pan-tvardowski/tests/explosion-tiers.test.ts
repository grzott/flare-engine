import { describe, expect, mock, test } from 'bun:test';
import { resetTween, tween, updateTween } from '@flare-engine/animation';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import { easeInCubic, easeOutCubic } from '@flare-engine/math';
import { createTestWorld } from '@flare-engine/testing';
import { shouldAllowSlowMo } from '../src/a11y/reduced-motion';
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

  test('detonation and cataclysm presets use perlin shakeMode', () => {
    expect(EXPLOSION_PRESETS.detonation.shake?.shakeMode).toBe('perlin');
    expect(EXPLOSION_PRESETS.cataclysm.shake?.shakeMode).toBe('perlin');
  });

  test('triggerExplosion detonation calls shakePerlin, not shake', () => {
    _resetCapsForTest();
    const { world } = createTestWorld();
    const atlas = makeAtlas();
    const spyShake = mock(() => {});
    const spyShakePerlin = mock(() => {});
    const camera = { shake: spyShake, shakePerlin: spyShakePerlin };

    triggerExplosion(world, atlas, camera, null, true, 100, 200, 'detonation', 'z1');

    expect(spyShakePerlin).toHaveBeenCalledTimes(1);
    expect(spyShakePerlin).toHaveBeenCalledWith(10, 0.32);
    expect(spyShake).not.toHaveBeenCalled();
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

describe('Tier-V cataclysm slow-mo tweens', () => {
  test('slowDownTween reaches ≈0.3 at t=800ms', () => {
    const slowDown = tween(1.0, 0.3, 0.8, easeInCubic);
    resetTween(slowDown);

    // Step to exactly 800 ms using rawDt steps.
    let timescale = 1.0;
    let accumulated = 0;
    const step = 0.016;
    while (accumulated < 0.8) {
      const remaining = 0.8 - accumulated;
      const dt = Math.min(step, remaining);
      timescale = updateTween(slowDown, dt);
      accumulated += dt;
    }

    expect(timescale).toBeCloseTo(0.3, 1);
  });

  test('recoveryTween reaches ≈1.0 at t=1200ms (after slowDown completes at 800ms)', () => {
    const slowDown = tween(1.0, 0.3, 0.8, easeInCubic);
    const recovery = tween(0.3, 1.0, 0.4, easeOutCubic);
    resetTween(slowDown);
    resetTween(recovery);

    let timescale = 1.0;
    // Drive slowDown for 800 ms.
    let accum = 0;
    const step = 0.016;
    while (accum < 0.8) {
      const dt = Math.min(step, 0.8 - accum);
      timescale = updateTween(slowDown, dt);
      accum += dt;
    }
    // Drive recovery for 400 ms (total 1200 ms).
    accum = 0;
    while (accum < 0.4) {
      const dt = Math.min(step, 0.4 - accum);
      timescale = updateTween(recovery, dt);
      accum += dt;
    }

    expect(timescale).toBeCloseTo(1.0, 1);
  });

  test('reducedMotion=true → shouldAllowSlowMo returns false (timescale stays 1.0)', () => {
    expect(shouldAllowSlowMo(true)).toBe(false);
    expect(shouldAllowSlowMo(false)).toBe(true);

    // Simulate the gate: reducedMotion=true means tweens are never reset,
    // so timescale is never touched and stays at 1.0.
    const slowDown = tween(1.0, 0.3, 0.8, easeInCubic);
    // Do NOT resetTween — gate is closed.
    // Tick 800 ms of rawDt — tween is done=false initial but we check done flag.
    let timescale = 1.0;
    if (!shouldAllowSlowMo(true)) {
      // Gate closed: write nothing; timescale remains 1.0.
    } else {
      resetTween(slowDown);
      timescale = updateTween(slowDown, 0.8);
    }
    expect(timescale).toBe(1.0);
  });
});
