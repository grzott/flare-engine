/**
 * Effect — an ordered entry in the post-processing chain.
 *
 * `kind` selects a bundled shader (see `shaders.ts`). Each effect owns its
 * own uniform object; the runtime feeds these straight into the compiled
 * RuntimeEffect at draw time.
 */

import type { SkImageLike } from './runtime.js';

export type EffectKind =
  | 'vignette'
  | 'grayscale-flash'
  | 'chromatic-aberration'
  | 'crt'
  | 'bloom'
  | 'god-rays'
  | 'color-grading-lut'
  | 'weather-rain'
  | 'weather-sun-shaft'
  | 'weather-dark-vignette'
  | 'weather-clouds';

export interface VignetteUniforms {
  intensity: number;
  radius: number;
  color?: readonly [number, number, number];
}

export interface GrayscaleFlashUniforms {
  intensity: number;
}

export interface ChromaticAberrationUniforms {
  amount: number;
}

export interface CrtUniforms {
  scanlineIntensity: number;
  curvature: number;
}

export interface BloomUniforms {
  threshold: number;
  intensity: number;
}

export interface GodRaysUniforms {
  lightX: number;
  lightY: number;
  color: readonly [number, number, number];
  intensity: number;
  decay: number;
  density: number;
  weight: number;
  samples: number;
}

export interface ColorGradingLutUniforms {
  lut: SkImageLike;
  intensity: number;
}

export interface WeatherRainUniforms {
  intensity: number;
  direction: number;
  speed: number;
  scrollOffsetY: number;
}

export interface WeatherSunShaftUniforms {
  intensity: number;
  direction: number;
}

export interface WeatherDarkVignetteUniforms {
  intensity: number;
}

export interface WeatherCloudsUniforms {
  intensity: number;
  direction: number;
  speed: number;
  scrollOffsetX: number;
}

export type EffectUniforms =
  | ({ kind: 'vignette' } & VignetteUniforms)
  | ({ kind: 'grayscale-flash' } & GrayscaleFlashUniforms)
  | ({ kind: 'chromatic-aberration' } & ChromaticAberrationUniforms)
  | ({ kind: 'crt' } & CrtUniforms)
  | ({ kind: 'bloom' } & BloomUniforms)
  | ({ kind: 'god-rays' } & GodRaysUniforms)
  | ({ kind: 'color-grading-lut' } & ColorGradingLutUniforms)
  | ({ kind: 'weather-rain' } & WeatherRainUniforms)
  | ({ kind: 'weather-sun-shaft' } & WeatherSunShaftUniforms)
  | ({ kind: 'weather-dark-vignette' } & WeatherDarkVignetteUniforms)
  | ({ kind: 'weather-clouds' } & WeatherCloudsUniforms);

export interface Effect {
  id: string;
  enabled: boolean;
  uniforms: EffectUniforms;
}

export function createVignette(id = 'vignette', uniforms: Partial<VignetteUniforms> = {}): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'vignette',
      intensity: uniforms.intensity ?? 0.4,
      radius: uniforms.radius ?? 0.8,
      color: uniforms.color ?? [0, 0, 0],
    },
  };
}

export function createGrayscaleFlash(
  id = 'grayscale-flash',
  uniforms: Partial<GrayscaleFlashUniforms> = {},
): Effect {
  return {
    id,
    enabled: true,
    uniforms: { kind: 'grayscale-flash', intensity: uniforms.intensity ?? 0 },
  };
}

export function createChromaticAberration(
  id = 'chromatic-aberration',
  uniforms: Partial<ChromaticAberrationUniforms> = {},
): Effect {
  return {
    id,
    enabled: true,
    uniforms: { kind: 'chromatic-aberration', amount: uniforms.amount ?? 0.005 },
  };
}

export function createCrt(id = 'crt', uniforms: Partial<CrtUniforms> = {}): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'crt',
      scanlineIntensity: uniforms.scanlineIntensity ?? 0.25,
      curvature: uniforms.curvature ?? 0.12,
    },
  };
}

export function createBloom(id = 'bloom', uniforms: Partial<BloomUniforms> = {}): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'bloom',
      threshold: uniforms.threshold ?? 0.7,
      intensity: uniforms.intensity ?? 0.6,
    },
  };
}

export function createGodRays(id = 'god-rays', uniforms: Partial<GodRaysUniforms> = {}): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'god-rays',
      lightX: uniforms.lightX ?? 0.5,
      lightY: uniforms.lightY ?? 0.1,
      color: uniforms.color ?? [1.0, 0.95, 0.8],
      intensity: uniforms.intensity ?? 0.6,
      decay: uniforms.decay ?? 0.96,
      density: uniforms.density ?? 0.5,
      weight: uniforms.weight ?? 0.4,
      samples: uniforms.samples ?? 48,
    },
  };
}

export function createColorGradingLut(
  uniforms: { lut: SkImageLike; intensity?: number },
  id = 'color-grading-lut',
): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'color-grading-lut',
      lut: uniforms.lut,
      intensity: uniforms.intensity ?? 1.0,
    },
  };
}

export function createWeatherRain(
  id = 'weather-rain',
  uniforms: Partial<WeatherRainUniforms> = {},
): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'weather-rain',
      intensity: uniforms.intensity ?? 0.5,
      direction: uniforms.direction ?? 0,
      speed: uniforms.speed ?? 0,
      scrollOffsetY: uniforms.scrollOffsetY ?? 0,
    },
  };
}

export function createWeatherSunShaft(
  id = 'weather-sun-shaft',
  uniforms: Partial<WeatherSunShaftUniforms> = {},
): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'weather-sun-shaft',
      intensity: uniforms.intensity ?? 0.5,
      direction: uniforms.direction ?? 0,
    },
  };
}

export function createWeatherDarkVignette(
  id = 'weather-dark-vignette',
  uniforms: Partial<WeatherDarkVignetteUniforms> = {},
): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'weather-dark-vignette',
      intensity: uniforms.intensity ?? 0.5,
    },
  };
}

export function createWeatherClouds(
  id = 'weather-clouds',
  uniforms: Partial<WeatherCloudsUniforms> = {},
): Effect {
  return {
    id,
    enabled: true,
    uniforms: {
      kind: 'weather-clouds',
      intensity: uniforms.intensity ?? 0.5,
      direction: uniforms.direction ?? 0,
      speed: uniforms.speed ?? 0,
      scrollOffsetX: uniforms.scrollOffsetX ?? 0,
    },
  };
}
