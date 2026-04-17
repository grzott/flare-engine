import type { EffectChain } from './chain.js';
import type { Effect, EffectKind, EffectUniforms } from './effect.js';
import {
  BLOOM_SKSL,
  CHROMATIC_ABERRATION_SKSL,
  CRT_SKSL,
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
}

const SKSL_SOURCE: Record<EffectKind, string> = {
  vignette: VIGNETTE_SKSL,
  'grayscale-flash': GRAYSCALE_FLASH_SKSL,
  'chromatic-aberration': CHROMATIC_ABERRATION_SKSL,
  crt: CRT_SKSL,
  bloom: BLOOM_SKSL,
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
      for (const effect of chain.enabled()) {
        const compiled = this.compile(effect.uniforms.kind);
        if (!compiled) continue;
        out.push({
          id: effect.id,
          kind: effect.uniforms.kind,
          shader: compiled.effect,
          uniforms: packUniforms(effect.uniforms, width, height),
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
  }
}
