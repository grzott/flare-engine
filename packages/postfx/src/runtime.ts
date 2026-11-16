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
  makeShaderWithChildren(uniforms: Float32Array | number[], children?: unknown[]): unknown | null;
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
  /**
   * Build a list of compiled pass descriptors in chain order for enabled effects.
   *
   * The returned array, its pass objects and their `uniforms` buffers belong to
   * the runtime and are rewritten by the next `buildPass` call on it, whichever
   * chain that call is given; copy what must outlive the call. A `uniforms`
   * buffer is replaced only when its slot needs a different length, and a
   * `children` array is replaced, never written into, when its contents change.
   */
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
   * beyond `src` (e.g. a noise texture, an LUT). Every built-in effect
   * *except* `color-grading-lut` has no extra children, so this is the frozen
   * `EMPTY_CHILDREN` sentinel — enabling zero-alloc sharing across those
   * passes. `color-grading-lut` yields exactly one extra child — the LUT
   * `SkImage` (`effect.uniforms.lut`) — bound as the shader's second
   * `uniform shader` (index 1) after the implicit `src` (index 0).
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
export function createPostFxRuntime(
  skia: SkiaPostFxModuleLike | null,
  opts?: { verbose?: boolean },
): PostFxRuntime {
  const cache = new Map<EffectKind, CompiledShader>();
  const _loggedCompileFailures = new Set<EffectKind>();
  const _loggedCompileSuccesses = new Set<EffectKind>();
  const supported = skia !== null && typeof skia.RuntimeEffect?.Make === 'function';
  // The one array `buildPass` returns; its pass descriptors are rewritten in place.
  const passes: CompiledPass[] = [];

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
        if (opts?.verbose === true && typeof effect.getUniformFloatCount === 'function') {
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
      const out = new Float32Array(UNIFORM_FLOAT_COUNT[effect.uniforms.kind]);
      packUniformsInto(effect.uniforms, width, height, out);
      return out;
    },
    buildPass(chain, width, height) {
      let count = 0;
      if (supported) {
        const effects = chain.all();
        const scale = chain.globalIntensity;
        for (let i = 0; i < effects.length; i++) {
          const effect = effects[i];
          if (effect === undefined || !effect.enabled) continue;
          const u = effect.uniforms;
          const compiled = this.compile(u.kind);
          if (!compiled) continue;
          const floats = UNIFORM_FLOAT_COUNT[u.kind];
          let pass = passes[count];
          if (pass === undefined) {
            pass = {
              id: effect.id,
              kind: u.kind,
              shader: compiled.effect,
              uniforms: new Float32Array(floats),
              children: EMPTY_CHILDREN,
            };
            passes[count] = pass;
          } else {
            pass.id = effect.id;
            pass.kind = u.kind;
            pass.shader = compiled.effect;
            if (pass.uniforms.length !== floats) pass.uniforms = new Float32Array(floats);
          }
          packUniformsInto(u, width, height, pass.uniforms);
          if (scale !== 1) scaleIntensity(u.kind, pass.uniforms, scale);
          if (u.kind !== 'color-grading-lut') {
            pass.children = EMPTY_CHILDREN;
          } else if (pass.children.length !== 1 || pass.children[0] !== u.lut) {
            // A new array, never a write into the old one: a consumer may still
            // hold last frame's `children` to detect that the LUT image changed.
            pass.children = [u.lut];
          }
          count++;
        }
      }
      if (passes.length !== count) passes.length = count;
      return passes;
    },
    reset() {
      cache.clear();
    },
  };
}

/** Length of the packed uniform buffer per effect kind — the float count its SkSL declares. */
const UNIFORM_FLOAT_COUNT: Record<EffectKind, number> = {
  vignette: 7,
  'grayscale-flash': 1,
  'chromatic-aberration': 3,
  crt: 4,
  bloom: 4,
  'god-rays': 12,
  'color-grading-lut': 1,
  'weather-rain': 10,
  'weather-sun-shaft': 4,
  'weather-dark-vignette': 3,
  'weather-clouds': 5,
  composite: 24,
};

/** Write `u` into `out`, which holds `UNIFORM_FLOAT_COUNT[u.kind]` floats, in shader declaration order. */
function packUniformsInto(
  u: EffectUniforms,
  width: number,
  height: number,
  out: Float32Array,
): void {
  switch (u.kind) {
    case 'vignette': {
      // resolution.xy, intensity, radius, color.rgb
      const col = u.color;
      out[0] = width;
      out[1] = height;
      out[2] = u.intensity;
      out[3] = u.radius;
      out[4] = col === undefined ? 0 : col[0];
      out[5] = col === undefined ? 0 : col[1];
      out[6] = col === undefined ? 0 : col[2];
      return;
    }
    case 'grayscale-flash':
      out[0] = u.intensity;
      return;
    case 'chromatic-aberration':
      out[0] = width;
      out[1] = height;
      out[2] = u.amount;
      return;
    case 'crt':
      out[0] = width;
      out[1] = height;
      out[2] = u.scanlineIntensity;
      out[3] = u.curvature;
      return;
    case 'bloom':
      out[0] = width;
      out[1] = height;
      out[2] = u.threshold;
      out[3] = u.intensity;
      return;
    case 'god-rays':
      out[0] = width;
      out[1] = height;
      out[2] = u.lightX;
      out[3] = u.lightY;
      out[4] = u.color[0];
      out[5] = u.color[1];
      out[6] = u.color[2];
      out[7] = u.intensity;
      out[8] = u.decay;
      out[9] = u.density;
      out[10] = u.weight;
      out[11] = Math.max(1, Math.min(64, Math.round(u.samples)));
      return;
    case 'color-grading-lut':
      out[0] = u.intensity;
      return;
    // Weather kinds: direction is packed and consumed by both rain and clouds shaders.
    // speed was removed from WeatherRainUniforms and WeatherCloudsUniforms.
    case 'weather-rain': {
      const col = u.color;
      out[0] = width;
      out[1] = height;
      out[2] = u.intensity;
      out[3] = u.direction;
      out[4] = u.scrollOffsetY;
      out[5] = col === undefined ? 1 : col[0];
      out[6] = col === undefined ? 1 : col[1];
      out[7] = col === undefined ? 1 : col[2];
      out[8] = u.density ?? 0.5;
      out[9] = u.streakLen ?? 0.15;
      return;
    }
    case 'weather-sun-shaft':
      out[0] = width;
      out[1] = height;
      out[2] = u.intensity;
      out[3] = u.direction;
      return;
    case 'weather-dark-vignette':
      out[0] = width;
      out[1] = height;
      out[2] = u.intensity;
      return;
    case 'weather-clouds':
      // Packed in uniform-declaration order: resolution.xy, intensity, scrollOffsetX, direction.
      out[0] = width;
      out[1] = height;
      out[2] = u.intensity;
      out[3] = u.scrollOffsetX;
      out[4] = u.direction;
      return;
    case 'composite':
      // Packed in uniform-declaration order (24 floats); see COMPOSITE_SKSL header comment.
      out[0] = width;
      out[1] = height;
      out[2] = u.vignetteIntensity;
      out[3] = u.vignetteRadius;
      out[4] = u.vignetteColor[0];
      out[5] = u.vignetteColor[1];
      out[6] = u.vignetteColor[2];
      out[7] = u.bloomThreshold;
      out[8] = u.bloomIntensity;
      out[9] = u.flashIntensity;
      out[10] = u.chromaAmount;
      out[11] = u.crtScanlineIntensity;
      out[12] = u.crtCurvature;
      out[13] = u.crtEnabled ? 1 : 0;
      out[14] = u.weatherKind;
      out[15] = u.weatherIntensity;
      out[16] = u.weatherDirection;
      out[17] = u.weatherScrollX;
      out[18] = u.weatherScrollY;
      out[19] = u.weatherColor[0];
      out[20] = u.weatherColor[1];
      out[21] = u.weatherColor[2];
      out[22] = u.weatherDensity;
      out[23] = u.weatherStreakLen;
      return;
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
