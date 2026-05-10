import type { EffectChain } from './chain.js';
import type { Effect, EffectKind, EffectUniforms } from './effect.js';
import {
  BLOOM_SKSL,
  CHROMATIC_ABERRATION_SKSL,
  COLOR_GRADING_LUT_SKSL,
  CRT_SKSL,
  GOD_RAYS_SKSL,
  GRAYSCALE_FLASH_SKSL,
  VIGNETTE_SKSL,
} from './shaders.js';

/**
 * Runtime — compiles SkSL sources on demand, builds uniform buffers per effect,
 * and exposes an `apply(width, height, chain)` that the renderer calls with
 * a source image to produce the final composited frame.
 *
 * The actual pixel-push happens inside the injected Skia module; this file
 * keeps the orchestration pure so it is fully testable without a GPU.
 */

/**
 * Structural stub for a Skia image handle. No Skia import is needed here
 * because the renderer owns the actual image objects; this type exists only
 * so callers can assign real `SkImage` values to `CompiledPass.children`
 * without coupling this package to a specific Skia version.
 */
export interface SkImageLike {
  readonly _skImageBrand?: never;
}

/** Shared frozen sentinel — every pass with no extra children points here. */
const EMPTY_CHILDREN: readonly SkImageLike[] = Object.freeze([]);

export interface SkiaRuntimeEffectLike {
  makeShader(uniforms: Float32Array, children: unknown[]): unknown | null;
}

export interface SkiaRuntimeEffectFactory {
  Make(sksl: string): SkiaRuntimeEffectLike | null;
}

export interface SkiaPostFxModuleLike {
  RuntimeEffect: SkiaRuntimeEffectFactory;
}

export interface CompiledShader {
  kind: EffectKind;
  effect: SkiaRuntimeEffectLike;
}

export interface PostFxRuntime {
  /** True when the underlying Skia module reported a working RuntimeEffect. */
  readonly supported: boolean;
  /** Lazily compile (and cache) the shader for a given effect. Returns null on unsupported. */
  compile(kind: EffectKind): CompiledShader | null;
  /** Pack an effect's uniforms into a Float32Array in the order the shader declares. */
  packUniforms(effect: Effect, width: number, height: number): Float32Array;
  /** Build a list of `{ shader, uniforms }` tuples in chain order for enabled effects. */
  buildPass(chain: EffectChain, width: number, height: number): CompiledPass[];
  /** Drop all cached compiled shaders. */
  reset(): void;
}

export interface CompiledPass {
  id: string;
  kind: EffectKind;
  shader: SkiaRuntimeEffectLike;
  uniforms: Float32Array;
  /**
   * Convention A — extra sampler children only (excludes src).
   *
   * The renderer binds the implicit scene texture as `children[0]` at draw
   * time. This array holds any *additional* `uniform shader` slots declared
   * beyond `src` (e.g. a noise texture, an LUT). For every built-in effect
   * today there are no extra children, so this is always the frozen
   * `EMPTY_CHILDREN` sentinel — enabling zero-alloc sharing across passes.
   */
  children: readonly SkImageLike[];
}

const SKSL_SOURCE: Record<EffectKind, string> = {
  vignette: VIGNETTE_SKSL,
  'grayscale-flash': GRAYSCALE_FLASH_SKSL,
  'chromatic-aberration': CHROMATIC_ABERRATION_SKSL,
  crt: CRT_SKSL,
  bloom: BLOOM_SKSL,
  'god-rays': GOD_RAYS_SKSL,
  'color-grading-lut': COLOR_GRADING_LUT_SKSL,
};

/**
 * Create a runtime against the given Skia-like module. If the module is
 * absent or lacks `RuntimeEffect.Make`, returns a runtime with
 * `supported: false` — callers should fall through to a passthrough pipeline.
 */
export function createPostFxRuntime(skia: SkiaPostFxModuleLike | null): PostFxRuntime {
  const cache = new Map<EffectKind, CompiledShader>();
  const supported = skia !== null && typeof skia.RuntimeEffect?.Make === 'function';

  return {
    supported,
    compile(kind) {
      if (!supported || !skia) return null;
      const cached = cache.get(kind);
      if (cached) return cached;
      const effect = skia.RuntimeEffect.Make(SKSL_SOURCE[kind]);
      if (!effect) return null;
      const compiled: CompiledShader = { kind, effect };
      cache.set(kind, compiled);
      return compiled;
    },
    packUniforms(effect, width, height) {
      return packUniforms(effect.uniforms, width, height);
    },
    buildPass(chain, width, height) {
      const out: CompiledPass[] = [];
      if (!supported) return out;
      const scale = chain.globalIntensity;
      for (const effect of chain.enabled()) {
        const compiled = this.compile(effect.uniforms.kind);
        if (!compiled) continue;
        const uniforms = packUniforms(effect.uniforms, width, height);
        if (scale !== 1) scaleIntensity(effect.uniforms.kind, uniforms, scale);
        const children: readonly SkImageLike[] =
          effect.uniforms.kind === 'color-grading-lut' ? [effect.uniforms.lut] : EMPTY_CHILDREN;
        out.push({
          id: effect.id,
          kind: effect.uniforms.kind,
          shader: compiled.effect,
          uniforms,
          children,
        });
      }
      return out;
    },
    reset() {
      cache.clear();
    },
  };
}

function packUniforms(u: EffectUniforms, width: number, height: number): Float32Array {
  switch (u.kind) {
    case 'vignette':
      // resolution.xy, intensity, radius
      return new Float32Array([width, height, u.intensity, u.radius]);
    case 'grayscale-flash':
      return new Float32Array([u.intensity]);
    case 'chromatic-aberration':
      return new Float32Array([width, height, u.amount]);
    case 'crt':
      return new Float32Array([width, height, u.scanlineIntensity, u.curvature]);
    case 'bloom':
      return new Float32Array([width, height, u.threshold, u.intensity]);
    case 'god-rays': {
      const samples = Math.max(1, Math.min(64, Math.round(u.samples)));
      return new Float32Array([
        width,
        height,
        u.lightX,
        u.lightY,
        u.color[0],
        u.color[1],
        u.color[2],
        u.intensity,
        u.decay,
        u.density,
        u.weight,
        samples,
      ]);
    }
    case 'color-grading-lut':
      return new Float32Array([u.intensity]);
  }
}

/**
 * Scale the "strength" slot of a packed uniform buffer in place. Geometry
 * fields (radius, curvature, threshold) are intentionally left alone.
 */
function scaleIntensity(kind: EffectKind, packed: Float32Array, scale: number): void {
  switch (kind) {
    case 'vignette':
      // [width, height, intensity, radius]
      packed[2] = (packed[2] ?? 0) * scale;
      return;
    case 'grayscale-flash':
      // [intensity]
      packed[0] = (packed[0] ?? 0) * scale;
      return;
    case 'chromatic-aberration':
      // [width, height, amount]
      packed[2] = (packed[2] ?? 0) * scale;
      return;
    case 'crt':
      // [width, height, scanlineIntensity, curvature]
      packed[2] = (packed[2] ?? 0) * scale;
      return;
    case 'bloom':
      // [width, height, threshold, intensity]
      packed[3] = (packed[3] ?? 0) * scale;
      return;
    case 'god-rays':
      // [width, height, lightX, lightY, colorR, colorG, colorB, intensity, decay, density, weight, samples]
      packed[7] = (packed[7] ?? 0) * scale;
      return;
    case 'color-grading-lut':
      // [intensity]
      packed[0] = (packed[0] ?? 0) * scale;
      return;
  }
}
