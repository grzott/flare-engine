import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import {
  createWeatherClouds,
  createWeatherDarkVignette,
  createWeatherRain,
  createWeatherSunShaft,
} from '../src/effect.js';
import {
  type SkiaPostFxModuleLike,
  type SkiaRuntimeEffectLike,
  createPostFxRuntime,
} from '../src/runtime.js';
import {
  WEATHER_CLOUDS_SKSL,
  WEATHER_DARK_VIGNETTE_SKSL,
  WEATHER_RAIN_SKSL,
  WEATHER_SUN_SHAFT_SKSL,
} from '../src/shaders.js';

function createMockSkia(): { skia: SkiaPostFxModuleLike } {
  const fake: SkiaRuntimeEffectLike = { makeShaderWithChildren: () => ({}) };
  return {
    skia: {
      RuntimeEffect: { Make: () => fake },
    },
  };
}

// ── 1. Factory defaults ──────────────────────────────────────────────────────

describe('createWeatherRain defaults', () => {
  test('kind discriminant', () => {
    const e = createWeatherRain();
    expect(e.uniforms.kind).toBe('weather-rain');
  });
  test('intensity = 0.5', () => {
    const e = createWeatherRain();
    if (e.uniforms.kind !== 'weather-rain') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.5);
  });
  test('scrollOffsetY = 0', () => {
    const e = createWeatherRain();
    if (e.uniforms.kind !== 'weather-rain') throw new Error('wrong kind');
    expect(e.uniforms.scrollOffsetY).toBe(0);
  });
  test('enabled = true, id = "weather-rain"', () => {
    const e = createWeatherRain();
    expect(e.enabled).toBe(true);
    expect(e.id).toBe('weather-rain');
  });
});

describe('createWeatherSunShaft defaults', () => {
  test('kind discriminant', () => {
    const e = createWeatherSunShaft();
    expect(e.uniforms.kind).toBe('weather-sun-shaft');
  });
  test('intensity = 0.5', () => {
    const e = createWeatherSunShaft();
    if (e.uniforms.kind !== 'weather-sun-shaft') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.5);
  });
  test('direction = 0', () => {
    const e = createWeatherSunShaft();
    if (e.uniforms.kind !== 'weather-sun-shaft') throw new Error('wrong kind');
    expect(e.uniforms.direction).toBe(0);
  });
  test('enabled = true, id = "weather-sun-shaft"', () => {
    const e = createWeatherSunShaft();
    expect(e.enabled).toBe(true);
    expect(e.id).toBe('weather-sun-shaft');
  });
});

describe('createWeatherDarkVignette defaults', () => {
  test('kind discriminant', () => {
    const e = createWeatherDarkVignette();
    expect(e.uniforms.kind).toBe('weather-dark-vignette');
  });
  test('intensity = 0.5', () => {
    const e = createWeatherDarkVignette();
    if (e.uniforms.kind !== 'weather-dark-vignette') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.5);
  });
  test('enabled = true, id = "weather-dark-vignette"', () => {
    const e = createWeatherDarkVignette();
    expect(e.enabled).toBe(true);
    expect(e.id).toBe('weather-dark-vignette');
  });
});

describe('createWeatherClouds defaults', () => {
  test('kind discriminant', () => {
    const e = createWeatherClouds();
    expect(e.uniforms.kind).toBe('weather-clouds');
  });
  test('intensity = 0.5', () => {
    const e = createWeatherClouds();
    if (e.uniforms.kind !== 'weather-clouds') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.5);
  });
  test('scrollOffsetX = 0', () => {
    const e = createWeatherClouds();
    if (e.uniforms.kind !== 'weather-clouds') throw new Error('wrong kind');
    expect(e.uniforms.scrollOffsetX).toBe(0);
  });
  test('enabled = true, id = "weather-clouds"', () => {
    const e = createWeatherClouds();
    expect(e.enabled).toBe(true);
    expect(e.id).toBe('weather-clouds');
  });
});

// ── 2. Factory overrides ─────────────────────────────────────────────────────

describe('factory overrides', () => {
  test('weather-rain — intensity, direction, speed, scrollOffsetY', () => {
    const e = createWeatherRain('r', {
      intensity: 0.8,
      direction: 15,
      speed: 200,
      scrollOffsetY: 42,
    });
    if (e.uniforms.kind !== 'weather-rain') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.8);
    expect(e.uniforms.direction).toBe(15);
    expect(e.uniforms.speed).toBe(200);
    expect(e.uniforms.scrollOffsetY).toBe(42);
  });

  test('weather-sun-shaft — intensity, direction', () => {
    const e = createWeatherSunShaft('s', { intensity: 0.3, direction: -10 });
    if (e.uniforms.kind !== 'weather-sun-shaft') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.3);
    expect(e.uniforms.direction).toBe(-10);
  });

  test('weather-dark-vignette — intensity', () => {
    const e = createWeatherDarkVignette('dv', { intensity: 0.9 });
    if (e.uniforms.kind !== 'weather-dark-vignette') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.9);
  });

  test('weather-clouds — intensity, direction, speed, scrollOffsetX', () => {
    const e = createWeatherClouds('c', {
      intensity: 0.6,
      direction: 30,
      speed: 50,
      scrollOffsetX: 100,
    });
    if (e.uniforms.kind !== 'weather-clouds') throw new Error('wrong kind');
    expect(e.uniforms.intensity).toBe(0.6);
    expect(e.uniforms.direction).toBe(30);
    expect(e.uniforms.speed).toBe(50);
    expect(e.uniforms.scrollOffsetX).toBe(100);
  });
});

// ── 3. SkSL pin — uniform/entry-point presence ───────────────────────────────

describe('SkSL shader source content', () => {
  test('WEATHER_RAIN_SKSL contains expected uniform names and entry point', () => {
    expect(WEATHER_RAIN_SKSL).toContain('uniform shader src');
    expect(WEATHER_RAIN_SKSL).toContain('uniform float intensity');
    expect(WEATHER_RAIN_SKSL).toContain('uniform float direction');
    expect(WEATHER_RAIN_SKSL).toContain('uniform float scrollOffsetY');
    expect(WEATHER_RAIN_SKSL).toContain('half4 main');
  });

  test('WEATHER_RAIN_SKSL contains uniform float3 color', () => {
    expect(WEATHER_RAIN_SKSL).toContain('uniform float3 color');
  });

  test('WEATHER_RAIN_SKSL contains hash bucketing (floor)', () => {
    expect(WEATHER_RAIN_SKSL).toContain('floor');
  });

  test('WEATHER_RAIN_SKSL contains refraction tap src.eval(coord +', () => {
    expect(WEATHER_RAIN_SKSL).toContain('src.eval(coord +');
  });

  test('WEATHER_SUN_SHAFT_SKSL contains expected uniform names and entry point', () => {
    expect(WEATHER_SUN_SHAFT_SKSL).toContain('uniform shader src');
    expect(WEATHER_SUN_SHAFT_SKSL).toContain('uniform float intensity');
    expect(WEATHER_SUN_SHAFT_SKSL).toContain('uniform float direction');
    expect(WEATHER_SUN_SHAFT_SKSL).toContain('half4 main');
  });

  test('WEATHER_DARK_VIGNETTE_SKSL contains expected uniform names and entry point', () => {
    expect(WEATHER_DARK_VIGNETTE_SKSL).toContain('uniform shader src');
    expect(WEATHER_DARK_VIGNETTE_SKSL).toContain('uniform float intensity');
    expect(WEATHER_DARK_VIGNETTE_SKSL).toContain('half4 main');
  });

  test('WEATHER_CLOUDS_SKSL contains expected uniform names and entry point', () => {
    expect(WEATHER_CLOUDS_SKSL).toContain('uniform shader src');
    expect(WEATHER_CLOUDS_SKSL).toContain('uniform float intensity');
    expect(WEATHER_CLOUDS_SKSL).toContain('uniform float scrollOffsetX');
    expect(WEATHER_CLOUDS_SKSL).toContain('half4 main');
  });
});

// ── 4. packUniforms layout ───────────────────────────────────────────────────

describe('packUniforms layout', () => {
  const { skia } = createMockSkia();
  const rt = createPostFxRuntime(skia);

  test('weather-rain: length = 8', () => {
    const packed = rt.packUniforms(createWeatherRain(), 800, 600);
    expect(packed.length).toBe(8);
  });

  test('weather-rain: intensity at index 2, direction at 3, scrollOffsetY at 4', () => {
    const packed = rt.packUniforms(
      createWeatherRain('r', { intensity: 0.7, direction: 20, scrollOffsetY: 55 }),
      800,
      600,
    );
    expect(packed[0]).toBe(800);
    expect(packed[1]).toBe(600);
    expect(packed[2]).toBeCloseTo(0.7, 5);
    expect(packed[3]).toBeCloseTo(20, 5);
    expect(packed[4]).toBeCloseTo(55, 5);
  });

  test('weather-rain: color at indices 5–7', () => {
    const { skia: skia2 } = createMockSkia();
    const rt2 = createPostFxRuntime(skia2);
    const packed = rt2.packUniforms(createWeatherRain('r', { color: [0.5, 0.6, 0.7] }), 800, 600);
    expect(packed[5]).toBeCloseTo(0.5, 5);
    expect(packed[6]).toBeCloseTo(0.6, 5);
    expect(packed[7]).toBeCloseTo(0.7, 5);
  });

  test('weather-rain: color default [1,1,1]', () => {
    const { skia: skia2 } = createMockSkia();
    const rt2 = createPostFxRuntime(skia2);
    const packed = rt2.packUniforms(createWeatherRain(), 800, 600);
    expect(packed[5]).toBe(1.0);
    expect(packed[6]).toBe(1.0);
    expect(packed[7]).toBe(1.0);
  });

  test('weather-sun-shaft: length = 4', () => {
    const packed = rt.packUniforms(createWeatherSunShaft(), 800, 600);
    expect(packed.length).toBe(4);
  });

  test('weather-sun-shaft: intensity at index 2, direction at 3', () => {
    const packed = rt.packUniforms(
      createWeatherSunShaft('s', { intensity: 0.4, direction: -5 }),
      1024,
      768,
    );
    expect(packed[0]).toBe(1024);
    expect(packed[1]).toBe(768);
    expect(packed[2]).toBeCloseTo(0.4, 5);
    expect(packed[3]).toBeCloseTo(-5, 5);
  });

  test('weather-dark-vignette: length = 3', () => {
    const packed = rt.packUniforms(createWeatherDarkVignette(), 800, 600);
    expect(packed.length).toBe(3);
  });

  test('weather-dark-vignette: intensity at index 2', () => {
    const packed = rt.packUniforms(createWeatherDarkVignette('dv', { intensity: 0.9 }), 640, 480);
    expect(packed[0]).toBe(640);
    expect(packed[1]).toBe(480);
    expect(packed[2]).toBeCloseTo(0.9, 5);
  });

  test('weather-clouds: length = 4', () => {
    const packed = rt.packUniforms(createWeatherClouds(), 800, 600);
    expect(packed.length).toBe(4);
  });

  test('weather-clouds: intensity at index 2, scrollOffsetX at 3', () => {
    const packed = rt.packUniforms(
      createWeatherClouds('c', { intensity: 0.6, scrollOffsetX: 123 }),
      800,
      600,
    );
    expect(packed[0]).toBe(800);
    expect(packed[1]).toBe(600);
    expect(packed[2]).toBeCloseTo(0.6, 5);
    expect(packed[3]).toBeCloseTo(123, 5);
  });
});

// ── 5. EffectKind exhaustiveness / chain.add ─────────────────────────────────

describe('EffectChain.add weather effects', () => {
  test('weather-rain kind discriminant and chain.add does not throw', () => {
    const e = createWeatherRain();
    expect(e.uniforms.kind).toBe('weather-rain');
    const chain = new EffectChain();
    chain.add(e);
    expect(chain.all().length).toBe(1);
  });

  test('weather-sun-shaft kind discriminant and chain.add does not throw', () => {
    const e = createWeatherSunShaft();
    expect(e.uniforms.kind).toBe('weather-sun-shaft');
    const chain = new EffectChain();
    chain.add(e);
    expect(chain.all().length).toBe(1);
  });

  test('weather-dark-vignette kind discriminant and chain.add does not throw', () => {
    const e = createWeatherDarkVignette();
    expect(e.uniforms.kind).toBe('weather-dark-vignette');
    const chain = new EffectChain();
    chain.add(e);
    expect(chain.all().length).toBe(1);
  });

  test('weather-clouds kind discriminant and chain.add does not throw', () => {
    const e = createWeatherClouds();
    expect(e.uniforms.kind).toBe('weather-clouds');
    const chain = new EffectChain();
    chain.add(e);
    expect(chain.all().length).toBe(1);
  });
});

// ── 6. scaleIntensity via globalIntensity ────────────────────────────────────

describe('globalIntensity scales weather effect intensity', () => {
  test('weather-rain: intensity halved at globalIntensity=0.5', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createWeatherRain('r', { intensity: 0.8 }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    expect(pass[0]?.uniforms[2]).toBeCloseTo(0.4, 5);
  });

  test('weather-rain: color indices 5–7 are NOT scaled by globalIntensity', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createWeatherRain('r', { intensity: 1.0, color: [1.0, 1.0, 1.0] }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    expect(pass[0]?.uniforms[5]).toBe(1.0);
    expect(pass[0]?.uniforms[6]).toBe(1.0);
    expect(pass[0]?.uniforms[7]).toBe(1.0);
  });

  test('weather-sun-shaft: intensity halved at globalIntensity=0.5', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createWeatherSunShaft('s', { intensity: 0.6 }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    expect(pass[0]?.uniforms[2]).toBeCloseTo(0.3, 5);
  });

  test('weather-dark-vignette: intensity halved at globalIntensity=0.5', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createWeatherDarkVignette('dv', { intensity: 1.0 }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    expect(pass[0]?.uniforms[2]).toBeCloseTo(0.5, 5);
  });

  test('weather-clouds: intensity halved at globalIntensity=0.5', () => {
    const { skia } = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const chain = new EffectChain();
    chain.add(createWeatherClouds('c', { intensity: 0.8 }));
    chain.globalIntensity = 0.5;
    const pass = rt.buildPass(chain, 800, 600);
    expect(pass[0]?.uniforms[2]).toBeCloseTo(0.4, 5);
  });
});
