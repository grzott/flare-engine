import { describe, expect, test } from 'bun:test';
import type { Effect } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

describe('postfx chain', () => {
  test('chain has vignette + bloom + grayscale-flash', () => {
    const fx = createPanTvardowskiPostFx(null);
    const ids = fx.chain.all().map((e: Effect) => e.id);
    expect(ids).toContain('vignette');
    expect(ids).toContain('bloom');
    expect(ids).toContain('grayscale-flash');
  });

  test('vignette params match deck (intensity 0.35, radius 0.82)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const v = fx.chain.all().find((e: Effect) => e.id === 'vignette');
    if (v?.uniforms.kind !== 'vignette') throw new Error('vignette missing');
    expect(v.uniforms.intensity).toBeCloseTo(0.35);
    expect(v.uniforms.radius).toBeCloseTo(0.82);
  });

  test('bloom params match deck (threshold 0.72, intensity 0.5)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const b = fx.chain.all().find((e: Effect) => e.id === 'bloom');
    if (b?.uniforms.kind !== 'bloom') throw new Error('bloom missing');
    expect(b.uniforms.threshold).toBeCloseTo(0.72);
    expect(b.uniforms.intensity).toBeCloseTo(0.5);
  });

  test('triggerHitFlash spikes grayscale-flash intensity to 1', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    const f = fx.chain.all().find((e: Effect) => e.id === 'grayscale-flash');
    if (f?.uniforms.kind !== 'grayscale-flash') throw new Error('grayscale-flash missing');
    expect(f.uniforms.intensity).toBeCloseTo(1);
  });

  test('intensity decays to ~0 after update(1/decay)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    // decay rate is 4.2; after 1/4.2 ≈ 0.238 s the flash should be at ~0
    fx.update(1 / 4.2);
    const f = fx.chain.all().find((e: Effect) => e.id === 'grayscale-flash');
    if (f?.uniforms.kind !== 'grayscale-flash') throw new Error('grayscale-flash missing');
    expect(f.uniforms.intensity).toBeLessThan(0.05);
  });
});
