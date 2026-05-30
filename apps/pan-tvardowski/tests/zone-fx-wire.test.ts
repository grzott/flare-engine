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
  test('rain (Z1, speed=180): update(0.016) advances weatherScrollY by ~2.88', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setZoneFxDef(ZONE_FX_DEFS[1]);
    fx.update(0.016);
    expect(getComposite(fx).weatherScrollY).toBeCloseTo(180 * 0.016, 5);
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
