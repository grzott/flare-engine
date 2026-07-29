/**
 * Dev-flag access for the per-sprite transform counters below.
 *
 * Read as a PROPERTY of a stable object, never as the bare `__DEV__` identifier
 * behind a `typeof` guard. JSC has no inline cache for an unresolvable global
 * identifier, so that form costs ~270 ns *per evaluation* wherever the global
 * is undeclared — and this expression sits once per sprite per transform pass,
 * nine times over under an outline effect. A property miss on `globalThis` is
 * inline-cached at ~0.46 ns, ~400x cheaper, and stays togglable at runtime
 * exactly as before.
 *
 * (Phrased without the literal old expression on purpose: the dist canary in
 * `tests/frame-renderer-dist.test.ts` greps the built artifact as text, and a
 * comment quoting it would read as a reintroduction.)
 *
 * React Native always defines `__DEV__`, so RN builds never paid this; web /
 * CanvasKit and any Node or Bun consumer did. Measured B28, retired PERF-10:
 * `render.flush 1000 / 1 atlas` in the UNDECLARED configuration went 412-450 µs
 * before this change to 56-88 µs after — the same band the declared-false
 * configuration occupies, so the two are no longer distinguishable.
 *
 * Non-RN runtimes set `globalThis.__DEV__`, which is the contract api-specs
 * already documents for `isDevMode()`. Truthiness is deliberate: it matches the
 * previous guard for every possible value, so no consumer loses a dev check.
 */

import type { SkImageLike } from '@flare-engine/assets';
import type { CanvasLike } from './renderer.js';
import {
  CAVE_INTERIOR_SKSL,
  FIRE_SKSL,
  FOG_SKSL,
  FOREST_CANOPY_SKSL,
  MOON_CRATER_SKSL,
  MOUNTAIN_HILLS_SKSL,
  RIVER_WAVE_SKSL,
  ROOFS_CITY_SKSL,
  WATER_SKSL,
} from './shaders.js';
import type { SpriteDrawCommand } from './sprite-batch.js';
import {
  type AnySpriteEffect,
  type CaveInteriorEffect,
  type CustomShaderEffect,
  type DropShadowEffect,
  type FireEffect,
  type FlashEffect,
  type FogEffect,
  type ForestCanopyEffect,
  flashIntensity,
  type GrayscaleEffect,
  type MoonCraterEffect,
  type MountainHillsEffect,
  type OutlineEffect,
  type RiverWaveEffect,
  type RoofsCityEffect,
  type SpriteColor,
  type TintEffect,
  type WaterEffect,
} from './sprite-effects.js';

/** See the dev-flag note at the top of this file. */
const G = globalThis as { __DEV__?: boolean };

// ---------------------------------------------------------------------------
// Structural interfaces — no @shopify/react-native-skia import anywhere here.
// ---------------------------------------------------------------------------

/** A 4-float RGBA color buffer (r, g, b, a in [0, 1]). */
export type ColorLike = Float32Array;

/**
 * A mutable axis-aligned rect.
 *
 * The `x`, `y`, `width`, `height` fields are required so that RN-Skia's
 * `SkHostRect` (which carries those fields) structurally satisfies this
 * interface in contra-variant parameter positions.
 */
export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
  setXYWH(x: number, y: number, w: number, h: number): void;
}

/**
 * A mutable similarity transform.
 *
 * The `scos`, `ssin`, `tx`, `ty` fields are readable so that CK-backed
 * canvas wrappers can flatten pools into Float32Arrays without allocation.
 * RN-Skia's `SkRSXform` exposes all four fields.
 */
export interface RSXformLike {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
  set(scos: number, ssin: number, tx: number, ty: number): void;
}

/** A compiled SkSL runtime effect. */
export interface RuntimeEffectLike {
  makeShader(uniforms: number[]): unknown;
  getUniformCount(): number;
  getUniformFloatCount(): number;
  getUniformName(index: number): string;
  getUniform(index: number): { columns: number; rows: number; slot: number };
}

/** Color filter factory — subset used by the frame-renderer. */
export interface ColorFilterFactoryLike {
  MakeBlend(color: Float32Array, mode: number): unknown;
  MakeMatrix(matrix: number[]): unknown;
}

/** Image filter factory — optional; absent on CPU/test surfaces. */
export interface ImageFilterFactoryLike {
  MakeDropShadow(
    dx: number,
    dy: number,
    sigmaX: number,
    sigmaY: number,
    color: Float32Array,
    input: null,
  ): unknown;
}

/** Runtime-effect factory — optional; absent when SkSL is unsupported. */
export interface RuntimeEffectFactoryLike {
  Make(sksl: string): RuntimeEffectLike | null;
}

/** Paint — the writable subset the frame-renderer mutates. */
export interface PaintLike {
  setAlphaf(alpha: number): void;
  setColor?(color: Float32Array): void;
  setColorFilter(filter: unknown): void;
  setShader(shader: unknown): void;
  setImageFilter(filter: unknown): void;
}

/** Minimal draw surface the frame-renderer calls into. */
export interface DrawSurfaceLike {
  save(): number;
  restore(): void;
  translate(x: number, y: number): void;
  scale(sx: number, sy: number): void;
  /** rotate(degrees, cx, cy) — DEGREES, forwarded verbatim (both Skia backends take degrees). */
  rotate(degrees: number, cx: number, cy: number): void;
  clear(color: Float32Array): void;
  drawAtlas(image: unknown, srcRects: RectLike[], dstXforms: RSXformLike[], paint: PaintLike): void;
  drawImageRect(image: unknown, src: RectLike, dst: RectLike, paint: PaintLike): void;
  drawRect(rect: RectLike, paint: PaintLike): void;
}

/**
 * Opaque picture (recorded draw commands).
 * Typed as `object` so both `SkPicture` (RN-Skia) and CanvasKit's
 * `SkPicture` satisfy it without structural mismatches.
 * Callers that need concrete type methods cast to the platform type.
 */
export type PictureLike = object;

/** Picture recorder. */
export interface PictureRecorderLike {
  beginRecording(bounds: RectLike): DrawSurfaceLike;
  finishRecordingAsPicture(): PictureLike;
}

/**
 * Minimal structural view of the Skia module the frame-renderer needs.
 * Declared here so both `@flare-engine/react` and `@flare-engine/render-web`
 * can pass their respective backends without coupling to a concrete Skia SDK.
 *
 * The `Surface` and `ImageFilter` slots are optional because they are absent
 * on CPU surfaces and in test mocks.
 */
export interface FrameRendererModule {
  XYWHRect(x: number, y: number, w: number, h: number): RectLike;
  RSXform(scos: number, ssin: number, tx: number, ty: number): RSXformLike;
  Paint(): PaintLike;
  PictureRecorder(): PictureRecorderLike;
  ColorFilter: ColorFilterFactoryLike;
  RuntimeEffect?: RuntimeEffectFactoryLike;
  ImageFilter?: ImageFilterFactoryLike;
}

/**
 * A single compiled postfx pass descriptor produced by the runtime.
 */
export interface FrameRendererCompiledPass {
  readonly id: string;
  readonly shader: {
    makeShaderWithChildren(uniforms: number[], children: unknown[]): unknown | null;
    getUniformCount?(): number;
    getUniformName?(index: number): string;
    getUniform?(index: number): { columns: number; rows: number; slot: number };
  };
  readonly uniforms: Float32Array;
  readonly children: readonly unknown[];
}

/** Minimal structural view of a PostFxRuntime that the frame-renderer needs. */
export interface FrameRendererPostFxRuntime {
  readonly supported: boolean;
  buildPass?(
    chain: FrameRendererPostFxChain,
    width: number,
    height: number,
  ): readonly FrameRendererCompiledPass[];
}

/** Minimal structural view of an EffectChain the frame-renderer needs. */
export interface FrameRendererPostFxChain {
  enabled(): Iterable<unknown>;
}

/** A resolved postfx pass descriptor with named uniforms (for React JSX). */
export interface FrameRendererPostFxDescriptor {
  readonly id: string;
  readonly source: unknown;
  readonly uniforms: Record<string, number | readonly number[]>;
  readonly children: readonly unknown[];
}

/**
 * Frame renderer that bridges a `SpriteBatch` to a picture-backed draw surface.
 *
 * Each frame:
 *   1. Call `beginFrame(viewportWidth, viewportHeight)`.
 *   2. Call `drawAtlas(image, commands)` one or more times.
 *   3. Call `endFrame()` — returns the recorded picture.
 */
export interface FrameRenderer {
  readonly canvas: CanvasLike;
  beginFrame(
    viewportWidth: number,
    viewportHeight: number,
    time?: number,
    pixelDensity?: number,
  ): void;
  drawAtlas(image: SkImageLike, commands: SpriteDrawCommand[]): void;
  buildPostFxPasses(
    runtime: FrameRendererPostFxRuntime | null,
    chain: FrameRendererPostFxChain | null,
    width: number,
    height: number,
  ): readonly FrameRendererPostFxDescriptor[];
  setPostFxBinding(
    runtime: FrameRendererPostFxRuntime | null,
    chain: FrameRendererPostFxChain | null,
  ): void;
  endFrame(): PictureLike | null;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const BLEND_SRC_OVER = 3;
const BLEND_SRC_IN = 5;

const OUTLINE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

let _xformUnrotatedCount = 0;
let _xformRotatedCount = 0;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a `FrameRenderer` backed by the given structural Skia module.
 *
 * Both `@flare-engine/react` (passing the real RN-Skia module) and
 * `@flare-engine/render-web` (passing a CanvasKit shim) use this factory.
 */
export function createFrameRenderer(Skia: FrameRendererModule): FrameRenderer {
  const defaultPaint: PaintLike = Skia.Paint();

  let tintPaint: PaintLike | null = null;
  let flashPaint: PaintLike | null = null;
  let grayscalePaint: PaintLike | null = null;
  let outlinePaint: PaintLike | null = null;
  let customPaint: PaintLike | null = null;
  let waterPaint: PaintLike | null = null;
  let waterRuntimeEffect: RuntimeEffectLike | null = null;
  let fogPaint: PaintLike | null = null;
  let fogRuntimeEffect: RuntimeEffectLike | null = null;
  let firePaint: PaintLike | null = null;
  let fireRuntimeEffect: RuntimeEffectLike | null = null;
  let dropShadowPaint: PaintLike | null = null;

  let roofsCityPaint: PaintLike | null = null;
  let roofsCityEffect: RuntimeEffectLike | null = null;
  let forestCanopyPaint: PaintLike | null = null;
  let forestCanopyEffect: RuntimeEffectLike | null = null;
  let riverWavePaint: PaintLike | null = null;
  let riverWaveEffect: RuntimeEffectLike | null = null;
  let moonCraterPaint: PaintLike | null = null;
  let moonCraterEffect: RuntimeEffectLike | null = null;
  let caveInteriorPaint: PaintLike | null = null;
  let caveInteriorEffect: RuntimeEffectLike | null = null;
  let mountainHillsPaint: PaintLike | null = null;
  let mountainHillsEffect: RuntimeEffectLike | null = null;

  const roofsCityUniforms: number[] = new Array(10).fill(0);
  const forestCanopyUniforms: number[] = new Array(10).fill(0);
  const riverWaveUniforms: number[] = new Array(10).fill(0);
  const moonCraterUniforms: number[] = new Array(10).fill(0);
  const caveInteriorUniforms: number[] = new Array(10).fill(0);
  const mountainHillsUniforms: number[] = new Array(10).fill(0);

  const recorder: PictureRecorderLike = Skia.PictureRecorder();
  const recordingBounds: RectLike = Skia.XYWHRect(0, 0, 0, 0);

  const srcRects: RectLike[] = [];
  const xforms: RSXformLike[] = [];

  const stretchSrcRects: RectLike[] = [];
  const stretchDstRects: RectLike[] = [];
  let stretchPaint: PaintLike | null = null;

  const zoneBgRects: RectLike[] = [];

  let _cachedSrcSlice: RectLike[] | null = null;
  let _cachedSrcSliceLen = 0;
  let _cachedXformSlice: RSXformLike[] | null = null;
  let _cachedXformSliceLen = 0;

  const clearColor: Float32Array = new Float32Array(4);
  const tintColor: Float32Array = new Float32Array(4);
  const flashColor: Float32Array = new Float32Array(4);
  const outlineColor: Float32Array = new Float32Array(4);
  const dropShadowColor: Float32Array = new Float32Array(4);

  const grayMatrix: number[] = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const customUniforms: number[] = [];

  const waterUniforms: number[] = new Array(11).fill(0);
  const fogUniforms: number[] = new Array(9).fill(0);
  const fireUniforms: number[] = new Array(11).fill(0);

  let currentFrameTime = 0;
  let currentSpriteW = 0;
  let currentSpriteH = 0;
  let current: DrawSurfaceLike | null = null;

  let _boundRuntime: FrameRendererPostFxRuntime | null = null;
  let _boundChain: FrameRendererPostFxChain | null = null;

  const _loggedOnce = new Set<string>();
  function logOnce(msg: string): void {
    if (_loggedOnce.has(msg)) return;
    _loggedOnce.add(msg);
    console.warn(`[postfx] ${msg}`);
  }

  const canvas: CanvasLike = {
    save: () => current?.save() ?? 0,
    restore: () => {
      current?.restore();
    },
    translate: (x, y) => {
      current?.translate(x, y);
    },
    scale: (sx, sy) => {
      current?.scale(sx, sy);
    },
    rotate: (degrees, cx, cy) => {
      current?.rotate(degrees, cx, cy);
    },
    clear: (argb) => {
      if (current === null) return;
      clearColor[0] = ((argb >>> 16) & 0xff) / 255;
      clearColor[1] = ((argb >>> 8) & 0xff) / 255;
      clearColor[2] = (argb & 0xff) / 255;
      clearColor[3] = ((argb >>> 24) & 0xff) / 255;
      current.clear(clearColor);
    },
  };

  function ensurePoolCapacity(n: number): void {
    while (srcRects.length < n) {
      srcRects.push(Skia.XYWHRect(0, 0, 0, 0));
      xforms.push(Skia.RSXform(1, 0, 0, 0));
    }
  }

  function ensureStretchPoolCapacity(n: number): void {
    while (stretchSrcRects.length < n) {
      stretchSrcRects.push(Skia.XYWHRect(0, 0, 0, 0));
      stretchDstRects.push(Skia.XYWHRect(0, 0, 0, 0));
    }
  }

  function ensureZoneBgPoolCapacity(n: number): void {
    while (zoneBgRects.length < n) {
      zoneBgRects.push(Skia.XYWHRect(0, 0, 0, 0));
    }
  }

  function getCachedSrcSlice(n: number): RectLike[] {
    if (_cachedSrcSlice !== null && _cachedSrcSliceLen === n) return _cachedSrcSlice;
    _cachedSrcSlice = srcRects.length === n ? srcRects : srcRects.slice(0, n);
    _cachedSrcSliceLen = n;
    return _cachedSrcSlice;
  }

  function getCachedXformSlice(n: number): RSXformLike[] {
    if (_cachedXformSlice !== null && _cachedXformSliceLen === n) return _cachedXformSlice;
    _cachedXformSlice = xforms.length === n ? xforms : xforms.slice(0, n);
    _cachedXformSliceLen = n;
    return _cachedXformSlice;
  }

  function fillSrcRects(commands: SpriteDrawCommand[], n: number): void {
    for (let i = 0; i < n; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      srcRects[i]?.setXYWH(cmd.srcX, cmd.srcY, cmd.srcW, cmd.srcH);
    }
  }

  function fillXforms(commands: SpriteDrawCommand[], n: number, dx: number, dy: number): void {
    for (let i = 0; i < n; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      const scale = cmd.srcW === 0 ? 1 : cmd.dstW / cmd.srcW;
      if (cmd.rotation === 0) {
        xforms[i]?.set(scale, 0, cmd.dstX + dx, cmd.dstY + dy);
        if (G.__DEV__) _xformUnrotatedCount++;
      } else {
        const c = Math.cos(cmd.rotation);
        const s = Math.sin(cmd.rotation);
        const scos = scale * c;
        const ssin = scale * s;
        const px = cmd.dstX + cmd.anchorX * cmd.dstW + dx;
        const py = cmd.dstY + cmd.anchorY * cmd.dstH + dy;
        const axSrc = cmd.anchorX * cmd.srcW;
        const aySrc = cmd.anchorY * cmd.srcH;
        xforms[i]?.set(
          scos,
          ssin,
          px - scos * axSrc + ssin * aySrc,
          py - ssin * axSrc - scos * aySrc,
        );
        if (G.__DEV__) _xformRotatedCount++;
      }
    }
  }

  function applyTint(effect: TintEffect): PaintLike {
    if (tintPaint === null) tintPaint = Skia.Paint();
    writeColor(tintColor, effect.color, effect.amount);
    tintPaint.setColorFilter(Skia.ColorFilter.MakeBlend(tintColor, BLEND_SRC_OVER));
    return tintPaint;
  }

  function applyFlash(effect: FlashEffect): PaintLike {
    if (flashPaint === null) flashPaint = Skia.Paint();
    writeColor(flashColor, effect.color, flashIntensity(effect));
    flashPaint.setColorFilter(Skia.ColorFilter.MakeBlend(flashColor, BLEND_SRC_OVER));
    return flashPaint;
  }

  function applyGrayscale(effect: GrayscaleEffect): PaintLike {
    if (grayscalePaint === null) grayscalePaint = Skia.Paint();
    writeGrayscaleMatrix(grayMatrix, effect.amount);
    grayscalePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(grayMatrix));
    return grayscalePaint;
  }

  function applyOutlinePaint(effect: OutlineEffect): PaintLike {
    if (outlinePaint === null) outlinePaint = Skia.Paint();
    writeColor(outlineColor, effect.color, 1);
    outlinePaint.setColorFilter(Skia.ColorFilter.MakeBlend(outlineColor, BLEND_SRC_IN));
    return outlinePaint;
  }

  function applyCustom(effect: CustomShaderEffect): PaintLike {
    if (customPaint === null) customPaint = Skia.Paint();
    const shader = effect.shader as RuntimeEffectLike;
    const floatCount = shader.getUniformFloatCount();
    while (customUniforms.length < floatCount) customUniforms.push(0);
    customUniforms.length = floatCount;
    fillCustomUniforms(effect, shader, customUniforms);
    customPaint.setShader(shader.makeShader(customUniforms));
    return customPaint;
  }

  function applyWater(effect: WaterEffect, time: number): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (waterRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(WATER_SKSL);
      if (compiled === null) return defaultPaint;
      waterRuntimeEffect = compiled;
    }
    if (waterPaint === null) waterPaint = Skia.Paint();
    waterUniforms[0] = currentSpriteW;
    waterUniforms[1] = currentSpriteH;
    waterUniforms[2] = effect.color.r;
    waterUniforms[3] = effect.color.g;
    waterUniforms[4] = effect.color.b;
    waterUniforms[5] = effect.foamColor.r;
    waterUniforms[6] = effect.foamColor.g;
    waterUniforms[7] = effect.foamColor.b;
    waterUniforms[8] = effect.waveSpeed;
    waterUniforms[9] = effect.waveAmplitude;
    waterUniforms[10] = time;
    waterPaint.setShader(waterRuntimeEffect.makeShader(waterUniforms));
    return waterPaint;
  }

  function applyFog(effect: FogEffect, time: number): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fogRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FOG_SKSL);
      if (compiled === null) return defaultPaint;
      fogRuntimeEffect = compiled;
    }
    if (fogPaint === null) fogPaint = Skia.Paint();
    fogUniforms[0] = currentSpriteW;
    fogUniforms[1] = currentSpriteH;
    fogUniforms[2] = effect.color.r;
    fogUniforms[3] = effect.color.g;
    fogUniforms[4] = effect.color.b;
    fogUniforms[5] = effect.density;
    fogUniforms[6] = effect.speed;
    fogUniforms[7] = effect.scale;
    fogUniforms[8] = time;
    fogPaint.setShader(fogRuntimeEffect.makeShader(fogUniforms));
    return fogPaint;
  }

  function applyFire(effect: FireEffect, time: number): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fireRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FIRE_SKSL);
      if (compiled === null) return defaultPaint;
      fireRuntimeEffect = compiled;
    }
    if (firePaint === null) firePaint = Skia.Paint();
    fireUniforms[0] = currentSpriteW;
    fireUniforms[1] = currentSpriteH;
    fireUniforms[2] = effect.color.r;
    fireUniforms[3] = effect.color.g;
    fireUniforms[4] = effect.color.b;
    fireUniforms[5] = effect.tipColor.r;
    fireUniforms[6] = effect.tipColor.g;
    fireUniforms[7] = effect.tipColor.b;
    fireUniforms[8] = effect.speed;
    fireUniforms[9] = effect.intensity;
    fireUniforms[10] = time;
    firePaint.setShader(fireRuntimeEffect.makeShader(fireUniforms));
    return firePaint;
  }

  function applyDropShadow(effect: DropShadowEffect): PaintLike {
    if (Skia.ImageFilter === undefined) return defaultPaint;
    if (dropShadowPaint === null) dropShadowPaint = Skia.Paint();
    writeColor(dropShadowColor, effect.color, 1);
    dropShadowPaint.setImageFilter(
      Skia.ImageFilter.MakeDropShadow(
        effect.offsetX,
        effect.offsetY,
        effect.blur,
        effect.blur,
        dropShadowColor,
        null,
      ),
    );
    return dropShadowPaint;
  }

  function applyRoofsCity(effect: RoofsCityEffect): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (roofsCityEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(ROOFS_CITY_SKSL);
      if (compiled === null) return defaultPaint;
      roofsCityEffect = compiled;
    }
    if (roofsCityPaint === null) roofsCityPaint = Skia.Paint();
    roofsCityUniforms[0] = effect.resolutionW;
    roofsCityUniforms[1] = effect.resolutionH;
    roofsCityUniforms[2] = effect.skyColor.r;
    roofsCityUniforms[3] = effect.skyColor.g;
    roofsCityUniforms[4] = effect.skyColor.b;
    roofsCityUniforms[5] = effect.roofColor.r;
    roofsCityUniforms[6] = effect.roofColor.g;
    roofsCityUniforms[7] = effect.roofColor.b;
    roofsCityUniforms[8] = effect.scrollOffsetY;
    roofsCityUniforms[9] = effect.density;
    roofsCityPaint.setShader(roofsCityEffect.makeShader(roofsCityUniforms));
    return roofsCityPaint;
  }

  function applyForestCanopy(effect: ForestCanopyEffect): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (forestCanopyEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FOREST_CANOPY_SKSL);
      if (compiled === null) return defaultPaint;
      forestCanopyEffect = compiled;
    }
    if (forestCanopyPaint === null) forestCanopyPaint = Skia.Paint();
    forestCanopyUniforms[0] = effect.resolutionW;
    forestCanopyUniforms[1] = effect.resolutionH;
    forestCanopyUniforms[2] = effect.skyColor.r;
    forestCanopyUniforms[3] = effect.skyColor.g;
    forestCanopyUniforms[4] = effect.skyColor.b;
    forestCanopyUniforms[5] = effect.leafColor.r;
    forestCanopyUniforms[6] = effect.leafColor.g;
    forestCanopyUniforms[7] = effect.leafColor.b;
    forestCanopyUniforms[8] = effect.scrollOffsetY;
    forestCanopyUniforms[9] = effect.density;
    forestCanopyPaint.setShader(forestCanopyEffect.makeShader(forestCanopyUniforms));
    return forestCanopyPaint;
  }

  function applyRiverWave(effect: RiverWaveEffect): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (riverWaveEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(RIVER_WAVE_SKSL);
      if (compiled === null) return defaultPaint;
      riverWaveEffect = compiled;
    }
    if (riverWavePaint === null) riverWavePaint = Skia.Paint();
    riverWaveUniforms[0] = effect.resolutionW;
    riverWaveUniforms[1] = effect.resolutionH;
    riverWaveUniforms[2] = effect.waterColor.r;
    riverWaveUniforms[3] = effect.waterColor.g;
    riverWaveUniforms[4] = effect.waterColor.b;
    riverWaveUniforms[5] = effect.foamColor.r;
    riverWaveUniforms[6] = effect.foamColor.g;
    riverWaveUniforms[7] = effect.foamColor.b;
    riverWaveUniforms[8] = effect.scrollOffsetY;
    riverWaveUniforms[9] = effect.waveScale;
    riverWavePaint.setShader(riverWaveEffect.makeShader(riverWaveUniforms));
    return riverWavePaint;
  }

  function applyMoonCrater(effect: MoonCraterEffect): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (moonCraterEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(MOON_CRATER_SKSL);
      if (compiled === null) return defaultPaint;
      moonCraterEffect = compiled;
    }
    if (moonCraterPaint === null) moonCraterPaint = Skia.Paint();
    moonCraterUniforms[0] = effect.resolutionW;
    moonCraterUniforms[1] = effect.resolutionH;
    moonCraterUniforms[2] = effect.moonColor.r;
    moonCraterUniforms[3] = effect.moonColor.g;
    moonCraterUniforms[4] = effect.moonColor.b;
    moonCraterUniforms[5] = effect.craterColor.r;
    moonCraterUniforms[6] = effect.craterColor.g;
    moonCraterUniforms[7] = effect.craterColor.b;
    moonCraterUniforms[8] = effect.scrollOffsetY;
    moonCraterUniforms[9] = effect.craterCount;
    moonCraterPaint.setShader(moonCraterEffect.makeShader(moonCraterUniforms));
    return moonCraterPaint;
  }

  function applyCaveInterior(effect: CaveInteriorEffect): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (caveInteriorEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(CAVE_INTERIOR_SKSL);
      if (compiled === null) return defaultPaint;
      caveInteriorEffect = compiled;
    }
    if (caveInteriorPaint === null) caveInteriorPaint = Skia.Paint();
    caveInteriorUniforms[0] = effect.resolutionW;
    caveInteriorUniforms[1] = effect.resolutionH;
    caveInteriorUniforms[2] = effect.caveColor.r;
    caveInteriorUniforms[3] = effect.caveColor.g;
    caveInteriorUniforms[4] = effect.caveColor.b;
    caveInteriorUniforms[5] = effect.glowColor.r;
    caveInteriorUniforms[6] = effect.glowColor.g;
    caveInteriorUniforms[7] = effect.glowColor.b;
    caveInteriorUniforms[8] = effect.scrollOffsetY;
    caveInteriorUniforms[9] = effect.stalactiteCount;
    caveInteriorPaint.setShader(caveInteriorEffect.makeShader(caveInteriorUniforms));
    return caveInteriorPaint;
  }

  function applyMountainHills(effect: MountainHillsEffect): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (mountainHillsEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(MOUNTAIN_HILLS_SKSL);
      if (compiled === null) return defaultPaint;
      mountainHillsEffect = compiled;
    }
    if (mountainHillsPaint === null) mountainHillsPaint = Skia.Paint();
    mountainHillsUniforms[0] = effect.resolutionW;
    mountainHillsUniforms[1] = effect.resolutionH;
    mountainHillsUniforms[2] = effect.skyColor.r;
    mountainHillsUniforms[3] = effect.skyColor.g;
    mountainHillsUniforms[4] = effect.skyColor.b;
    mountainHillsUniforms[5] = effect.hillColor.r;
    mountainHillsUniforms[6] = effect.hillColor.g;
    mountainHillsUniforms[7] = effect.hillColor.b;
    mountainHillsUniforms[8] = effect.scrollOffsetY;
    mountainHillsUniforms[9] = effect.ridgeScale;
    mountainHillsPaint.setShader(mountainHillsEffect.makeShader(mountainHillsUniforms));
    return mountainHillsPaint;
  }

  function drawOutlined(
    cvs: DrawSurfaceLike,
    image: unknown,
    commands: SpriteDrawCommand[],
    n: number,
    effect: OutlineEffect,
    alpha: number,
  ): void {
    const paint = applyOutlinePaint(effect);
    paint.setAlphaf(alpha);
    const srcs = getCachedSrcSlice(n);
    for (let k = 0; k < OUTLINE_OFFSETS.length; k++) {
      const offset = OUTLINE_OFFSETS[k] as readonly [number, number];
      fillXforms(commands, n, offset[0] * effect.width, offset[1] * effect.width);
      const dsts = getCachedXformSlice(n);
      cvs.drawAtlas(image, srcs, dsts, paint);
    }
    paint.setAlphaf(1);
    defaultPaint.setAlphaf(alpha);
    fillXforms(commands, n, 0, 0);
    const mainDsts = getCachedXformSlice(n);
    cvs.drawAtlas(image, srcs, mainDsts, defaultPaint);
    defaultPaint.setAlphaf(1);
  }

  function resolveEffectPaint(effect: AnySpriteEffect): PaintLike {
    switch (effect.type) {
      case 'tint':
        return applyTint(effect);
      case 'flash':
        return applyFlash(effect);
      case 'grayscale':
        return applyGrayscale(effect);
      case 'custom':
        return applyCustom(effect);
      case 'water':
        return applyWater(effect, currentFrameTime);
      case 'fog':
        return applyFog(effect, currentFrameTime);
      case 'fire':
        return applyFire(effect, currentFrameTime);
      case 'drop-shadow':
        return applyDropShadow(effect);
      case 'outline':
        return applyOutlinePaint(effect);
      case 'roofs-city':
        return applyRoofsCity(effect);
      case 'forest-canopy':
        return applyForestCanopy(effect);
      case 'river-wave':
        return applyRiverWave(effect);
      case 'moon-crater':
        return applyMoonCrater(effect);
      case 'cave-interior':
        return applyCaveInterior(effect);
      case 'mountain-hills':
        return applyMountainHills(effect);
    }
  }

  return {
    canvas,

    beginFrame(viewportWidth, viewportHeight, time = 0, pixelDensity = 1): void {
      if (viewportWidth === 0 || viewportHeight === 0) return;
      _boundRuntime = null;
      _boundChain = null;
      currentFrameTime = time;
      const pd = pixelDensity;
      recordingBounds.setXYWH(0, 0, viewportWidth * pd, viewportHeight * pd);
      current = recorder.beginRecording(recordingBounds);
      if (pd !== 1) current.scale(pd, pd);
    },

    drawAtlas(image, commands): void {
      if (current === null) return;
      const n = commands.length;
      if (n === 0) return;

      const effect = commands[0]?.effect;
      const alpha = commands[0]?.alpha ?? 1;
      currentSpriteW = commands[0]?.dstW ?? 0;
      currentSpriteH = commands[0]?.dstH ?? 0;

      if (
        effect?.type === 'roofs-city' ||
        effect?.type === 'forest-canopy' ||
        effect?.type === 'river-wave' ||
        effect?.type === 'moon-crater' ||
        effect?.type === 'cave-interior' ||
        effect?.type === 'mountain-hills'
      ) {
        const paint = resolveEffectPaint(effect);
        paint.setAlphaf(alpha);
        ensureZoneBgPoolCapacity(n);
        for (let i = 0; i < n; i++) {
          const cmd = commands[i] as SpriteDrawCommand;
          zoneBgRects[i]!.setXYWH(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
          current.drawRect(zoneBgRects[i]!, paint);
        }
        paint.setAlphaf(1);
        return;
      }

      if (commands[0]?.stretch) {
        ensureStretchPoolCapacity(n);
        if (stretchPaint === null) stretchPaint = Skia.Paint();
        const sp = stretchPaint;
        // outline requires two passes (SRC_IN silhouette + source) which is
        // incompatible with the single-drawImageRect stretch path; fall back
        // to alpha-only like the pre-effect baseline.
        const sPaint =
          effect === undefined || effect.type === 'outline' ? sp : resolveEffectPaint(effect);
        sPaint.setAlphaf(alpha);
        for (let i = 0; i < n; i++) {
          const cmd = commands[i] as SpriteDrawCommand;
          const srcR = stretchSrcRects[i]!;
          const dstR = stretchDstRects[i]!;
          srcR.setXYWH(cmd.srcX, cmd.srcY, cmd.srcW, cmd.srcH);
          dstR.setXYWH(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
          current.drawImageRect(image, srcR, dstR, sPaint);
        }
        sPaint.setAlphaf(1);
        return;
      }

      ensurePoolCapacity(n);
      fillSrcRects(commands, n);

      if (effect?.type === 'outline') {
        drawOutlined(current, image, commands, n, effect, alpha);
        return;
      }

      fillXforms(commands, n, 0, 0);
      const srcs = getCachedSrcSlice(n);
      const dsts = getCachedXformSlice(n);
      const paint = effect === undefined ? defaultPaint : resolveEffectPaint(effect);
      paint.setAlphaf(alpha);
      current.drawAtlas(image, srcs, dsts, paint);
      paint.setAlphaf(1);
    },

    setPostFxBinding(runtime, chain): void {
      _boundRuntime = runtime;
      _boundChain = chain;
    },

    buildPostFxPasses(runtime, chain, width, height): readonly FrameRendererPostFxDescriptor[] {
      const rt = runtime ?? _boundRuntime;
      const ch = chain ?? _boundChain;
      if (rt === null || !rt.supported) return [];
      if (rt.buildPass === undefined) {
        logOnce('buildPostFxPasses: runtime.supported but buildPass absent — no passes');
        return [];
      }
      if (ch === null) return [];
      const passes = rt.buildPass(ch, width, height);
      if (passes.length === 0) return [];
      const out: FrameRendererPostFxDescriptor[] = [];
      for (const pass of passes) {
        const shader = pass.shader;
        const uniformCount =
          typeof shader.getUniformCount === 'function' ? shader.getUniformCount() : 0;
        const uniforms: Record<string, number | readonly number[]> = {};
        for (let i = 0; i < uniformCount; i++) {
          const name =
            typeof shader.getUniformName === 'function' ? shader.getUniformName(i) : String(i);
          const info =
            typeof shader.getUniform === 'function'
              ? shader.getUniform(i)
              : { columns: 1, rows: 1, slot: i };
          const size = info.columns * info.rows;
          if (size === 1) {
            uniforms[name] = pass.uniforms[info.slot] ?? 0;
          } else {
            const vec: number[] = [];
            for (let k = 0; k < size; k++) {
              vec.push(pass.uniforms[info.slot + k] ?? 0);
            }
            uniforms[name] = vec;
          }
        }
        out.push({
          id: pass.id,
          source: shader,
          uniforms,
          children: pass.children,
        });
      }
      return out;
    },

    endFrame(): PictureLike | null {
      if (current === null) return null;
      current = null;
      return recorder.finishRecordingAsPicture();
    },
  };
}

// ---------------------------------------------------------------------------
// Xform branch counters — observable surface for bench/diagnostic use
// ---------------------------------------------------------------------------

/** Zero both branch counters unconditionally (no __DEV__ guard). */
export function resetXformCounters(): void {
  _xformUnrotatedCount = 0;
  _xformRotatedCount = 0;
}

/**
 * Cumulative `fillXforms` branch hit counts since the last reset. Both stay 0
 * when `__DEV__` is falsy or absent.
 *
 * These count transform WRITES, not sprites: a run drawn with an outline effect
 * passes through `fillXforms` 9 times (8 offset passes + 1 main pass), so it
 * contributes 9 hits per command — the transform work the renderer actually
 * performs. The counters are process-global: every `createFrameRenderer`
 * instance increments the same pair, so readings sum across live renderers.
 *
 * Allocates one object per call — never call it from the render loop.
 */
export function getXformCounters(): { rotated: number; unrotated: number } {
  return { rotated: _xformRotatedCount, unrotated: _xformUnrotatedCount };
}

// ---------------------------------------------------------------------------
// Private helpers (module-private, not exported)
// ---------------------------------------------------------------------------

function writeColor(out: Float32Array, color: SpriteColor, alphaMul: number): void {
  out[0] = color.r;
  out[1] = color.g;
  out[2] = color.b;
  out[3] = color.a * alphaMul;
}

function writeGrayscaleMatrix(out: number[], amount: number): void {
  const inv = 1 - amount;
  const lr = 0.299 * amount;
  const lg = 0.587 * amount;
  const lb = 0.114 * amount;
  out[0] = inv + lr;
  out[1] = lg;
  out[2] = lb;
  out[3] = 0;
  out[4] = 0;
  out[5] = lr;
  out[6] = inv + lg;
  out[7] = lb;
  out[8] = 0;
  out[9] = 0;
  out[10] = lr;
  out[11] = lg;
  out[12] = inv + lb;
  out[13] = 0;
  out[14] = 0;
  out[15] = 0;
  out[16] = 0;
  out[17] = 0;
  out[18] = 1;
  out[19] = 0;
}

function fillCustomUniforms(
  effect: CustomShaderEffect,
  shader: RuntimeEffectLike,
  out: number[],
): void {
  const count = shader.getUniformCount();
  for (let i = 0; i < out.length; i++) out[i] = 0;
  for (let i = 0; i < count; i++) {
    const info = shader.getUniform(i);
    const name = shader.getUniformName(i);
    const value = effect.uniforms[name];
    const size = info.columns * info.rows;
    if (value === undefined) continue;
    if (typeof value === 'number') {
      out[info.slot] = value;
      continue;
    }
    for (let k = 0; k < size; k++) {
      out[info.slot + k] = value[k] ?? 0;
    }
  }
}
