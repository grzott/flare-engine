/**
 * PT-local PostFxRuntimeLike implementation for the rim-light pass (lighting §1).
 *
 * Implements the structural `PostFxRuntimeLike` interface from
 * `@flare-engine/react` skia-bridge without importing from the engine package
 * (structural compatibility — no nominal import needed).
 *
 * SkSL execution is on-device only; GPU-side behaviour is not tested here.
 * Pure-number helpers (packRimLightUniforms, analyticalNormal, attenuation)
 * are exported for deterministic unit tests.
 */

import { RIM_LIGHT_SKSL } from './rim-light-sksl';

// ---------------------------------------------------------------------------
// Structural stubs (match bridge's PostFxRuntimeLike / PostFxChainLike)
// ---------------------------------------------------------------------------

interface SkiaRuntimeEffectLike {
  makeShader(uniforms: Float32Array, children: unknown[]): unknown | null;
}

interface SkiaPostFxModuleLike {
  RuntimeEffect?: { Make(sksl: string): SkiaRuntimeEffectLike | null };
  Paint?(): { setShader(shader: unknown): void };
}

interface PingPongCanvasLike {
  drawImageRect(image: unknown, src: unknown, dst: unknown, paint: unknown): void;
}

/** Minimal chain stub — the rim-light pass manages its own enabled flag. */
export interface RimLightChain {
  enabled(): Iterable<unknown>;
}

/**
 * Trivially-enabled chain — used as the `PostFxChainLike` argument when
 * calling `bridge.applyPostFx` for the rim-light pass.
 * `enabled()` yields exactly one sentinel item so the bridge's single-pass
 * path calls `runtime.apply(...)`.
 */
const SENTINEL = {};
export const RIM_LIGHT_CHAIN: RimLightChain = {
  enabled(): Iterable<unknown> {
    return [SENTINEL];
  },
};

// ---------------------------------------------------------------------------
// Uniform layout (12 floats, pre-allocated)
// Index  Name
//  0     width
//  1     height
//  2     lightX
//  3     lightY
//  4     lightR
//  5     lightG
//  6     lightB
//  7     lightIntensity
//  8     lightRadius
//  9     bossX
//  10    bossY
//  11    bossRadius
// ---------------------------------------------------------------------------

/** Slot count — exported so tests can assert buffer size without magic number. */
export const RIM_LIGHT_UNIFORM_COUNT = 12;

/**
 * Pack rim-light uniforms into a pre-allocated Float32Array (zero-alloc).
 * The width/height are appended separately so the caller (runtime) can
 * fill them from the frame dimensions without an extra copy.
 */
export function packRimLightUniforms(
  out: Float32Array,
  width: number,
  height: number,
  lightX: number,
  lightY: number,
  lightR: number,
  lightG: number,
  lightB: number,
  lightIntensity: number,
  lightRadius: number,
  bossX: number,
  bossY: number,
  bossRadius: number,
): void {
  out[0] = width;
  out[1] = height;
  out[2] = lightX;
  out[3] = lightY;
  out[4] = lightR;
  out[5] = lightG;
  out[6] = lightB;
  out[7] = lightIntensity;
  out[8] = lightRadius;
  out[9] = bossX;
  out[10] = bossY;
  out[11] = bossRadius;
}

/**
 * Compute the analytical screen-space normal for a point on a hemisphere disc.
 *
 * @param dx      fragCoord.x - bossCenter.x
 * @param dy      fragCoord.y - bossCenter.y
 * @param radius  boss disc radius
 * @returns `[nx, ny, nz]` unit vector (nz >= 0)
 */
export function analyticalNormal(dx: number, dy: number, radius: number): [number, number, number] {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (radius <= 0) return [0, 0, 1];
  if (dist <= 0.001) return [0, 0, 1];
  const t = Math.min(dist / radius, 1);
  const nz = Math.sqrt(Math.max(0, 1 - t * t));
  const scale = t / dist;
  return [dx * scale, dy * scale, nz];
}

/**
 * Physical inverse-square attenuation.
 *
 * @param dist        distance from light to fragment (px)
 * @param lightRadius falloff radius (px) — at `dist=lightRadius`, result ≈ 0.5
 * @returns attenuation in [0..1]
 */
export function attenuation(dist: number, lightRadius: number): number {
  if (lightRadius <= 0) return 0;
  const r2 = lightRadius * lightRadius;
  return 1 / (1 + (dist * dist) / r2);
}

// ---------------------------------------------------------------------------
// Runtime factory
// ---------------------------------------------------------------------------

export interface RimLightRuntime {
  /** True when the Skia module compiled the rim-light effect successfully. */
  readonly supported: boolean;
  /**
   * Update the light + boss position uniforms. Call once per frame before
   * `bridge.applyPostFx`. Zero-alloc — mutates the pre-allocated buffer.
   */
  updateUniforms(
    lightX: number,
    lightY: number,
    lightR: number,
    lightG: number,
    lightB: number,
    lightIntensity: number,
    lightRadius: number,
    bossX: number,
    bossY: number,
    bossRadius: number,
  ): void;
  /**
   * Apply the rim-light pass onto `canvas`. Called by `bridge.applyPostFx`
   * internally via `runtime.apply(canvas, chain, source, w, h)`.
   */
  apply(
    canvas: PingPongCanvasLike,
    chain: RimLightChain,
    source: unknown,
    width: number,
    height: number,
  ): void;
}

/**
 * Create the rim-light runtime. Compiles the SkSL effect once at call time.
 * Returns a runtime with `supported: false` when the Skia module is absent or
 * compilation fails — callers check `supported` before calling `bridge.applyPostFx`.
 */
export function createRimLightRuntime(skia: SkiaPostFxModuleLike | null): RimLightRuntime {
  // Pre-allocated 12-float uniform buffer — mutated in place each frame.
  const uniforms = new Float32Array(RIM_LIGHT_UNIFORM_COUNT);
  // Reusable rect for drawImageRect — mutated in place (zero-alloc).
  const applyRect = { x: 0, y: 0, width: 0, height: 0 };

  let effect: SkiaRuntimeEffectLike | null = null;
  let paint: { setShader(shader: unknown): void } | null = null;
  let supported = false;

  if (skia !== null && typeof skia.RuntimeEffect?.Make === 'function') {
    const compiled = skia.RuntimeEffect.Make(RIM_LIGHT_SKSL);
    if (compiled !== null) {
      effect = compiled;
      supported = true;
    }
  }

  return {
    get supported() {
      return supported;
    },

    updateUniforms(
      lightX,
      lightY,
      lightR,
      lightG,
      lightB,
      lightIntensity,
      lightRadius,
      bossX,
      bossY,
      bossRadius,
    ) {
      // width/height are filled in apply() where dimensions are known.
      uniforms[2] = lightX;
      uniforms[3] = lightY;
      uniforms[4] = lightR;
      uniforms[5] = lightG;
      uniforms[6] = lightB;
      uniforms[7] = lightIntensity;
      uniforms[8] = lightRadius;
      uniforms[9] = bossX;
      uniforms[10] = bossY;
      uniforms[11] = bossRadius;
    },

    apply(canvas, _chain, source, width, height) {
      if (!supported || effect === null || source === null) return;
      if (skia === null || typeof skia.Paint !== 'function') return;
      if (paint === null) paint = skia.Paint();

      uniforms[0] = width;
      uniforms[1] = height;
      applyRect.width = width;
      applyRect.height = height;

      const shader = effect.makeShader(uniforms, [source]);
      paint.setShader(shader);
      canvas.drawImageRect(source, applyRect, applyRect, paint);
    },
  };
}
