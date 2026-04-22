import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import {
  createBloom,
  createChromaticAberration,
  createCrt,
  createGrayscaleFlash,
  createVignette,
} from '../src/effect.js';
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

  describe('chain.globalIntensity modulates packed uniforms', () => {
    test('default (1.0) leaves uniforms untouched', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createVignette('v', { intensity: 0.5, radius: 0.8 }));
      const pass = rt.buildPass(chain, 800, 600);
      expect(pass[0]?.uniforms[2]).toBeCloseTo(0.5, 5);
      expect(pass[0]?.uniforms[3]).toBeCloseTo(0.8, 5);
    });

    test('vignette — intensity scales, radius does not', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createVignette('v', { intensity: 0.8, radius: 0.7 }));
      chain.globalIntensity = 0.5;
      const pass = rt.buildPass(chain, 800, 600);
      expect(pass[0]?.uniforms[2]).toBeCloseTo(0.4, 5);
      expect(pass[0]?.uniforms[3]).toBeCloseTo(0.7, 5);
    });

    test('grayscale-flash — intensity scales', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createGrayscaleFlash('g', { intensity: 0.6 }));
      chain.globalIntensity = 0.25;
      const pass = rt.buildPass(chain, 800, 600);
      expect(pass[0]?.uniforms[0]).toBeCloseTo(0.15, 5);
    });

    test('chromatic-aberration — amount scales', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createChromaticAberration('ca', { amount: 0.02 }));
      chain.globalIntensity = 0.5;
      const pass = rt.buildPass(chain, 800, 600);
      expect(pass[0]?.uniforms[2]).toBeCloseTo(0.01, 6);
    });

    test('crt — scanlineIntensity scales, curvature does not', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createCrt('c', { scanlineIntensity: 0.4, curvature: 0.2 }));
      chain.globalIntensity = 0.5;
      const pass = rt.buildPass(chain, 800, 600);
      expect(pass[0]?.uniforms[2]).toBeCloseTo(0.2, 5);
      expect(pass[0]?.uniforms[3]).toBeCloseTo(0.2, 5);
    });

    test('bloom — intensity scales, threshold does not', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createBloom('b', { threshold: 0.7, intensity: 0.8 }));
      chain.globalIntensity = 0.5;
      const pass = rt.buildPass(chain, 800, 600);
      expect(pass[0]?.uniforms[2]).toBeCloseTo(0.7, 5);
      expect(pass[0]?.uniforms[3]).toBeCloseTo(0.4, 5);
    });

    test('setting globalIntensity=0 zeroes strength uniforms across kinds', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createVignette('v', { intensity: 0.8, radius: 0.7 }));
      chain.add(createBloom('b', { threshold: 0.7, intensity: 0.8 }));
      chain.add(createGrayscaleFlash('g', { intensity: 1 }));
      chain.globalIntensity = 0;
      const pass = rt.buildPass(chain, 800, 600);
      // vignette intensity
      expect(pass[0]?.uniforms[2]).toBe(0);
      // bloom intensity (threshold unchanged)
      expect(pass[1]?.uniforms[2]).toBeCloseTo(0.7, 5);
      expect(pass[1]?.uniforms[3]).toBe(0);
      // grayscale-flash intensity
      expect(pass[2]?.uniforms[0]).toBe(0);
    });

    test('does not mutate the underlying effect uniforms', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const chain = new EffectChain();
      chain.add(createVignette('v', { intensity: 0.8, radius: 0.7 }));
      chain.globalIntensity = 0.25;
      rt.buildPass(chain, 800, 600);
      const e = chain.get('v');
      if (e && e.uniforms.kind === 'vignette') {
        expect(e.uniforms.intensity).toBe(0.8);
      }
    });
  });
});
