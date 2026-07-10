import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { createGodRays } from '../src/effect.js';
import {
  createPostFxRuntime,
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
} from '../src/runtime.js';
import { GOD_RAYS_SKSL } from '../src/shaders.js';

function createMockSkia(): { skia: SkiaPostFxModuleLike; compiled: string[] } {
  const compiled: string[] = [];
  const fake: SkiaRuntimeEffectLike = { makeShaderWithChildren: () => ({}) };
  return {
    compiled,
    skia: {
      RuntimeEffect: {
        Make: (sksl: string) => {
          compiled.push(sksl);
          return fake;
        },
      },
    },
  };
}

describe('god-rays effect', () => {
  test('createGodRays default factory', () => {
    const e = createGodRays();
    expect(e.id).toBe('god-rays');
    expect(e.enabled).toBe(true);
    expect(e.uniforms.kind).toBe('god-rays');
    if (e.uniforms.kind === 'god-rays') {
      expect(e.uniforms.lightX).toBe(0.5);
      expect(e.uniforms.lightY).toBe(0.1);
      expect(e.uniforms.color).toEqual([1.0, 0.95, 0.8]);
      expect(e.uniforms.intensity).toBe(0.6);
      expect(e.uniforms.decay).toBe(0.96);
      expect(e.uniforms.density).toBe(0.5);
      expect(e.uniforms.weight).toBe(0.4);
      expect(e.uniforms.samples).toBe(48);
    }
  });

  test('createGodRays with partial uniforms respects overrides', () => {
    const e = createGodRays('my-rays', { intensity: 0.9, lightX: 0.2 });
    expect(e.id).toBe('my-rays');
    if (e.uniforms.kind === 'god-rays') {
      expect(e.uniforms.intensity).toBe(0.9);
      expect(e.uniforms.lightX).toBe(0.2);
      // un-overridden fields keep defaults
      expect(e.uniforms.lightY).toBe(0.1);
      expect(e.uniforms.color).toEqual([1.0, 0.95, 0.8]);
      expect(e.uniforms.decay).toBe(0.96);
      expect(e.uniforms.density).toBe(0.5);
      expect(e.uniforms.weight).toBe(0.4);
      expect(e.uniforms.samples).toBe(48);
    }
  });

  test('packUniforms layout and samples clamp', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);

    const e = createGodRays('gr', {
      lightX: 0.3,
      lightY: 0.15,
      color: [1.0, 0.9, 0.7],
      intensity: 0.8,
      decay: 0.95,
      density: 0.6,
      weight: 0.3,
      samples: 32,
    });
    const packed = rt.packUniforms(e, 800, 600);
    expect(packed.length).toBe(12);
    expect(packed[0]).toBe(800); // width
    expect(packed[1]).toBe(600); // height
    expect(packed[2]).toBeCloseTo(0.3, 5); // lightX
    expect(packed[7]).toBeCloseTo(0.8, 5); // intensity
    expect(packed[11]).toBe(32); // samples

    // samples clamp: 200 → 64
    const eClamped = createGodRays('gr2', { samples: 200 });
    const packedClamped = rt.packUniforms(eClamped, 800, 600);
    expect(packedClamped[11]).toBe(64);
  });

  test('scaleIntensity via buildPass scales packed[7] only', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createGodRays('gr', { lightX: 0.3, intensity: 0.8, samples: 32 }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    // intensity halved
    expect(pass[0]?.uniforms[7]).toBeCloseTo(0.4, 5);
    // lightX untouched
    expect(pass[0]?.uniforms[2]).toBeCloseTo(0.3, 5);
    // samples untouched
    expect(pass[0]?.uniforms[11]).toBe(32);
  });

  test('SKSL_SOURCE wiring — compile calls Make with GOD_RAYS_SKSL', () => {
    const { skia, compiled } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    rt.compile('god-rays');
    expect(compiled).toContain(GOD_RAYS_SKSL);
  });
});
