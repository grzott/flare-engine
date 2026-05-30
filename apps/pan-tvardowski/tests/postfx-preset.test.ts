import { describe, expect, test } from 'bun:test';
import type { CompositeUniforms } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';
import { BASELINE_POSTFX, resolvePostFx } from '../src/visual-spec/postfx';
import type { PostFxPresetDef } from '../src/visual-spec/types';

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

describe('BASELINE_POSTFX — values match prior hardcodes', () => {
  test('vignette intensity=0.35, radius=0.82', () => {
    expect(BASELINE_POSTFX.vignette.intensity).toBeCloseTo(0.35);
    expect(BASELINE_POSTFX.vignette.radius).toBeCloseTo(0.82);
  });

  test('bloom threshold=0.72, intensity=0.5', () => {
    expect(BASELINE_POSTFX.bloom.threshold).toBeCloseTo(0.72);
    expect(BASELINE_POSTFX.bloom.intensity).toBeCloseTo(0.5);
  });

  test('chroma amount=0.012', () => {
    expect(BASELINE_POSTFX.chroma.amount).toBeCloseTo(0.012);
  });

  test('crt scanlineIntensity=0.25, curvature=0.12', () => {
    expect(BASELINE_POSTFX.crt.scanlineIntensity).toBeCloseTo(0.25);
    expect(BASELINE_POSTFX.crt.curvature).toBeCloseTo(0.12);
  });

  test('flashDecayRate=12.5', () => {
    expect(BASELINE_POSTFX.flashDecayRate).toBeCloseTo(12.5);
  });
});

describe('resolvePostFx — undefined override returns base identity', () => {
  test('returns the base object when override is undefined', () => {
    const result = resolvePostFx(BASELINE_POSTFX, undefined);
    expect(result).toBe(BASELINE_POSTFX);
  });
});

describe('resolvePostFx — sub-object replacement', () => {
  test('bloom override replaces bloom sub-object wholesale', () => {
    const override: Partial<PostFxPresetDef> = {
      bloom: { threshold: 0.55, intensity: 0.8 },
    };
    const result = resolvePostFx(BASELINE_POSTFX, override);
    expect(result.bloom.threshold).toBeCloseTo(0.55);
    expect(result.bloom.intensity).toBeCloseTo(0.8);
  });

  test('bloom override does not affect other sub-objects', () => {
    const override: Partial<PostFxPresetDef> = {
      bloom: { threshold: 0.55, intensity: 0.8 },
    };
    const result = resolvePostFx(BASELINE_POSTFX, override);
    expect(result.vignette).toBe(BASELINE_POSTFX.vignette);
    expect(result.chroma).toBe(BASELINE_POSTFX.chroma);
    expect(result.crt).toBe(BASELINE_POSTFX.crt);
    expect(result.flashDecayRate).toBeCloseTo(BASELINE_POSTFX.flashDecayRate);
  });

  test('vignette override replaces vignette sub-object wholesale', () => {
    const override: Partial<PostFxPresetDef> = {
      vignette: { intensity: 0.5, radius: 0.75 },
    };
    const result = resolvePostFx(BASELINE_POSTFX, override);
    expect(result.vignette.intensity).toBeCloseTo(0.5);
    expect(result.vignette.radius).toBeCloseTo(0.75);
  });

  test('flashDecayRate scalar override takes effect', () => {
    const override: Partial<PostFxPresetDef> = { flashDecayRate: 8.0 };
    const result = resolvePostFx(BASELINE_POSTFX, override);
    expect(result.flashDecayRate).toBeCloseTo(8.0);
  });

  test('empty override object returns all baseline sub-objects by identity', () => {
    const result = resolvePostFx(BASELINE_POSTFX, {});
    expect(result.vignette).toBe(BASELINE_POSTFX.vignette);
    expect(result.bloom).toBe(BASELINE_POSTFX.bloom);
    expect(result.chroma).toBe(BASELINE_POSTFX.chroma);
    expect(result.crt).toBe(BASELINE_POSTFX.crt);
    expect(result.flashDecayRate).toBeCloseTo(BASELINE_POSTFX.flashDecayRate);
  });
});

describe('createPanTvardowskiPostFx — preset parameter', () => {
  test('no preset: vignette and bloom uniforms match baseline', () => {
    const fx = createPanTvardowskiPostFx(null);
    const u = getComposite(fx);
    expect(u.vignetteIntensity).toBeCloseTo(BASELINE_POSTFX.vignette.intensity);
    expect(u.vignetteRadius).toBeCloseTo(BASELINE_POSTFX.vignette.radius);
    expect(u.bloomThreshold).toBeCloseTo(BASELINE_POSTFX.bloom.threshold);
    expect(u.bloomIntensity).toBeCloseTo(BASELINE_POSTFX.bloom.intensity);
  });

  test('bloom override flows into composite uniforms at construction', () => {
    const fx = createPanTvardowskiPostFx(null, {
      bloom: { threshold: 0.55, intensity: 0.8 },
    });
    const u = getComposite(fx);
    expect(u.bloomThreshold).toBeCloseTo(0.55);
    expect(u.bloomIntensity).toBeCloseTo(0.8);
  });

  test('bloom-pulse restores to overridden baseline intensity, not 0.5', () => {
    const customIntensity = 0.8;
    const fx = createPanTvardowskiPostFx(null, {
      bloom: { threshold: 0.55, intensity: customIntensity },
    });
    fx.triggerBloomPulse(100);
    for (let i = 0; i < 11; i++) fx.update(0.01);
    expect(getComposite(fx).bloomIntensity).toBeCloseTo(customIntensity);
  });

  test('setVignetteColor updates vignetteColor on the composite', () => {
    const fx = createPanTvardowskiPostFx(null, {
      vignette: { intensity: 0.5, radius: 0.75 },
    });
    fx.setVignetteColor(1, 0, 0);
    const u = getComposite(fx);
    expect(u.vignetteColor[0]).toBe(1);
    expect(u.vignetteColor[1]).toBe(0);
    expect(u.vignetteColor[2]).toBe(0);
    // vignette shape params from the preset are unchanged
    expect(u.vignetteIntensity).toBeCloseTo(0.5);
    expect(u.vignetteRadius).toBeCloseTo(0.75);
  });
});
