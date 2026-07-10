import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { type CompositeUniforms, createPostFxComposite, type EffectKind } from '../src/effect.js';
import {
  createPostFxRuntime,
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
} from '../src/runtime.js';
import { COMPOSITE_SKSL } from '../src/shaders.js';

function createMockSkia(): { skia: SkiaPostFxModuleLike } {
  const fake: SkiaRuntimeEffectLike = { makeShaderWithChildren: () => ({}) };
  return {
    skia: {
      RuntimeEffect: { Make: () => fake },
    },
  };
}

// ── 1. Factory defaults ───────────────────────────────────────────────────────

describe('createPostFxComposite defaults', () => {
  test('full default uniform object shape', () => {
    const e = createPostFxComposite();
    expect(e.id).toBe('composite');
    expect(e.enabled).toBe(true);
    if (e.uniforms.kind !== 'composite') throw new Error('wrong kind');
    const u = e.uniforms;
    expect(u.vignetteIntensity).toBe(0);
    expect(u.vignetteRadius).toBe(0.8);
    expect(u.vignetteColor).toEqual([0, 0, 0]);
    expect(u.bloomThreshold).toBe(0.7);
    expect(u.bloomIntensity).toBe(0);
    expect(u.flashIntensity).toBe(0);
    expect(u.chromaAmount).toBe(0);
    expect(u.crtScanlineIntensity).toBe(0.25);
    expect(u.crtCurvature).toBe(0.12);
    expect(u.crtEnabled).toBe(false);
    expect(u.weatherKind).toBe(0);
    expect(u.weatherIntensity).toBe(0);
    expect(u.weatherDirection).toBe(0);
    expect(u.weatherScrollX).toBe(0);
    expect(u.weatherScrollY).toBe(0);
  });
});

// ── 2. Factory overrides ──────────────────────────────────────────────────────

describe('createPostFxComposite overrides', () => {
  test('partial overrides win over defaults', () => {
    const e = createPostFxComposite('fx', {
      vignetteIntensity: 0.5,
      bloomIntensity: 0.3,
      flashIntensity: 0.8,
      chromaAmount: 0.01,
      crtEnabled: true,
      weatherKind: 2,
      weatherIntensity: 0.7,
      weatherDirection: 45,
      weatherScrollX: 100,
      weatherScrollY: 200,
    });
    if (e.uniforms.kind !== 'composite') throw new Error('wrong kind');
    const u = e.uniforms;
    expect(u.vignetteIntensity).toBe(0.5);
    expect(u.bloomIntensity).toBe(0.3);
    expect(u.flashIntensity).toBe(0.8);
    expect(u.chromaAmount).toBe(0.01);
    expect(u.crtEnabled).toBe(true);
    expect(u.weatherKind).toBe(2);
    expect(u.weatherIntensity).toBe(0.7);
    expect(u.weatherDirection).toBe(45);
    expect(u.weatherScrollX).toBe(100);
    expect(u.weatherScrollY).toBe(200);
    // unset fields keep defaults
    expect(u.vignetteRadius).toBe(0.8);
    expect(u.bloomThreshold).toBe(0.7);
  });
});

// ── 3. packUniforms layout pin ────────────────────────────────────────────────

describe('packUniforms composite layout', () => {
  test('produces exactly 24 floats', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const e = createPostFxComposite();
    expect(rt.packUniforms(e, 800, 600).length).toBe(24);
  });

  test('resolution slots 0–1', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const packed = rt.packUniforms(createPostFxComposite(), 1024, 768);
    expect(packed[0]).toBe(1024);
    expect(packed[1]).toBe(768);
  });

  test('full layout pin — every index matches known input', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const e = createPostFxComposite('c', {
      vignetteIntensity: 0.4,
      vignetteRadius: 0.9,
      vignetteColor: [0.1, 0.2, 0.3],
      bloomThreshold: 0.65,
      bloomIntensity: 0.5,
      flashIntensity: 0.6,
      chromaAmount: 0.02,
      crtScanlineIntensity: 0.3,
      crtCurvature: 0.15,
      crtEnabled: true,
      weatherKind: 3,
      weatherIntensity: 0.8,
      weatherDirection: 30,
      weatherScrollX: 55,
      weatherScrollY: 0.75,
      weatherColor: [0.1, 0.2, 0.3],
      weatherDensity: 0.6,
      weatherStreakLen: 0.2,
    });
    const p = rt.packUniforms(e, 320, 240);
    expect(p[0]).toBe(320); // resolution.x
    expect(p[1]).toBe(240); // resolution.y
    expect(p[2]).toBeCloseTo(0.4); // vignetteIntensity
    expect(p[3]).toBeCloseTo(0.9); // vignetteRadius
    expect(p[4]).toBeCloseTo(0.1); // vignetteColor.r
    expect(p[5]).toBeCloseTo(0.2); // vignetteColor.g
    expect(p[6]).toBeCloseTo(0.3); // vignetteColor.b
    expect(p[7]).toBeCloseTo(0.65); // bloomThreshold
    expect(p[8]).toBeCloseTo(0.5); // bloomIntensity
    expect(p[9]).toBeCloseTo(0.6); // flashIntensity
    expect(p[10]).toBeCloseTo(0.02); // chromaAmount
    expect(p[11]).toBeCloseTo(0.3); // crtScanlineIntensity
    expect(p[12]).toBeCloseTo(0.15); // crtCurvature
    expect(p[13]).toBe(1.0); // crtEnabled → 1.0
    expect(p[14]).toBe(3); // weatherKind
    expect(p[15]).toBeCloseTo(0.8); // weatherIntensity
    expect(p[16]).toBeCloseTo(30); // weatherDirection
    expect(p[17]).toBeCloseTo(55); // weatherScrollX
    expect(p[18]).toBeCloseTo(0.75); // weatherScrollY (normalized [0,1) phase)
    expect(p[19]).toBeCloseTo(0.1); // weatherColor.r
    expect(p[20]).toBeCloseTo(0.2); // weatherColor.g
    expect(p[21]).toBeCloseTo(0.3); // weatherColor.b
    expect(p[22]).toBeCloseTo(0.6); // weatherDensity
    expect(p[23]).toBeCloseTo(0.2); // weatherStreakLen
  });

  test('weatherColor default packs as [1,1,1]', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const p = rt.packUniforms(createPostFxComposite(), 1, 1);
    expect(p[19]).toBe(1.0);
    expect(p[20]).toBe(1.0);
    expect(p[21]).toBe(1.0);
  });

  test('weatherDensity default = 0.5 at index 22', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const p = rt.packUniforms(createPostFxComposite(), 1, 1);
    expect(p[22]).toBeCloseTo(0.5);
  });

  test('weatherStreakLen default = 0.15 at index 23', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const p = rt.packUniforms(createPostFxComposite(), 1, 1);
    expect(p[23]).toBeCloseTo(0.15);
  });

  test('crtEnabled false packs as 0.0', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const p = rt.packUniforms(createPostFxComposite('c', { crtEnabled: false }), 1, 1);
    expect(p[13]).toBe(0);
  });
});

// ── 4. buildPass integration ──────────────────────────────────────────────────

describe('buildPass composite', () => {
  test('produces a CompiledPass with correct kind, 24-float uniforms, and empty children', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createPostFxComposite('comp'));
    const passes = rt.buildPass(chain, 800, 600);
    expect(passes.length).toBe(1);
    const pass = passes[0];
    if (!pass) throw new Error('no pass');
    expect(pass.id).toBe('comp');
    expect(pass.kind).toBe('composite');
    expect(pass.uniforms.length).toBe(24);
    expect(pass.children.length).toBe(0);
  });
});

// ── 5. scaleIntensity via globalIntensity ─────────────────────────────────────

describe('globalIntensity scales composite intensity slots', () => {
  function buildAt(scale: number, overrides: Partial<CompositeUniforms> = {}) {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(
      createPostFxComposite('c', {
        vignetteIntensity: 1.0,
        bloomIntensity: 1.0,
        flashIntensity: 1.0,
        chromaAmount: 1.0,
        weatherIntensity: 1.0,
        vignetteRadius: 0.8,
        bloomThreshold: 0.7,
        crtCurvature: 0.12,
        crtEnabled: true,
        crtScanlineIntensity: 0.25,
        weatherKind: 1,
        weatherDirection: 45,
        ...overrides,
      }),
    );
    chain.globalIntensity = scale;
    return rt.buildPass(chain, 800, 600)[0]?.uniforms;
  }

  test('scale 0.5 halves all 5 intensity slots', () => {
    const p = buildAt(0.5);
    if (!p) throw new Error('no pass');
    expect(p[2]).toBeCloseTo(0.5); // vignetteIntensity
    expect(p[8]).toBeCloseTo(0.5); // bloomIntensity
    expect(p[9]).toBeCloseTo(0.5); // flashIntensity
    expect(p[10]).toBeCloseTo(0.5); // chromaAmount
    expect(p[15]).toBeCloseTo(0.5); // weatherIntensity
  });

  test('crtEnabled stays 1.0 after scaling', () => {
    const p = buildAt(0.5);
    if (!p) throw new Error('no pass');
    expect(p[13]).toBe(1.0);
  });

  test('geometry fields untouched by scaling', () => {
    const p = buildAt(0.5);
    if (!p) throw new Error('no pass');
    expect(p[3]).toBeCloseTo(0.8); // vignetteRadius
    expect(p[7]).toBeCloseTo(0.7); // bloomThreshold
    expect(p[12]).toBeCloseTo(0.12); // crtCurvature
    expect(p[16]).toBeCloseTo(45); // weatherDirection
  });

  test('scale 0 zeroes all intensity slots', () => {
    const p = buildAt(0);
    if (!p) throw new Error('no pass');
    expect(p[2]).toBe(0);
    expect(p[8]).toBe(0);
    expect(p[9]).toBe(0);
    expect(p[10]).toBe(0);
    expect(p[15]).toBe(0);
  });

  test('weatherDensity [22] and weatherStreakLen [23] are NOT scaled by globalIntensity', () => {
    const p = buildAt(0.5, { weatherDensity: 0.5, weatherStreakLen: 0.15 });
    if (!p) throw new Error('no pass');
    expect(p[22]).toBeCloseTo(0.5); // density unchanged
    expect(p[23]).toBeCloseTo(0.15); // streakLen unchanged
  });
});

// ── 6. EffectKind exhaustiveness pin ─────────────────────────────────────────

describe('EffectKind exhaustiveness', () => {
  test('composite is a valid EffectKind value', () => {
    const kind: EffectKind = 'composite';
    // Compile-time exhaustiveness: if EffectKind ever drops 'composite', this test
    // file will fail TypeScript compilation.
    function assertExhaustive(k: EffectKind): string {
      switch (k) {
        case 'vignette':
          return k;
        case 'grayscale-flash':
          return k;
        case 'chromatic-aberration':
          return k;
        case 'crt':
          return k;
        case 'bloom':
          return k;
        case 'god-rays':
          return k;
        case 'color-grading-lut':
          return k;
        case 'weather-rain':
          return k;
        case 'weather-sun-shaft':
          return k;
        case 'weather-dark-vignette':
          return k;
        case 'weather-clouds':
          return k;
        case 'composite':
          return k;
      }
    }
    expect(assertExhaustive(kind)).toBe('composite');
  });
});

// ── 7. COMPOSITE_SKSL source pin ─────────────────────────────────────────────

describe('COMPOSITE_SKSL source', () => {
  test('contains all expected uniform declarations', () => {
    expect(COMPOSITE_SKSL).toContain('uniform shader src');
    expect(COMPOSITE_SKSL).toContain('uniform float2 resolution');
    expect(COMPOSITE_SKSL).toContain('uniform float vignetteIntensity');
    expect(COMPOSITE_SKSL).toContain('uniform float3 vignetteColor');
    expect(COMPOSITE_SKSL).toContain('uniform float bloomIntensity');
    expect(COMPOSITE_SKSL).toContain('uniform float flashIntensity');
    expect(COMPOSITE_SKSL).toContain('uniform float chromaAmount');
    expect(COMPOSITE_SKSL).toContain('uniform float crtEnabled');
    expect(COMPOSITE_SKSL).toContain('uniform float weatherKind');
    expect(COMPOSITE_SKSL).toContain('uniform float weatherIntensity');
    expect(COMPOSITE_SKSL).toContain('half4 main');
  });

  test('contains uniform float3 weatherColor declaration', () => {
    expect(COMPOSITE_SKSL).toContain('uniform float3 weatherColor');
  });

  test('contains new density and streakLen uniform declarations', () => {
    expect(COMPOSITE_SKSL).toContain('uniform float weatherDensity');
    expect(COMPOSITE_SKSL).toContain('uniform float weatherStreakLen');
  });

  test('rain branch: falling sawtooth uses fract over fall-axis term', () => {
    expect(COMPOSITE_SKSL).toContain('fract(fallAxis');
  });

  test('rain branch: dropout uses hash-based density compare', () => {
    expect(COMPOSITE_SKSL).toContain('colHash < weatherDensity');
  });

  test('rain branch: alpha-over blend uses mix(', () => {
    expect(COMPOSITE_SKSL).toContain('mix(c, half3(weatherColor)');
  });

  test('rain branch: UV rotation present', () => {
    expect(COMPOSITE_SKSL).toContain('perpAxis');
    expect(COMPOSITE_SKSL).toContain('fallAxis');
  });

  test('rain branch: 2-layer max( combine', () => {
    expect(COMPOSITE_SKSL).toContain('coverage = max(coverage,');
  });

  test('rain branch: does NOT contain old whole-column blink pattern', () => {
    expect(COMPOSITE_SKSL).not.toContain('* 300.0');
  });

  test('rain branch: does NOT contain old additive blend', () => {
    expect(COMPOSITE_SKSL).not.toContain('c += half3(weatherColor) * rain');
  });

  test('rain branch: does NOT contain refraction tap src.eval(coord +', () => {
    expect(COMPOSITE_SKSL).not.toContain('src.eval(coord +');
  });

  test('rain branch contains hash-bucketing (floor)', () => {
    expect(COMPOSITE_SKSL).toContain('floor');
  });
});
