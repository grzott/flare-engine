import { describe, expect, test } from 'bun:test';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';
import { BASELINE_POSTFX, resolvePostFx } from '../src/visual-spec/postfx';
import type { PostFxPresetDef } from '../src/visual-spec/types';

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
  test('no preset: vignette and bloom match baseline', () => {
    const fx = createPanTvardowskiPostFx(null);
    const v = fx.chain.all().find((e) => e.id === 'vignette');
    const b = fx.chain.all().find((e) => e.id === 'bloom');
    if (v?.uniforms.kind !== 'vignette') throw new Error('vignette missing');
    if (b?.uniforms.kind !== 'bloom') throw new Error('bloom missing');
    expect(v.uniforms.intensity).toBeCloseTo(BASELINE_POSTFX.vignette.intensity);
    expect(v.uniforms.radius).toBeCloseTo(BASELINE_POSTFX.vignette.radius);
    expect(b.uniforms.threshold).toBeCloseTo(BASELINE_POSTFX.bloom.threshold);
    expect(b.uniforms.intensity).toBeCloseTo(BASELINE_POSTFX.bloom.intensity);
  });

  test('bloom override flows into chain at construction', () => {
    const fx = createPanTvardowskiPostFx(null, {
      bloom: { threshold: 0.55, intensity: 0.8 },
    });
    const b = fx.chain.all().find((e) => e.id === 'bloom');
    if (b?.uniforms.kind !== 'bloom') throw new Error('bloom missing');
    expect(b.uniforms.threshold).toBeCloseTo(0.55);
    expect(b.uniforms.intensity).toBeCloseTo(0.8);
  });

  test('bloom-pulse restores to overridden baseline intensity, not 0.5', () => {
    const customIntensity = 0.8;
    const fx = createPanTvardowskiPostFx(null, {
      bloom: { threshold: 0.55, intensity: customIntensity },
    });
    fx.triggerBloomPulse(100);
    for (let i = 0; i < 11; i++) fx.update(0.01);
    const b = fx.chain.all().find((e) => e.id === 'bloom');
    if (b?.uniforms.kind !== 'bloom') throw new Error('bloom missing');
    expect(b.uniforms.intensity).toBeCloseTo(customIntensity);
  });

  test('vignette setVignetteColor re-send uses overridden intensity and radius', () => {
    const fx = createPanTvardowskiPostFx(null, {
      vignette: { intensity: 0.5, radius: 0.75 },
    });
    fx.setVignetteColor(1, 0, 0);
    const v = fx.chain.all().find((e) => e.id === 'vignette');
    if (v?.uniforms.kind !== 'vignette') throw new Error('vignette missing');
    expect(v.uniforms.intensity).toBeCloseTo(0.5);
    expect(v.uniforms.radius).toBeCloseTo(0.75);
  });
});
