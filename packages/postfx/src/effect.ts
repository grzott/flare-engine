/**
 * Effect — an ordered entry in the post-processing chain.
 *
 * `kind` selects a bundled shader (see `shaders.ts`). Each effect owns its
 * own uniform object; the runtime feeds these straight into the compiled
 * RuntimeEffect at draw time.
 */

export type EffectKind =
  | 'vignette'
  | 'grayscale-flash'
  | 'chromatic-aberration'
  | 'crt'
  | 'bloom'
  | 'god-rays';

export interface VignetteUniforms {
  intensity: number;
  radius: number;
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

export type EffectUniforms =
  | ({ kind: 'vignette' } & VignetteUniforms)
  | ({ kind: 'grayscale-flash' } & GrayscaleFlashUniforms)
  | ({ kind: 'chromatic-aberration' } & ChromaticAberrationUniforms)
  | ({ kind: 'crt' } & CrtUniforms)
  | ({ kind: 'bloom' } & BloomUniforms)
  | ({ kind: 'god-rays' } & GodRaysUniforms);

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
