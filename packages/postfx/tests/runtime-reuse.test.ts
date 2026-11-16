import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import {
  createBloom,
  createChromaticAberration,
  createColorGradingLut,
  createCrt,
  createGrayscaleFlash,
  createVignette,
} from '../src/effect.js';
import {
  createPostFxRuntime,
  type SkImageLike,
  type SkiaPostFxModuleLike,
} from '../src/runtime.js';

function createMockSkia(): SkiaPostFxModuleLike {
  return {
    RuntimeEffect: {
      Make: () => ({ makeShaderWithChildren: () => ({}) }),
    },
  };
}

function makeChain(): EffectChain {
  const chain = new EffectChain();
  chain.add(createVignette('v', { intensity: 0.4, radius: 0.8 }));
  chain.add(createBloom('bloom', { threshold: 0.7, intensity: 0.5 }));
  chain.add(createGrayscaleFlash('flash', { intensity: 0.25 }));
  return chain;
}

describe('PostFxRuntime.buildPass reuse', () => {
  test('an unchanged chain gets the same array, descriptors and uniform buffers back', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = makeChain();

    const first = rt.buildPass(chain, 800, 600);
    const firstPasses = [...first];
    const firstUniforms = first.map((p) => p.uniforms);
    const firstValues = first.map((p) => Array.from(p.uniforms));

    for (let frame = 0; frame < 3; frame++) {
      const next = rt.buildPass(chain, 800, 600);
      expect(next).toBe(first);
      expect(next.length).toBe(3);
      for (let i = 0; i < next.length; i++) {
        expect(next[i]).toBe(firstPasses[i]);
        expect(next[i]?.uniforms).toBe(firstUniforms[i]);
        expect(Array.from(next[i]?.uniforms ?? [])).toEqual(firstValues[i] ?? []);
      }
    }
    expect(first.map((p) => p.id)).toEqual(['v', 'bloom', 'flash']);
  });

  test('a changed uniform, size or global intensity is rewritten into the same buffer', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = makeChain();
    const passes = rt.buildPass(chain, 800, 600);
    const bloom = passes[1]?.uniforms;
    expect(Array.from(bloom ?? [])).toEqual([800, 600, Math.fround(0.7), 0.5]);

    chain.setUniforms('bloom', { kind: 'bloom', threshold: 0.25, intensity: 0.75 });
    rt.buildPass(chain, 1024, 768);
    expect(passes[1]?.uniforms).toBe(bloom);
    expect(Array.from(bloom ?? [])).toEqual([1024, 768, 0.25, 0.75]);

    chain.globalIntensity = 0.5;
    rt.buildPass(chain, 1024, 768);
    expect(passes[1]?.uniforms).toBe(bloom);
    expect(Array.from(bloom ?? [])).toEqual([1024, 768, 0.25, 0.375]);

    // The scale is applied to a freshly packed value each frame, never compounded.
    rt.buildPass(chain, 1024, 768);
    expect(Array.from(bloom ?? [])).toEqual([1024, 768, 0.25, 0.375]);
  });

  test('disabling an effect shrinks the array and re-sizes the slots that changed length', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = makeChain();
    const passes = rt.buildPass(chain, 800, 600);
    const vignetteBuf = passes[0]?.uniforms;
    const bloomBuf = passes[1]?.uniforms;

    chain.setEnabled('v', false);
    const next = rt.buildPass(chain, 800, 600);

    expect(next).toBe(passes);
    expect(next.map((p) => p.id)).toEqual(['bloom', 'flash']);
    expect(next.map((p) => p.kind)).toEqual(['bloom', 'grayscale-flash']);
    // Slot 0 held 7 vignette floats and now needs 4; slot 1 held 4 and now needs 1.
    expect(next[0]?.uniforms).not.toBe(vignetteBuf);
    expect(next[1]?.uniforms).not.toBe(bloomBuf);
    expect(Array.from(next[0]?.uniforms ?? [])).toEqual([800, 600, Math.fround(0.7), 0.5]);
    expect(Array.from(next[1]?.uniforms ?? [])).toEqual([0.25]);

    const settled = next.map((p) => p.uniforms);
    rt.buildPass(chain, 800, 600);
    expect(next.map((p) => p.uniforms)).toEqual(settled);
    expect(next[0]?.uniforms).toBe(settled[0]);
    expect(next[1]?.uniforms).toBe(settled[1]);
  });

  test('enabling an effect grows the array with a fresh slot and keeps the earlier ones', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = makeChain();
    chain.setEnabled('flash', false);
    const passes = rt.buildPass(chain, 800, 600);
    expect(passes.length).toBe(2);
    const kept = passes.map((p) => p.uniforms);

    chain.setEnabled('flash', true);
    rt.buildPass(chain, 800, 600);

    expect(passes.map((p) => p.id)).toEqual(['v', 'bloom', 'flash']);
    expect(passes[0]?.uniforms).toBe(kept[0]);
    expect(passes[1]?.uniforms).toBe(kept[1]);
    expect(Array.from(passes[2]?.uniforms ?? [])).toEqual([0.25]);
  });

  test('a slot taken over by another kind of the same length is fully rewritten', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = new EffectChain();
    chain.add(createBloom('bloom', { threshold: 0.75, intensity: 0.5 }));
    const passes = rt.buildPass(chain, 800, 600);
    const buf = passes[0]?.uniforms;

    chain.remove('bloom');
    chain.add(createGrayscaleFlash('flash', { intensity: 1 }));
    chain.add(createCrt('crt', { scanlineIntensity: 0.5, curvature: 0.25 }));
    chain.setEnabled('flash', false);
    rt.buildPass(chain, 640, 480);

    expect(passes.length).toBe(1);
    expect(passes[0]?.id).toBe('crt');
    expect(passes[0]?.kind).toBe('crt');
    expect(passes[0]?.uniforms).toBe(buf);
    expect(Array.from(buf ?? [])).toEqual([640, 480, 0.5, 0.25]);
  });

  test('an emptied chain returns the same array at length 0', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = makeChain();
    const passes = rt.buildPass(chain, 800, 600);
    chain.clear();
    expect(rt.buildPass(chain, 800, 600)).toBe(passes);
    expect(passes.length).toBe(0);
  });

  test('a second chain through one runtime overwrites the slots with its own passes', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const a = makeChain();
    const b = new EffectChain();
    b.add(createChromaticAberration('chrom', { amount: 0.5 }));

    const fromA = rt.buildPass(a, 800, 600);
    const fromB = rt.buildPass(b, 320, 240);
    expect(fromB).toBe(fromA);
    expect(fromB.map((p) => p.id)).toEqual(['chrom']);
    expect(Array.from(fromB[0]?.uniforms ?? [])).toEqual([320, 240, 0.5]);

    rt.buildPass(a, 800, 600);
    expect(fromA.map((p) => p.id)).toEqual(['v', 'bloom', 'flash']);
    expect(Array.from(fromA[1]?.uniforms ?? [])).toEqual([800, 600, Math.fround(0.7), 0.5]);
  });

  test('two runtimes never share an array, a descriptor or a uniform buffer', () => {
    const chain = makeChain();
    const a = createPostFxRuntime(createMockSkia()).buildPass(chain, 800, 600);
    const b = createPostFxRuntime(createMockSkia()).buildPass(chain, 400, 300);

    expect(a).not.toBe(b);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).not.toBe(b[i]);
      expect(a[i]?.uniforms).not.toBe(b[i]?.uniforms);
    }
    expect(a[0]?.uniforms[0]).toBe(800);
    expect(b[0]?.uniforms[0]).toBe(400);
  });

  test('a LUT children array is kept while the image is unchanged and replaced, not mutated, on a swap', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const lutA: SkImageLike = {};
    const lutB: SkImageLike = {};
    const chain = new EffectChain();
    chain.add(createColorGradingLut('lut', { lut: lutA, intensity: 1 }));

    const passes = rt.buildPass(chain, 800, 600);
    const childrenA = passes[0]?.children;
    expect(childrenA).toEqual([lutA]);

    rt.buildPass(chain, 800, 600);
    expect(passes[0]?.children).toBe(childrenA);

    chain.setUniforms('lut', { kind: 'color-grading-lut', lut: lutB, intensity: 1 });
    rt.buildPass(chain, 800, 600);
    expect(passes[0]?.children).not.toBe(childrenA);
    expect(passes[0]?.children[0]).toBe(lutB);
    // A consumer that kept last frame's children array still sees last frame's image.
    expect(childrenA?.[0]).toBe(lutA);
  });

  test('buildPass does not go through the chain.enabled() generator', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const chain = makeChain();
    let calls = 0;
    const original = chain.enabled.bind(chain);
    chain.enabled = () => {
      calls++;
      return original();
    };
    expect(rt.buildPass(chain, 800, 600).length).toBe(3);
    expect(calls).toBe(0);
  });

  test('packUniforms still returns a fresh buffer per call', () => {
    const rt = createPostFxRuntime(createMockSkia());
    const effect = createVignette('v', { intensity: 0.5, radius: 0.75 });
    const a = rt.packUniforms(effect, 800, 600);
    const b = rt.packUniforms(effect, 800, 600);
    expect(a).not.toBe(b);
    expect(Array.from(a)).toEqual([800, 600, 0.5, 0.75, 0, 0, 0]);
    expect(Array.from(b)).toEqual(Array.from(a));
  });
});
