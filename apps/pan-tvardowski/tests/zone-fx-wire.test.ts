import { describe, expect, test } from 'bun:test';
import type { CompositeUniforms } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';
import { ZONE_FX_DEFS } from '../src/visual-spec/zone-fx';

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

describe('zone-fx-wire: weatherKind + weatherIntensity on composite', () => {
  test('Z1 sets weatherKind=1 (rain) with intensity 0.55', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(1);
    expect(u.weatherIntensity).toBe(0.55);
  });

  test('Z2 sets weatherKind=2 (sun-shaft) with intensity 0.45', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[2]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(2);
    expect(u.weatherIntensity).toBe(0.45);
  });

  test('Z3 sets weatherKind=1 (rain) with intensity 0.7', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[3]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(1);
    expect(u.weatherIntensity).toBe(0.7);
  });

  test('Z4 sets weatherKind=3 (dark-vignette) with intensity 0.5', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[4]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(3);
    expect(u.weatherIntensity).toBe(0.5);
  });

  test('Z5 sets weatherKind=3 (dark-vignette) with intensity 0.75', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[5]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(3);
    expect(u.weatherIntensity).toBe(0.75);
  });

  test('Z6 sets weatherKind=3 (dark-vignette) with intensity 0.65', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[6]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(3);
    expect(u.weatherIntensity).toBe(0.65);
  });

  test('Z7 sets weatherKind=4 (clouds) with intensity 0.4', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[7]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(4);
    expect(u.weatherIntensity).toBe(0.4);
  });

  test('Z8 sets weatherKind=4 (clouds) with intensity 0.6', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[8]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(4);
    expect(u.weatherIntensity).toBe(0.6);
  });
});

describe('zone-fx-wire: tick advances scroll accumulators', () => {
  test('rain (Z1, speed=180): update(0.016) advances weatherScrollY by normalized phase (speed*dt*SCROLL_K)', () => {
    const SCROLL_K = 1 / 40;
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.update(0.016);
    expect(getComposite(fx).weatherScrollY).toBeCloseTo((180 * 0.016 * SCROLL_K) % 1.0, 5);
  });

  test('clouds (Z7, speed=60 direction=10): update(0.016) advances weatherScrollX by ~speed*dt*cos(dir)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[7]);
    fx.update(0.016);
    const expected = 60 * 0.016 * Math.cos((10 * Math.PI) / 180);
    expect(getComposite(fx).weatherScrollX).toBeCloseTo(expected, 5);
  });
});

describe('zone-fx-wire: zone change updates composite uniforms', () => {
  test('Z1 then Z3 (both rain): weatherKind stays 1, intensity updates to 0.7', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.setZoneFxDef(ZONE_FX_DEFS[3]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(1);
    expect(u.weatherIntensity).toBe(0.7);
  });

  test('Z1 (rain) then Z7 (clouds): weatherKind changes from 1 to 4', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.setZoneFxDef(ZONE_FX_DEFS[7]);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(4);
  });

  test('Z4 then undefined: weatherKind=0 and weatherIntensity=0', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[4]);
    fx.setZoneFxDef(undefined);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(0);
    expect(u.weatherIntensity).toBe(0);
  });
});

describe('zone-fx-wire: dark-vignette does not advance scroll', () => {
  test('Z4: 10 update(0.1) calls leave weatherScrollY and weatherScrollX at 0', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[4]);
    for (let i = 0; i < 10; i++) fx.update(0.1);
    const u = getComposite(fx);
    expect(u.weatherScrollY).toBe(0);
    expect(u.weatherScrollX).toBe(0);
  });
});

describe('zone-fx-wire: weatherColor passthrough', () => {
  test('Z1 (rain): u.weatherColor equals [0.75, 0.82, 0.90]', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    expect(getComposite(fx).weatherColor).toEqual([0.75, 0.82, 0.9]);
  });

  test('Z3 (rain): u.weatherColor equals [0.62, 0.78, 0.88]', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[3]);
    expect(getComposite(fx).weatherColor).toEqual([0.62, 0.78, 0.88]);
  });

  test('Z2 (sun-shaft, non-rain): u.weatherColor equals [1.0, 1.0, 1.0]', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[2]);
    expect(getComposite(fx).weatherColor).toEqual([1.0, 1.0, 1.0]);
  });

  test('Z1 then undefined: u.weatherColor resets to [1.0, 1.0, 1.0]', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.setZoneFxDef(undefined);
    expect(getComposite(fx).weatherColor).toEqual([1.0, 1.0, 1.0]);
  });
});

describe('zone-fx-wire: new cases', () => {
  test('setZoneFxDef(undefined) sets weatherKind=0 and weatherIntensity=0', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.setZoneFxDef(undefined);
    const u = getComposite(fx);
    expect(u.weatherKind).toBe(0);
    expect(u.weatherIntensity).toBe(0);
  });

  test('triggerChromaticAb sets chromaAmount > 0; update(decayMs/1000) zeros it', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerChromaticAb(300);
    expect(getComposite(fx).chromaAmount).toBeGreaterThan(0);
    fx.update(0.3);
    expect(getComposite(fx).chromaAmount).toBe(0);
  });
});

describe('zone-fx-wire: weatherDensity + weatherStreakLen passthrough', () => {
  test('Z1 (rain, density=0.45 streakLen=0.12): u.weatherDensity and u.weatherStreakLen pinned', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    const u = getComposite(fx);
    expect(u.weatherDensity).toBe(0.45);
    expect(u.weatherStreakLen).toBe(0.12);
  });

  test('Z3 (rain, density=0.7 streakLen=0.2): u.weatherDensity and u.weatherStreakLen pinned', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[3]);
    const u = getComposite(fx);
    expect(u.weatherDensity).toBe(0.7);
    expect(u.weatherStreakLen).toBe(0.2);
  });

  test('Z2 (sun-shaft, no density/streakLen): u.weatherDensity=0.5, u.weatherStreakLen=0.15 (defaults)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[2]);
    const u = getComposite(fx);
    expect(u.weatherDensity).toBe(0.5);
    expect(u.weatherStreakLen).toBe(0.15);
  });

  test('Z1 then undefined: density/streakLen reset to defaults 0.5/0.15', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.setZoneFxDef(undefined);
    const u = getComposite(fx);
    expect(u.weatherDensity).toBe(0.5);
    expect(u.weatherStreakLen).toBe(0.15);
  });
});

describe('zone-fx-wire: scroll wrap stays in [0, 1)', () => {
  test('rain (Z1, speed=180): after many ticks, weatherScrollY is always in [0, 1)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    // 100 ticks of dt=0.1s: raw accumulator without wrap = 180 * 100 * 0.1 = 1800 >> 1.0
    for (let i = 0; i < 100; i++) fx.update(0.1);
    const y = getComposite(fx).weatherScrollY;
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(1.0);
  });

  test('rain (Z3, speed=220): large dt wraps weatherScrollY into [0, 1)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[3]);
    // single tick of dt=10s: raw accumulator without wrap = 220 * 10 = 2200 >> 1.0
    fx.update(10);
    const y = getComposite(fx).weatherScrollY;
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(1.0);
  });
});
