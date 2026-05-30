import { describe, expect, test } from 'bun:test';
import type { CompositeUniforms } from '@flare-engine/postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

describe('crt effect', () => {
  test('crt is disabled by default', () => {
    const fx = createPanTvardowskiPostFx(null);
    expect(getComposite(fx).crtEnabled).toBe(false);
  });

  test('setCrtEnabled toggles the crtEnabled uniform', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setCrtEnabled(true);
    expect(getComposite(fx).crtEnabled).toBe(true);
    fx.setCrtEnabled(false);
    expect(getComposite(fx).crtEnabled).toBe(false);
  });
});
