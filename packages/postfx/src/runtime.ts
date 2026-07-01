import type { EffectChain } from './chain.js';
import type { Effect, EffectKind, EffectUniforms } from './effect.js';
import {
  BLOOM_SKSL,
  CHROMATIC_ABERRATION_SKSL,
  COLOR_GRADING_LUT_SKSL,
  COMPOSITE_SKSL,
  CRT_SKSL,
  GOD_RAYS_SKSL,
  GRAYSCALE_FLASH_SKSL,
  VIGNETTE_SKSL,
  WEATHER_CLOUDS_SKSL,
  WEATHER_DARK_VIGNETTE_SKSL,
  WEATHER_RAIN_SKSL,
  WEATHER_SUN_SHAFT_SKSL,
} from './shaders.js';

/**
 * Runtime — compiles SkSL sources on demand, builds uniform buffers per effect,
 * and exposes `buildPass` that the bridge calls to get pass descriptors for
 * rendering. Rendering itself is owned by the bridge in `@flare-engine/react`.
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
  makeShaderWithChildren(uniforms: ArrayLike<number>, children?: unknown[]): unknown | null;
  /** Optional diagnostic — total float count expected by makeShaderWithChildren. */
  getUniformFloatCount?(): number;
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
  /** Build a list of compiled pass descriptors in chain order for enabled effects. */
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
  'weather-rain': WEATHER_RAIN_SKSL,
  'weather-sun-shaft': WEATHER_SUN_SHAFT_SKSL,
  'weather-dark-vignette': WEATHER_DARK_VIGNETTE_SKSL,
  'weather-clouds': WEATHER_CLOUDS_SKSL,
  composite: COMPOSITE_SKSL,
};

/**
 * Create a runtime against the given Skia-like module. If the module is
 * absent or lacks `RuntimeEffect.Make`, returns a runtime with
 * `supported: false` — callers should fall through to a passthrough pipeline.
 */
export function createPostFxRuntime(skia: SkiaPostFxModuleLike | null): PostFxRuntime {
  const cache = new Map<EffectKind, CompiledShader>();
  const _loggedCompileFailures = new Set<EffectKind>();
  const _loggedCompileSuccesses = new Set<EffectKind>();
  const supported = skia !== null && typeof skia.RuntimeEffect?.Make === 'function';

  return {
    supported,
    compile(kind) {
      if (!supported || !skia) return null;
      const cached = cache.get(kind);
      if (cached) return cached;
      const effect = skia.RuntimeEffect.Make(SKSL_SOURCE[kind]);
      if (!effect) {
        if (!_loggedCompileFailures.has(kind)) {
          _loggedCompileFailures.add(kind);
          console.warn(
            `[postfx] RuntimeEffect.Make returned null for "${kind}" — shader failed to compile. Pass will be silently skipped.`,
          );
        }
        return null;
      }
      if (!_loggedCompileSuccesses.has(kind)) {
        _loggedCompileSuccesses.add(kind);
        if (typeof effect.getUniformFloatCount === 'function') {
          console.info(
            `[postfx] compiled "${kind}" — getUniformFloatCount=${effect.getUniformFloatCount()}`,
          );
        }
      }
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
    case 'vignette': {
      // resolution.xy, intensity, radius, color.rgb
      const col = u.color ?? [0, 0, 0];
      return new Float32Array([width, height, u.intensity, u.radius, col[0], col[1], col[2]]);
    }
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
    // Weather kinds: TS interfaces are wider than the packed SkSL inputs (speed/direction
    // for clouds, speed for rain are B5-passthrough fields; the shader doesn't consume them).
    case 'weather-rain': {
      const col = u.color ?? [1.0, 1.0, 1.0];
      return new Float32Array([
        width,
        height,
        u.intensity,
        u.direction,
        u.scrollOffsetY,
        col[0],
        col[1],
        col[2],
        u.density ?? 0.5,
        u.streakLen ?? 0.15,
      ]);
    }
    case 'weather-sun-shaft':
      return new Float32Array([width, height, u.intensity, u.direction]);
    case 'weather-dark-vignette':
      return new Float32Array([width, height, u.intensity]);
    case 'weather-clouds':
      return new Float32Array([width, height, u.intensity, u.scrollOffsetX]);
    case 'composite':
      // Packed in uniform-declaration order (24 floats); see COMPOSITE_SKSL header comment.
      return new Float32Array([
        width,
        height,
        u.vignetteIntensity,
        u.vignetteRadius,
        u.vignetteColor[0],
        u.vignetteColor[1],
        u.vignetteColor[2],
        u.bloomThreshold,
        u.bloomIntensity,
        u.flashIntensity,
        u.chromaAmount,
        u.crtScanlineIntensity,
        u.crtCurvature,
        u.crtEnabled ? 1 : 0,
        u.weatherKind,
        u.weatherIntensity,
        u.weatherDirection,
        u.weatherScrollX,
        u.weatherScrollY,
        u.weatherColor[0],
        u.weatherColor[1],
        u.weatherColor[2],
        u.weatherDensity,
        u.weatherStreakLen,
      ]);
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
    case 'weather-rain':
    case 'weather-sun-shaft':
    case 'weather-dark-vignette':
    case 'weather-clouds':
      // [width, height, intensity, ...]
      packed[2] = (packed[2] ?? 0) * scale;
      return;
    case 'composite':
      // Scale all "strength" slots; leave geometry (vignetteRadius, bloomThreshold,
      // crtCurvature, weatherDirection) and the discrete crtEnabled flag alone.
      packed[2] = (packed[2] ?? 0) * scale; // vignetteIntensity
      packed[8] = (packed[8] ?? 0) * scale; // bloomIntensity
      packed[9] = (packed[9] ?? 0) * scale; // flashIntensity
      packed[10] = (packed[10] ?? 0) * scale; // chromaAmount
      packed[15] = (packed[15] ?? 0) * scale; // weatherIntensity
      return;
  }
}
