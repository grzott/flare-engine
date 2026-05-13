/**
 * ShadowRimRuntime — PT-local PostFxRuntimeLike for the shadow + rim-light
 * combined pass (lighting §2b).
 *
 * Replaces RimLightRuntime in postfx.ts. Adds a CPU-side 1D polar shadow map
 * rebuilt each frame when occluders change, encoded into a 256×1 offscreen
 * texture and passed to the SkSL shader as a second child shader.
 *
 * Occluder layout (3 rects, pre-allocated, mutated each frame):
 *   [0]  left weapon  — center (bossX − 32, bossY), half-extent (5, 10)
 *   [1]  right weapon — center (bossX + 32, bossY), half-extent (5, 10)
 *   [2]  hull AABB    — center (bossX, bossY), half-extent (48, 48)
 *
 * SkSL GPU execution is not tested here. Pure-number helpers
 * (buildShadowMap, sampleShadowMap, etc.) are tested in shadow-map.test.ts.
 */

import { RIM_LIGHT_UNIFORM_COUNT, packRimLightUniforms } from './rim-light-runtime';
import {
  FBO_SIZE,
  type OccluderRect,
  SHADOW_ANGLES,
  buildShadowMap,
  encodeShadowMap,
} from './shadow-map';
import { SHADOW_RIM_SKSL } from './shadow-rim-sksl';

// ---------------------------------------------------------------------------
// Structural stubs — match engine bridge's PostFxRuntimeLike / SkiaModuleLike
// without importing from engine packages.
// ---------------------------------------------------------------------------

interface SkiaRuntimeEffectLike {
  makeShader(uniforms: Float32Array, children: unknown[]): unknown | null;
}

interface ShadowPaintLike {
  setShader(shader: unknown): void;
}

interface ShadowCanvasLike {
  drawRect(rect: unknown, paint: unknown): void;
  clear(color: unknown): void;
}

interface ShadowSurfaceLike {
  getCanvas(): ShadowCanvasLike;
  makeImageSnapshot(): ShadowImageLike;
}

interface ShadowImageLike {
  makeShader?(): unknown;
}

interface SkiaPostFxModuleLike {
  RuntimeEffect?: { Make(sksl: string): SkiaRuntimeEffectLike | null };
  Paint?(): ShadowPaintLike;
  MakeSurface?: (width: number, height: number) => ShadowSurfaceLike | null;
  XYWHRect?: (x: number, y: number, w: number, h: number) => unknown;
}

interface PingPongCanvasLike {
  drawImageRect(image: unknown, src: unknown, dst: unknown, paint: unknown): void;
}

/** Trivially-enabled chain sentinel — same pattern as RIM_LIGHT_CHAIN. */
export interface ShadowRimChain {
  enabled(): Iterable<unknown>;
}

const SENTINEL = {};
export const SHADOW_RIM_CHAIN: ShadowRimChain = {
  enabled(): Iterable<unknown> {
    return [SENTINEL];
  },
};

// ---------------------------------------------------------------------------
// Occluder rect helpers — mutated in place each frame (zero-alloc).
// ---------------------------------------------------------------------------

/** Half-extents for the two weapon rects (Smok: w=10, h=20 → half = 5, 10). */
const WEAPON_HX = 5;
const WEAPON_HY = 10;

/** Weapon X offset from boss center. */
const WEAPON_OX = 32;

/** Hull AABB half-extent (ngon at r=48 → AABB = 96×96 → half = 48). */
const HULL_HALF = 48;

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

export interface ShadowRimRuntime {
  readonly supported: boolean;
  /**
   * Update light + boss uniforms and rebuild the shadow map.
   * Call once per frame before `bridge.applyPostFx`. Zero-alloc — mutates
   * the pre-allocated buffers.
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
  /** Update occluder positions from boss world position and rebuild shadow map. */
  updateOccluders(bossX: number, bossY: number): void;
  apply(
    canvas: PingPongCanvasLike,
    chain: ShadowRimChain,
    source: unknown,
    width: number,
    height: number,
  ): void;
}

/**
 * Create the shadow-rim runtime. Compiles the SkSL effect once at call time.
 * Returns a runtime with `supported: false` when the Skia module is absent,
 * compilation fails, or `MakeSurface` is unavailable (needed for shadow texture).
 */
export function createShadowRimRuntime(skia: SkiaPostFxModuleLike | null): ShadowRimRuntime {
  // Pre-allocated uniform buffer — same 12-float layout as rim-light §1.
  const uniforms = new Float32Array(RIM_LIGHT_UNIFORM_COUNT);

  // Pre-allocated shadow map (256 floats).
  const shadowMapData = new Float32Array(SHADOW_ANGLES);

  // Pre-allocated RGBA encoding buffer for the 256×1 shadow texture.
  const shadowTexPixels = new Uint8Array(SHADOW_ANGLES * 4);

  // Pre-allocated 4-float scratch for setColor calls (RGBA 0..1).
  const colorScratch = new Float32Array(4);

  // Pre-allocated rect for drawImageRect apply pass.
  const applyRect = { x: 0, y: 0, width: 0, height: 0 };

  // Pre-allocated occluder array — 3 mutable entries (zero-alloc after init).
  // OccluderRect is readonly for callers but we own these objects and mutate directly.
  type MutableRect = { x: number; y: number; w: number; h: number };
  const occ0: MutableRect = { x: 0, y: 0, w: 0, h: 0 };
  const occ1: MutableRect = { x: 0, y: 0, w: 0, h: 0 };
  const occ2: MutableRect = { x: 0, y: 0, w: 0, h: 0 };
  const occluders: readonly OccluderRect[] = [occ0, occ1, occ2];

  let effect: SkiaRuntimeEffectLike | null = null;
  // ShadowTexPaint extends ShadowPaintLike with setColor for pixel-encoding draws.
  // In RN Skia all Paint objects expose setColor; this interface narrows the type
  // used only inside rebuildShadowTexture.
  interface ShadowTexPaintLike extends ShadowPaintLike {
    setColor(color: Float32Array): void;
  }

  let applyPaint: ShadowPaintLike | null = null;
  let shadowPaint: ShadowTexPaintLike | null = null;
  let shadowSurface: ShadowSurfaceLike | null = null;
  let shadowImage: ShadowImageLike | null = null;
  let supported = false;

  if (
    skia !== null &&
    typeof skia.RuntimeEffect?.Make === 'function' &&
    typeof skia.MakeSurface === 'function'
  ) {
    const compiled = skia.RuntimeEffect.Make(SHADOW_RIM_SKSL);
    if (compiled !== null) {
      effect = compiled;
      // Pre-allocate the 256×1 shadow surface.
      shadowSurface = skia.MakeSurface(SHADOW_ANGLES, 1) ?? null;
      supported = shadowSurface !== null;
    }
  }

  function rebuildShadowTexture(lightX: number, lightY: number): void {
    if (
      shadowSurface === null ||
      skia === null ||
      typeof skia.Paint !== 'function' ||
      typeof skia.XYWHRect !== 'function'
    ) {
      return;
    }

    buildShadowMap(shadowMapData, occluders, lightX, lightY, SHADOW_ANGLES, FBO_SIZE);
    encodeShadowMap(shadowTexPixels, shadowMapData, SHADOW_ANGLES, FBO_SIZE);

    const canvas = shadowSurface.getCanvas();

    // Clear to opaque black.
    colorScratch[0] = 0;
    colorScratch[1] = 0;
    colorScratch[2] = 0;
    colorScratch[3] = 1;
    canvas.clear(colorScratch);

    if (shadowPaint === null) {
      const p = skia.Paint() as unknown;
      if (
        typeof p === 'object' &&
        p !== null &&
        'setColor' in p &&
        typeof (p as { setColor: unknown }).setColor === 'function'
      ) {
        shadowPaint = p as ShadowTexPaintLike;
      }
    }
    if (shadowPaint === null) return;

    for (let i = 0; i < SHADOW_ANGLES; i++) {
      const base = i * 4;
      // R channel holds the encoded distance (0..255 → 0..1).
      colorScratch[0] = (shadowTexPixels[base] as number) / 255;
      colorScratch[1] = 0;
      colorScratch[2] = 0;
      colorScratch[3] = 1;
      shadowPaint.setColor(colorScratch);
      const rect = skia.XYWHRect(i, 0, 1, 1);
      canvas.drawRect(rect, shadowPaint);
    }

    shadowImage = shadowSurface.makeImageSnapshot();
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
      packRimLightUniforms(
        uniforms,
        0,
        0,
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
      );
    },

    updateOccluders(bossX: number, bossY: number) {
      // Left weapon (bossX − 32, bossY) ± (5, 10)
      occ0.x = bossX - WEAPON_OX - WEAPON_HX;
      occ0.y = bossY - WEAPON_HY;
      occ0.w = WEAPON_HX * 2;
      occ0.h = WEAPON_HY * 2;
      // Right weapon (bossX + 32, bossY) ± (5, 10)
      occ1.x = bossX + WEAPON_OX - WEAPON_HX;
      occ1.y = bossY - WEAPON_HY;
      occ1.w = WEAPON_HX * 2;
      occ1.h = WEAPON_HY * 2;
      // Hull AABB (bossX, bossY) ± 48
      occ2.x = bossX - HULL_HALF;
      occ2.y = bossY - HULL_HALF;
      occ2.w = HULL_HALF * 2;
      occ2.h = HULL_HALF * 2;

      // Rebuild shadow texture with current light position from uniforms.
      const lightX = uniforms[2] as number;
      const lightY = uniforms[3] as number;
      rebuildShadowTexture(lightX, lightY);
    },

    apply(canvas, _chain, source, width, height) {
      if (!supported || effect === null || source === null || shadowImage === null) return;
      if (skia === null || typeof skia.Paint !== 'function') return;
      if (applyPaint === null) applyPaint = skia.Paint();

      uniforms[0] = width;
      uniforms[1] = height;
      applyRect.width = width;
      applyRect.height = height;

      // Build the shadow shader from the snapshot image.
      const shadowShader =
        typeof shadowImage.makeShader === 'function' ? shadowImage.makeShader() : null;

      const shader = effect.makeShader(uniforms, [source, shadowShader]);
      applyPaint.setShader(shader);
      canvas.drawImageRect(source, applyRect, applyRect, applyPaint);
    },
  };
}
