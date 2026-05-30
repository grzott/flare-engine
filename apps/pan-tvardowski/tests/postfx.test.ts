import { describe, expect, test } from 'bun:test';
import type { CompositeUniforms } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

describe('postfx chain', () => {
  test('chain contains exactly one composite effect', () => {
    const fx = createPanTvardowskiPostFx(null);
    const all = fx.chain.all();
    expect(all.length).toBe(1);
    expect(all[0]?.id).toBe('composite');
  });

  test('triggerHitFlash spikes flashIntensity to 1', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    expect(getComposite(fx).flashIntensity).toBe(1);
  });

  test('update decays flashIntensity toward 0', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    for (let i = 0; i < 50; i++) fx.update(0.01);
    expect(getComposite(fx).flashIntensity).toBeLessThan(1);
    for (let i = 0; i < 200; i++) fx.update(0.01);
    expect(getComposite(fx).flashIntensity).toBe(0);
  });

  test('buildPass returns empty list when skia module is null (unsupported)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const passes = fx.buildPass(360, 640);
    expect(Array.isArray(passes)).toBe(true);
    expect(passes.length).toBe(0);
  });
});
