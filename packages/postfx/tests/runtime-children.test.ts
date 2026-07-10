import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import {
  createBloom,
  createChromaticAberration,
  createCrt,
  createGodRays,
  createGrayscaleFlash,
  createVignette,
} from '../src/effect.js';
import {
  createPostFxRuntime,
  type SkImageLike,
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
} from '../src/runtime.js';

function createMockSkia(): SkiaPostFxModuleLike {
  const fake: SkiaRuntimeEffectLike = { makeShaderWithChildren: () => ({}) };
  return {
    RuntimeEffect: {
      Make: () => fake,
    },
  };
}

describe('CompiledPass.children — Convention A', () => {
  test('all 6 built-in effects produce children with length 0', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createVignette());
    chain.add(createGrayscaleFlash());
    chain.add(createChromaticAberration());
    chain.add(createCrt());
    chain.add(createBloom());
    chain.add(createGodRays());
    const passes = rt.buildPass(chain, 1280, 720);
    expect(passes.length).toBe(6);
    for (const pass of passes) {
      expect(pass.children.length).toBe(0);
    }
  });

  test('zero-alloc: passes within a single buildPass call share === sentinel', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createBloom('b'));
    const passes = rt.buildPass(chain, 800, 600);
    expect(passes.length).toBe(2);
    expect(passes[0]?.children).toBe(passes[1]?.children);
  });

  test('cross-call stability: two separate buildPass calls produce passes sharing the sentinel', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createVignette());
    const [passA] = rt.buildPass(chain, 800, 600);
    const [passB] = rt.buildPass(chain, 800, 600);
    expect(passA?.children).toBe(passB?.children);
  });

  test('structural assignability: plain {} satisfies SkImageLike', () => {
    const img: SkImageLike = {};
    expect(img).toBeDefined();
  });

  test('multi-effect chain: all passes have children field, all length 0', () => {
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createCrt('c'));
    chain.add(createGodRays('g'));
    const passes = rt.buildPass(chain, 640, 480);
    expect(passes.length).toBe(3);
    for (const pass of passes) {
      expect('children' in pass).toBe(true);
      expect(pass.children.length).toBe(0);
    }
  });

  test('null-runtime path: buildPass returns [] and result.length === 0 does not throw', () => {
    const rt = createPostFxRuntime(null);
    const chain = new EffectChain();
    chain.add(createVignette());
    const result = rt.buildPass(chain, 800, 600);
    expect(result.length).toBe(0);
  });
});
