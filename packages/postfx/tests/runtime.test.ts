import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { createBloom, createCrt, createGrayscaleFlash, createVignette } from '../src/effect.js';
import {
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
  createPostFxRuntime,
} from '../src/runtime.js';

function createMockSkia(): { skia: SkiaPostFxModuleLike; compiled: string[] } {
  const compiled: string[] = [];
  const fake: SkiaRuntimeEffectLike = { makeShader: () => ({}) };
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

describe('createPostFxRuntime', () => {
  test('reports unsupported when Skia is missing', () => {
    const rt = createPostFxRuntime(null);
    expect(rt.supported).toBe(false);
    expect(rt.compile('vignette')).toBe(null);
    expect(rt.buildPass(new EffectChain(), 800, 600)).toEqual([]);
  });

  test('reports unsupported when RuntimeEffect.Make is absent', () => {
    const rt = createPostFxRuntime({ RuntimeEffect: {} as never });
    expect(rt.supported).toBe(false);
  });

  test('compile caches per-kind shaders', () => {
    const { skia, compiled } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    expect(rt.supported).toBe(true);
    rt.compile('vignette');
    rt.compile('vignette');
    rt.compile('bloom');
    expect(compiled.length).toBe(2);
  });

  test('reset() drops the compile cache', () => {
    const { skia, compiled } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    rt.compile('vignette');
    rt.reset();
    rt.compile('vignette');
    expect(compiled.length).toBe(2);
  });

  test('packUniforms emits the right layout per kind', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const vig = createVignette('v', { intensity: 0.5, radius: 0.7 });
    const uV = rt.packUniforms(vig, 800, 600);
    expect(uV.length).toBe(4);
    expect(uV[0]).toBe(800);
    expect(uV[1]).toBe(600);
    expect(uV[2]).toBeCloseTo(0.5, 5);
    expect(uV[3]).toBeCloseTo(0.7, 5);

    const gf = createGrayscaleFlash('g', { intensity: 0.3 });
    const packed = rt.packUniforms(gf, 800, 600);
    expect(packed.length).toBe(1);
    expect(packed[0]).toBeCloseTo(0.3, 5);

    const crt = createCrt('c', { scanlineIntensity: 0.2, curvature: 0.1 });
    const uC = rt.packUniforms(crt, 320, 240);
    expect(uC.length).toBe(4);
    expect(uC[0]).toBe(320);
    expect(uC[1]).toBe(240);
  });

  test('buildPass emits enabled entries only', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createBloom('b'));
    chain.add(createCrt('c'));
    chain.setEnabled('b', false);
    const pass = rt.buildPass(chain, 800, 600);
    expect(pass.map((p) => p.id)).toEqual(['v', 'c']);
    expect(pass.every((p) => p.uniforms.length > 0)).toBe(true);
  });
});
