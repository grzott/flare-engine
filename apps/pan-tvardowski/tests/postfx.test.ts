import { describe, expect, test } from 'bun:test';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

describe('postfx chain', () => {
  test('registers vignette + bloom + grayscale-flash (chromatic-aberration added disabled)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const ids = fx.chain.all().map((e) => e.id);
    expect(ids).toContain('vignette');
    expect(ids).toContain('bloom');
    expect(ids).toContain('grayscale-flash');
    expect(ids).toContain('chromatic-aberration');
    // chromatic-aberration is disabled at rest
    expect(fx.chain.get('chromatic-aberration')?.enabled).toBe(false);
  });

  test('triggerHitFlash spikes grayscale-flash intensity to 1', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    const entry = fx.chain.get('grayscale-flash');
    expect(entry).not.toBeNull();
    const u = entry?.uniforms as { kind: 'grayscale-flash'; intensity: number } | undefined;
    expect(u?.intensity).toBe(1);
  });

  test('update decays flash intensity toward 0', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    for (let i = 0; i < 50; i++) fx.update(0.01);
    const u = fx.chain.get('grayscale-flash')?.uniforms as
      | { kind: 'grayscale-flash'; intensity: number }
      | undefined;
    expect(u?.intensity).toBeLessThan(1);
    for (let i = 0; i < 200; i++) fx.update(0.01);
    const u2 = fx.chain.get('grayscale-flash')?.uniforms as
      | { kind: 'grayscale-flash'; intensity: number }
      | undefined;
    expect(u2?.intensity).toBe(0);
  });

  test('buildPass returns empty list when skia module is null (unsupported)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const passes = fx.buildPass(360, 640);
    expect(Array.isArray(passes)).toBe(true);
    expect(passes.length).toBe(0);
  });
});
