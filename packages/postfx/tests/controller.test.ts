import { describe, expect, test } from 'bun:test';
import {
  createBloom,
  createGrayscaleFlash,
  createPostFxController,
  createVignette,
} from '../src/index.js';

function makeController(skia: { RuntimeEffect: { Make: () => null } } | null = null) {
  return createPostFxController({
    effects: [
      createVignette('v', { intensity: 0.4, radius: 0.8 }),
      createBloom('b', { threshold: 0.7, intensity: 0.5 }),
      createGrayscaleFlash('flash', { intensity: 0 }),
    ],
    skia,
    flash: { id: 'flash', decay: 4 },
  });
}

describe('createPostFxController', () => {
  test('builds a chain with the supplied effects in order', () => {
    const pfx = makeController();
    expect(pfx.chain.all().map((e) => e.id)).toEqual(['v', 'b', 'flash']);
  });

  test('triggerHitFlash spikes grayscale-flash to 1', () => {
    const pfx = makeController();
    pfx.triggerHitFlash();
    const flash = pfx.chain.get('flash');
    expect(flash?.uniforms.kind).toBe('grayscale-flash');
    // narrow by kind for TS
    if (flash?.uniforms.kind === 'grayscale-flash') {
      expect(flash.uniforms.intensity).toBe(1);
    }
  });

  test('update(dt) decays the flash at the configured rate', () => {
    const pfx = makeController();
    pfx.triggerHitFlash();
    pfx.update(0.1); // -0.4
    const flash = pfx.chain.get('flash');
    if (flash?.uniforms.kind === 'grayscale-flash') {
      expect(flash.uniforms.intensity).toBeCloseTo(0.6, 5);
    }
    pfx.update(1); // clamp at 0
    if (flash?.uniforms.kind === 'grayscale-flash') {
      expect(flash.uniforms.intensity).toBe(0);
    }
  });

  test('update is a no-op when flash has not fired', () => {
    const pfx = makeController();
    pfx.update(10);
    const flash = pfx.chain.get('flash');
    if (flash?.uniforms.kind === 'grayscale-flash') {
      expect(flash.uniforms.intensity).toBe(0);
    }
  });

  test('buildPass returns empty when Skia is unsupported', () => {
    const pfx = makeController();
    expect(pfx.buildPass(320, 240)).toEqual([]);
  });

  test('setMotionScale forwards to EffectChain.globalIntensity', () => {
    const pfx = makeController();
    pfx.setMotionScale(0);
    expect(pfx.chain.globalIntensity).toBe(0);
    pfx.setMotionScale(1);
    expect(pfx.chain.globalIntensity).toBe(1);
  });

  test('triggerHitFlash is a no-op when no flash is configured', () => {
    const pfx = createPostFxController({
      effects: [createVignette('v')],
    });
    pfx.triggerHitFlash();
    pfx.update(0.1);
    // Nothing to assert beyond no-throw; vignette unchanged.
    expect(pfx.chain.all().length).toBe(1);
  });
});
