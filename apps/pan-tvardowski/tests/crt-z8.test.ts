import { describe, expect, test } from 'bun:test';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

describe('crt effect', () => {
  test('crt is disabled by default', () => {
    const fx = createPanTvardowskiPostFx(null);
    expect(fx.chain.get('crt')?.enabled).toBe(false);
  });

  test('setCrtEnabled toggles the effect', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setCrtEnabled(true);
    expect(fx.chain.get('crt')?.enabled).toBe(true);
    fx.setCrtEnabled(false);
    expect(fx.chain.get('crt')?.enabled).toBe(false);
  });
});
