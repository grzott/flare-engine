import { describe, expect, test } from 'bun:test';
import type { CompositeUniforms } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

describe('chromatic-aberration trigger', () => {
  test('triggerChromaticAb sets chromaAmount to baseline immediately', () => {
    const fx = createPanTvardowskiPostFx(null);
    expect(getComposite(fx).chromaAmount).toBe(0);
    fx.triggerChromaticAb(200);
    expect(getComposite(fx).chromaAmount).toBeGreaterThan(0);
  });

  test('chromaAmount zeroes out after decay period elapses', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerChromaticAb(200);
    expect(getComposite(fx).chromaAmount).toBeGreaterThan(0);
    // advance exactly the decay window (200ms = 0.2s)
    fx.update(0.2);
    expect(getComposite(fx).chromaAmount).toBe(0);
  });
});
