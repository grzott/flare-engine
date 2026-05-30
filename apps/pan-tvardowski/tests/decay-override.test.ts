import { describe, expect, test } from 'bun:test';
import type { CompositeUniforms } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

describe('flash decay override', () => {
  test('default rate (12.5/s) decays near zero by 100 ms', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash(12.5);
    for (let i = 0; i < 10; i++) fx.update(0.01);
    expect(getComposite(fx).flashIntensity).toBeLessThan(0.05);
  });

  test('slow rate (0.833/s) retains high intensity at 400 ms', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash(0.833);
    for (let i = 0; i < 25; i++) fx.update(0.016);
    expect(getComposite(fx).flashIntensity).toBeGreaterThan(0.5);
  });
});
