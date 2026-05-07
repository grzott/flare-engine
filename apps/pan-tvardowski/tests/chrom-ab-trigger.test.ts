import { describe, expect, test } from 'bun:test';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

describe('chromatic-aberration trigger', () => {
  test('triggerChromaticAb enables the effect immediately', () => {
    const fx = createPanTvardowskiPostFx(null);
    expect(fx.chain.get('chromatic-aberration')?.enabled).toBe(false);
    fx.triggerChromaticAb(200);
    expect(fx.chain.get('chromatic-aberration')?.enabled).toBe(true);
  });

  test('chromatic-ab disables after decay period', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerChromaticAb(200);
    expect(fx.chain.get('chromatic-aberration')?.enabled).toBe(true);
    for (let i = 0; i < 21; i++) fx.update(0.01);
    expect(fx.chain.get('chromatic-aberration')?.enabled).toBe(false);
  });
});
