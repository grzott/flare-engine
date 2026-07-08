import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
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
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
  createPostFxRuntime,
} from '../src/runtime.js';

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
    expect(uV.length).toBe(7);
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

  describe('compile diagnostics', () => {
    let warnSpy: ReturnType<typeof spyOn>;
    let infoSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      infoSpy = spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });

    test('logs warning once when RuntimeEffect.Make returns null', () => {
      const nullSkia: SkiaPostFxModuleLike = {
        RuntimeEffect: { Make: () => null },
      };
      const rt = createPostFxRuntime(nullSkia);
      rt.compile('vignette');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg: string = (warnSpy.mock.calls[0] as string[])[0] ?? '';
      expect(msg).toContain('vignette');
      rt.compile('vignette');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    test('logs info once when compile succeeds and getUniformFloatCount is available (verbose:true)', () => {
      const stubEffect: SkiaRuntimeEffectLike = {
        makeShaderWithChildren: () => ({}),
        getUniformFloatCount: () => 19,
      };
      const countSkia: SkiaPostFxModuleLike = {
        RuntimeEffect: { Make: () => stubEffect },
      };
      const rt = createPostFxRuntime(countSkia, { verbose: true });
      rt.compile('composite');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      const msg: string = (infoSpy.mock.calls[0] as string[])[0] ?? '';
      expect(msg).toContain('composite');
      expect(msg).toContain('getUniformFloatCount=19');
      rt.compile('composite');
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    test('does NOT log info by default even when getUniformFloatCount is present', () => {
      const stubEffect: SkiaRuntimeEffectLike = {
        makeShaderWithChildren: () => ({}),
        getUniformFloatCount: () => 7,
      };
      const countSkia: SkiaPostFxModuleLike = {
        RuntimeEffect: { Make: () => stubEffect },
      };
      const rt = createPostFxRuntime(countSkia);
      rt.compile('vignette');
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('array-uniform truncation regression', () => {
    test('god-rays: buildPass.uniforms is Float32Array of length 12 (what the renderer passes to makeShaderWithChildren)', () => {
      let capturedUniforms: unknown;
      const capturingEffect: SkiaRuntimeEffectLike = {
        makeShaderWithChildren: (u) => {
          capturedUniforms = u;
          return {};
        },
      };
      const capturingSkia: SkiaPostFxModuleLike = {
        RuntimeEffect: { Make: () => capturingEffect },
      };
      const rt = createPostFxRuntime(capturingSkia);
      const chain = new EffectChain();
      chain.add(createGodRays('gr'));
      const passes = rt.buildPass(chain, 800, 600);
      expect(passes.length).toBe(1);
      const pass = passes[0];
      if (!pass) throw new Error('no pass');
      // Simulate the renderer: pass.shader.makeShaderWithChildren(pass.uniforms)
      pass.shader.makeShaderWithChildren(pass.uniforms);
      expect(capturedUniforms).toBeInstanceOf(Float32Array);
      expect((capturedUniforms as Float32Array).length).toBe(12);
    });

    test('packUniforms for god-rays returns Float32Array of length 12', () => {
      const { skia } = createMockSkia();
      const rt = createPostFxRuntime(skia);
      const gr = createGodRays('gr');
      const packed = rt.packUniforms(gr, 800, 600);
      expect(packed).toBeInstanceOf(Float32Array);
      expect(packed.length).toBe(12);
    });
  });
});
