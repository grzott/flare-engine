import { describe, expect, test } from 'bun:test';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

describe('flash decay override', () => {
  test('default rate (12.5/s) decays near zero by 100 ms', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash(12.5);
    for (let i = 0; i < 10; i++) fx.update(0.01);
    const entry = fx.chain.get('grayscale-flash');
    const u = entry?.uniforms as { kind: 'grayscale-flash'; intensity: number } | undefined;
    expect(u?.intensity).toBeLessThan(0.05);
  });

  test('slow rate (0.833/s) retains high intensity at 400 ms', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash(0.833);
    for (let i = 0; i < 25; i++) fx.update(0.016);
    const entry = fx.chain.get('grayscale-flash');
    const u = entry?.uniforms as { kind: 'grayscale-flash'; intensity: number } | undefined;
    expect(u?.intensity).toBeGreaterThan(0.5);
  });
});
