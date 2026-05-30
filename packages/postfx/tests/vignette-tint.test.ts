import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { createVignette } from '../src/effect.js';
import {
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
  createPostFxRuntime,
} from '../src/runtime.js';

function createMockSkia(): SkiaPostFxModuleLike {
  const fake: SkiaRuntimeEffectLike = { makeShaderWithChildren: () => ({}) };
  return {
    RuntimeEffect: {
      Make: () => fake,
    },
  };
}

describe('vignette tint', () => {
  test('createVignette() color defaults to [0,0,0]', () => {
    const e = createVignette();
    if (e.uniforms.kind === 'vignette') {
      expect(e.uniforms.color).toEqual([0, 0, 0]);
    }
  });

  test('packUniforms with color emits 7 floats, indices 4-6 = passed color', () => {
    const rt = createPostFxRuntime(null);
    const e = createVignette('v', { color: [0.2, 0.4, 0.6] });
    const packed = rt.packUniforms(e, 800, 600);
    expect(packed.length).toBe(7);
    expect(packed[4]).toBeCloseTo(0.2);
    expect(packed[5]).toBeCloseTo(0.4);
    expect(packed[6]).toBeCloseTo(0.6);
  });

  test('default createVignette packs zero color components (indices 4-6)', () => {
    const rt = createPostFxRuntime(null);
    const e = createVignette();
    const packed = rt.packUniforms(e, 800, 600);
    expect(packed[4]).toBe(0);
    expect(packed[5]).toBe(0);
    expect(packed[6]).toBe(0);
  });

  test('globalIntensity=0.5 halves packed[2] (intensity) but leaves color components unchanged', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = new EffectChain();
    chain.add(createVignette('v', { intensity: 0.8, color: [0.1, 0.2, 0.3] }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    const uniforms = pass[0]!.uniforms;
    expect(uniforms[2]).toBeCloseTo(0.4, 5);
    expect(uniforms[4]).toBeCloseTo(0.1, 5);
    expect(uniforms[5]).toBeCloseTo(0.2, 5);
    expect(uniforms[6]).toBeCloseTo(0.3, 5);
  });
});
