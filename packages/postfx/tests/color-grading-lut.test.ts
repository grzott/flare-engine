import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { createColorGradingLut, createVignette } from '../src/effect.js';
import { createNeutralLutBytes } from '../src/lut.js';
import {
  type SkImageLike,
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
  createPostFxRuntime,
} from '../src/runtime.js';
import { COLOR_GRADING_LUT_SKSL } from '../src/shaders.js';

const mockLutImage: SkImageLike = {};

function createMockSkia(): SkiaPostFxModuleLike {
  const fake: SkiaRuntimeEffectLike = { makeShaderWithChildren: () => ({}) };
  return { RuntimeEffect: { Make: () => fake } };
}

describe('color-grading-lut effect', () => {
  test('createColorGradingLut default factory', () => {
    const e = createColorGradingLut({ lut: mockLutImage });
    expect(e.id).toBe('color-grading-lut');
    expect(e.enabled).toBe(true);
    expect(e.uniforms.kind).toBe('color-grading-lut');
    if (e.uniforms.kind === 'color-grading-lut') {
      expect(e.uniforms.intensity).toBe(1.0);
    }
  });

  test('createColorGradingLut respects intensity override', () => {
    const e = createColorGradingLut({ lut: mockLutImage, intensity: 0.5 });
    if (e.uniforms.kind === 'color-grading-lut') {
      expect(e.uniforms.intensity).toBe(0.5);
    }
  });

  test('packUniforms layout — single float', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const e = createColorGradingLut({ lut: mockLutImage });
    const packed = rt.packUniforms(e, 800, 600);
    expect(packed.length).toBe(1);
    expect(packed[0]).toBe(1.0);
  });

  test('scaleIntensity via buildPass scales intensity', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createColorGradingLut({ lut: mockLutImage, intensity: 1.0 }, 'lut'));
    chain.globalIntensity = 0.5;
    const passes = rt.buildPass(chain, 800, 600);
    expect(passes[0]?.uniforms[0]).toBeCloseTo(0.5, 5);
  });

  test('buildPass children — lut image threaded through', () => {
    const mockImg: SkImageLike = {};
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createColorGradingLut({ lut: mockImg }, 'lut'));
    const passes = rt.buildPass(chain, 800, 600);
    expect(passes[0]?.children.length).toBe(1);
    expect(passes[0]?.children[0]).toBe(mockImg);
  });

  test('buildPass — built-in effects keep EMPTY_CHILDREN sentinel after LUT is added', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createColorGradingLut({ lut: mockLutImage }, 'lut'));
    const passes = rt.buildPass(chain, 800, 600);
    expect(passes.length).toBe(2);
    const vignette = passes[0];
    const lut = passes[1];
    expect(vignette?.children.length).toBe(0);
    expect(lut?.children.length).toBe(1);
    expect(vignette?.children).not.toBe(lut?.children);
  });

  test('COLOR_GRADING_LUT_SKSL — non-empty and references lut uniform', () => {
    expect(COLOR_GRADING_LUT_SKSL.length).toBeGreaterThan(0);
    expect(COLOR_GRADING_LUT_SKSL).toContain('uniform shader lut');
    expect(COLOR_GRADING_LUT_SKSL).toContain('uniform float intensity');
  });

  test('createNeutralLutBytes — correct buffer size', () => {
    const buf = createNeutralLutBytes();
    expect(buf.length).toBe(4096 * 64 * 4);
  });

  test('createNeutralLutBytes — identity at (r=0, g=0, b=0)', () => {
    const buf = createNeutralLutBytes();
    // b=0, r=0, g=0 → x=0, y=0, off=0
    const off = 0;
    expect(buf[off]).toBe(0);
    expect(buf[off + 1]).toBe(0);
    expect(buf[off + 2]).toBe(0);
    expect(buf[off + 3]).toBe(255);
  });

  test('createNeutralLutBytes — identity at (r=63, g=63, b=63)', () => {
    const buf = createNeutralLutBytes();
    // b=63, r=63, g=63 → x=63*64+63=4095, y=63, off=(63*4096+4095)*4
    const x = 4095;
    const y = 63;
    const off = (y * 4096 + x) * 4;
    expect(buf[off]).toBe(255);
    expect(buf[off + 1]).toBe(255);
    expect(buf[off + 2]).toBe(255);
    expect(buf[off + 3]).toBe(255);
  });

  test('createNeutralLutBytes — mid-point identity', () => {
    const buf = createNeutralLutBytes();
    // b=31, r=31, g=31 → x=31*64+31=2015, y=31
    const x = 31 * 64 + 31;
    const y = 31;
    const off = (y * 4096 + x) * 4;
    const expected = Math.round((31 / 63) * 255);
    expect(buf[off]).toBe(expected);
    expect(buf[off + 1]).toBe(expected);
    expect(buf[off + 2]).toBe(expected);
    expect(buf[off + 3]).toBe(255);
  });
});
