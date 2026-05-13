import type { SkImageLike } from '@flare-engine/assets';
import {
  type AnySpriteEffect,
  type CanvasLike,
  type CustomShaderEffect,
  FIRE_SKSL,
  FOG_SKSL,
  type FireEffect,
  type FlashEffect,
  type FogEffect,
  type GrayscaleEffect,
  type OutlineEffect,
  type SpriteColor,
  type SpriteDrawCommand,
  type TintEffect,
  WATER_SKSL,
  type WaterEffect,
  flashIntensity,
} from '@flare-engine/render';
import type {
  SkCanvas,
  SkColor,
  SkHostRect,
  SkImage,
  SkPaint,
  SkPicture,
  SkPictureRecorder,
  SkRSXform,
  SkRuntimeEffect,
  Skia,
} from '@shopify/react-native-skia';

/** Structural canvas — minimal subset needed for offscreen rendering. */
export interface SkOffscreenCanvasLike {
  drawPicture(picture: unknown): void;
  drawImageRect(image: unknown, src: unknown, dst: unknown, paint: unknown): void;
  drawRect(rect: unknown, paint: unknown): void;
  clear(color: unknown): void;
}

/** Structural canvas surface — minimal subset needed for offscreen capture. */
export interface SkSurfaceLike {
  getCanvas(): SkOffscreenCanvasLike;
  makeImageSnapshot(): SkImageLike;
}

/** A single axis-aligned rectangle shape to draw into an offscreen surface. */
export interface ShapeRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** ARGB packed integer: 0xAARRGGBB */
  readonly color: number;
}

/** Options for `renderShapesToImage`. */
export interface RenderShapesOpts {
  readonly width: number;
  readonly height: number;
  /** ARGB packed integer: 0xAARRGGBB */
  readonly clearColor: number;
  readonly shapes: readonly ShapeRect[];
}

/**
 * Narrow view of the Skia module — only the factories the bridge needs.
 * Declared as its own type so tests can pass a plain mock without pulling
 * in the full `@shopify/react-native-skia` surface.
 */
export type SkiaModuleLike = Pick<
  typeof Skia,
  'XYWHRect' | 'RSXform' | 'Paint' | 'PictureRecorder' | 'ColorFilter'
> & {
  RuntimeEffect?: { Make(sksl: string): SkRuntimeEffect | null };
  MakeSurface?: (width: number, height: number) => SkSurfaceLike | null;
};

/** Minimal structural view of a single compiled postfx pass. */
export interface PostFxPassLike {
  readonly id: string;
}

/** Canvas subset needed for ping-pong blit operations. */
export interface PingPongCanvasLike {
  drawImageRect(image: unknown, src: unknown, dst: unknown, paint: unknown): void;
}

/**
 * Minimal structural view of a PostFxRuntime that the bridge needs.
 * Declared locally so `@flare-engine/react` does not take a hard dep on
 * `@flare-engine/postfx`; interfaces are compatible structurally.
 */
export interface PostFxRuntimeLike {
  readonly supported: boolean;
  apply(
    canvas: PingPongCanvasLike,
    chain: PostFxChainLike,
    source: unknown,
    width: number,
    height: number,
  ): void;
  /**
   * Optional multi-pass interface. When present, the bridge uses it to
   * determine whether ping-pong FBO allocation is needed (passes.length > 1).
   * Each pass is applied individually with `applyPass` if provided.
   */
  buildPass?(chain: PostFxChainLike, width: number, height: number): readonly PostFxPassLike[];
  /** Apply a single compiled pass. Required when `buildPass` is present. */
  applyPass?(
    canvas: PingPongCanvasLike,
    pass: PostFxPassLike,
    source: unknown,
    width: number,
    height: number,
  ): void;
}

/** Minimal structural view of an EffectChain the bridge needs. */
export interface PostFxChainLike {
  enabled(): Iterable<unknown>;
}

/**
 * Frame renderer that bridges a `SpriteBatch` to a Skia `<Picture>`.
 *
 * Each frame:
 *   1. Call `beginFrame(viewportWidth, viewportHeight)` — opens a fresh
 *      picture recording bounded to the viewport. If either dimension is 0
 *      (layout not yet resolved) the call is a no-op and `endFrame` returns
 *      null for that frame.
 *   2. Call `drawAtlas(image, commands)` one or more times (typically via
 *      `batch.flush(bridge.drawAtlas, renderer)`).
 *   3. Call `endFrame()` — returns the recorded `SkPicture` to hand to a
 *      `<Picture>` component inside a `<Canvas>`.
 *
 * The `canvas` field is a `CanvasLike` adapter the frame owner installs on
 * the `Renderer` via `renderer.setCanvas(bridge.canvas)`. It forwards to
 * the live recording canvas between `beginFrame` and `endFrame`, and is a
 * no-op otherwise.
 */
export interface SkiaFrameRenderer {
  readonly canvas: CanvasLike;
  beginFrame(viewportWidth: number, viewportHeight: number, time?: number): void;
  /**
   * drawAtlas callback compatible with `SpriteBatch.flush`. Accepts
   * `SkImageLike` (the narrow `@flare-engine/assets` type used by the batch) and
   * upcasts to a full Skia `SkImage` at the boundary — in practice callers
   * always supply a real `SkImage`.
   */
  drawAtlas(image: SkImageLike, commands: SpriteDrawCommand[]): void;
  /**
   * Capture a snapshot of the current frame's scene drawing as an image.
   *
   * Finishes the current recording into a picture, draws it onto a lazily-
   * allocated offscreen surface (reused and resized across frames), and
   * returns the resulting image.
   *
   * Returns null when:
   *  - no active recording (before `beginFrame` or after `endFrame`)
   *  - `Skia.MakeSurface` is not available in the Skia module
   *  - the surface could not be created (w/h=0, OOM, etc.)
   *
   * After this call the recording continues — `endFrame()` still returns
   * the full frame picture including any subsequent `drawAtlas` calls.
   */
  captureSceneSnapshot(width: number, height: number): SkImageLike | null;

  /**
   * Apply a postfx chain onto the active recording canvas using `source` as
   * the scene texture. Delegates to `runtime.apply(currentCanvas, ...)`.
   *
   * No-ops when:
   *  - no active recording (before `beginFrame` or after `endFrame`)
   *  - `source` is null
   *  - `runtime.supported === false`
   *
   * Source-snapshot capture is **not** done here — the host (row #162) must
   * supply a pre-captured `SkImage` from the current frame.
   */
  applyPostFx(
    runtime: PostFxRuntimeLike,
    chain: PostFxChainLike,
    source: SkImageLike | null,
    width: number,
    height: number,
  ): void;
  endFrame(): SkPicture | null;
}

// Skia BlendMode enum values inlined to avoid a runtime dependency on the
// Skia module for a few numeric constants. Stable ABI — see
// @shopify/react-native-skia/.../Paint/BlendMode.ts.
const BLEND_SRC_OVER = 3;
const BLEND_SRC_IN = 5;

// 8-direction outline offsets (cardinal + diagonal). Diagonal offsets are
// scaled by 1/√2 so all 8 passes lie on a circle of radius `width`.
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

/**
 * Create a `SkiaFrameRenderer`.
 *
 * `Skia` is passed in (rather than imported) so unit tests can supply a
 * mock. Production code constructs this once inside `<GameView>` using the
 * real `Skia` import from `@shopify/react-native-skia`.
 */
export function createSkiaFrameRenderer(Skia: SkiaModuleLike): SkiaFrameRenderer {
  // Default paint used when a batch has no effect. All effect paints are
  // allocated lazily on first use and then mutated in place — the pool is
  // grow-only and reaches a stable max size after the first frame that
  // uses each effect type.
  const defaultPaint: SkPaint = Skia.Paint();

  let tintPaint: SkPaint | null = null;
  let flashPaint: SkPaint | null = null;
  let grayscalePaint: SkPaint | null = null;
  let outlinePaint: SkPaint | null = null;
  let customPaint: SkPaint | null = null;
  let waterPaint: SkPaint | null = null;
  let waterRuntimeEffect: SkRuntimeEffect | null = null;
  let fogPaint: SkPaint | null = null;
  let fogRuntimeEffect: SkRuntimeEffect | null = null;
  let firePaint: SkPaint | null = null;
  let fireRuntimeEffect: SkRuntimeEffect | null = null;

  // Reused across frames via beginRecording / finishRecording cycles.
  const recorder: SkPictureRecorder = Skia.PictureRecorder();

  // Pre-allocated bounds rect — mutated in place each frame so beginFrame
  // adds zero heap allocation on the hot path.
  const recordingBounds: SkHostRect = Skia.XYWHRect(0, 0, 0, 0);

  // Pools grow only — match createRenderSystem's entries policy
  // (packages/render/src/render-system.ts). SkHostRect / SkRSXform expose
  // setXYWH / set mutators so steady state is truly zero-alloc once the
  // pools reach max-seen sprite count.
  const srcRects: SkHostRect[] = [];
  const xforms: SkRSXform[] = [];

  // Reused SkColor (Float32Array) buffer for clear() — ARGB int is unpacked
  // into this slot once per frame, not per call-site.
  const clearColor: SkColor = new Float32Array(4);

  // Scratch color buffers used to build SkColor arguments for
  // ColorFilter.MakeBlend without allocating a fresh Float32Array each call.
  const tintColor: SkColor = new Float32Array(4);
  const flashColor: SkColor = new Float32Array(4);
  const outlineColor: SkColor = new Float32Array(4);

  // Grayscale color matrix (4x5 row-major, length 20). The constant entries
  // are written once here; `writeGrayscaleMatrix` only mutates the rgb
  // weights each call.
  const grayMatrix: number[] = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

  // Flat uniform buffer for custom shaders. Grown on demand to match the
  // current shader's `getUniformFloatCount()`.
  const customUniforms: number[] = [];

  // Pre-allocated 11-float uniform buffer for the water effect.
  // Declaration order: [resW, resH, color.r, color.g, color.b,
  //                     foamColor.r, foamColor.g, foamColor.b,
  //                     waveSpeed, waveAmplitude, time]
  const waterUniforms: number[] = new Array(11).fill(0);

  // Pre-allocated 9-float uniform buffer for the fog effect.
  // Declaration order: [resW, resH, color.r, color.g, color.b,
  //                     density, speed, scale, time]
  const fogUniforms: number[] = new Array(9).fill(0);

  // Pre-allocated 11-float uniform buffer for the fire effect.
  // Declaration order: [resW, resH, color.r, color.g, color.b,
  //                     tipColor.r, tipColor.g, tipColor.b,
  //                     speed, intensity, time]
  const fireUniforms: number[] = new Array(11).fill(0);

  let currentFrameTime = 0;
  let current: SkCanvas | null = null;

  // Offscreen surface for captureSceneSnapshot — allocated lazily, reused
  // across frames, replaced when the viewport dimensions change.
  let snapshotSurface: SkSurfaceLike | null = null;
  let snapshotSurfaceW = 0;
  let snapshotSurfaceH = 0;

  // Ping-pong surfaces for multi-pass postfx chains — allocated lazily,
  // reused across frames, replaced when the viewport dimensions change.
  let pingPingSurface: SkSurfaceLike | null = null;
  let pingPongSurface: SkSurfaceLike | null = null;
  let pingPongW = 0;
  let pingPongH = 0;

  // Saved viewport dims for restarting the recording after a mid-frame snapshot.
  let currentViewportW = 0;
  let currentViewportH = 0;

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
    rotate: (radians, cx, cy) => {
      current?.rotate(radians, cx, cy);
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

  function fillSrcRects(commands: SpriteDrawCommand[], n: number): void {
    for (let i = 0; i < n; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      srcRects[i]?.setXYWH(cmd.srcX, cmd.srcY, cmd.srcW, cmd.srcH);
    }
  }

  function fillXforms(commands: SpriteDrawCommand[], n: number, dx: number, dy: number): void {
    for (let i = 0; i < n; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      const scos = cmd.srcW === 0 ? 1 : cmd.dstW / cmd.srcW;
      xforms[i]?.set(scos, 0, cmd.dstX + dx, cmd.dstY + dy);
    }
  }

  function applyTint(effect: TintEffect): SkPaint {
    if (tintPaint === null) tintPaint = Skia.Paint();
    writeColor(tintColor, effect.color, effect.amount);
    tintPaint.setColorFilter(Skia.ColorFilter.MakeBlend(tintColor, BLEND_SRC_OVER));
    return tintPaint;
  }

  function applyFlash(effect: FlashEffect): SkPaint {
    if (flashPaint === null) flashPaint = Skia.Paint();
    writeColor(flashColor, effect.color, flashIntensity(effect));
    flashPaint.setColorFilter(Skia.ColorFilter.MakeBlend(flashColor, BLEND_SRC_OVER));
    return flashPaint;
  }

  function applyGrayscale(effect: GrayscaleEffect): SkPaint {
    if (grayscalePaint === null) grayscalePaint = Skia.Paint();
    writeGrayscaleMatrix(grayMatrix, effect.amount);
    grayscalePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(grayMatrix));
    return grayscalePaint;
  }

  function applyOutlinePaint(effect: OutlineEffect): SkPaint {
    if (outlinePaint === null) outlinePaint = Skia.Paint();
    writeColor(outlineColor, effect.color, 1);
    outlinePaint.setColorFilter(Skia.ColorFilter.MakeBlend(outlineColor, BLEND_SRC_IN));
    return outlinePaint;
  }

  function applyCustom(effect: CustomShaderEffect): SkPaint {
    if (customPaint === null) customPaint = Skia.Paint();
    const shader = effect.shader as SkRuntimeEffect;
    const floatCount = shader.getUniformFloatCount();
    while (customUniforms.length < floatCount) customUniforms.push(0);
    customUniforms.length = floatCount;
    fillCustomUniforms(effect, shader, customUniforms);
    customPaint.setShader(shader.makeShader(customUniforms));
    return customPaint;
  }

  function applyWater(effect: WaterEffect, time: number): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (waterRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(WATER_SKSL);
      if (compiled === null) return defaultPaint;
      waterRuntimeEffect = compiled;
    }
    if (waterPaint === null) waterPaint = Skia.Paint();
    waterUniforms[0] = 0; // resW — caller fills via drawAtlas; width is not available here,
    waterUniforms[1] = 0; // resH   so resolution slots are zeroed; SkSL can guard divide-by-zero
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

  function applyFog(effect: FogEffect, time: number): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fogRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FOG_SKSL);
      if (compiled === null) return defaultPaint;
      fogRuntimeEffect = compiled;
    }
    if (fogPaint === null) fogPaint = Skia.Paint();
    fogUniforms[0] = 0;
    fogUniforms[1] = 0;
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

  function applyFire(effect: FireEffect, time: number): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fireRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FIRE_SKSL);
      if (compiled === null) return defaultPaint;
      fireRuntimeEffect = compiled;
    }
    if (firePaint === null) firePaint = Skia.Paint();
    // Layout: [resW, resH, color.r, color.g, color.b,
    //          tipColor.r, tipColor.g, tipColor.b, speed, intensity, time]
    fireUniforms[0] = 0;
    fireUniforms[1] = 0;
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

  function drawOutlined(
    canvas: SkCanvas,
    image: SkImage,
    commands: SpriteDrawCommand[],
    n: number,
    effect: OutlineEffect,
    alpha: number,
  ): void {
    const paint = applyOutlinePaint(effect);
    paint.setAlphaf(alpha);
    const srcs = srcRects.length === n ? srcRects : srcRects.slice(0, n);
    for (let k = 0; k < OUTLINE_OFFSETS.length; k++) {
      const offset = OUTLINE_OFFSETS[k] as readonly [number, number];
      fillXforms(commands, n, offset[0] * effect.width, offset[1] * effect.width);
      const dsts = xforms.length === n ? xforms : xforms.slice(0, n);
      canvas.drawAtlas(image, srcs, dsts, paint);
    }
    paint.setAlphaf(1);
    // Main pass with original positions and the default (unfiltered) paint.
    defaultPaint.setAlphaf(alpha);
    fillXforms(commands, n, 0, 0);
    const mainDsts = xforms.length === n ? xforms : xforms.slice(0, n);
    canvas.drawAtlas(image, srcs, mainDsts, defaultPaint);
    defaultPaint.setAlphaf(1);
  }

  function resolveEffectPaint(effect: AnySpriteEffect): SkPaint {
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
      case 'outline':
        // Outline is drawn via a multi-pass path; this branch is only reached
        // if a caller bypasses `drawOutlined`. Return the outline paint so
        // the single-pass drawAtlas still renders something visible.
        return applyOutlinePaint(effect);
      default:
        return defaultPaint;
    }
  }

  return {
    canvas,

    beginFrame(viewportWidth: number, viewportHeight: number, time = 0): void {
      if (viewportWidth === 0 || viewportHeight === 0) return;
      currentFrameTime = time;
      currentViewportW = viewportWidth;
      currentViewportH = viewportHeight;
      recordingBounds.setXYWH(0, 0, viewportWidth, viewportHeight);
      current = recorder.beginRecording(recordingBounds);
    },

    drawAtlas(image, commands): void {
      if (current === null) return;
      const n = commands.length;
      if (n === 0) return;

      ensurePoolCapacity(n);
      fillSrcRects(commands, n);

      const effect = commands[0]?.effect;
      const alpha = commands[0]?.alpha ?? 1;
      const skImage = image as SkImage;

      if (effect?.type === 'outline') {
        drawOutlined(current, skImage, commands, n, effect, alpha);
        return;
      }

      fillXforms(commands, n, 0, 0);
      const srcs = srcRects.length === n ? srcRects : srcRects.slice(0, n);
      const dsts = xforms.length === n ? xforms : xforms.slice(0, n);
      const paint = effect === undefined ? defaultPaint : resolveEffectPaint(effect);
      paint.setAlphaf(alpha);
      current.drawAtlas(skImage, srcs, dsts, paint);
      paint.setAlphaf(1);
    },

    captureSceneSnapshot(width: number, height: number): SkImageLike | null {
      if (current === null) return null;
      if (Skia.MakeSurface === undefined) return null;

      // Resize (or create) the offscreen surface when the viewport changes.
      if (snapshotSurface === null || snapshotSurfaceW !== width || snapshotSurfaceH !== height) {
        snapshotSurface = Skia.MakeSurface(width, height);
        snapshotSurfaceW = width;
        snapshotSurfaceH = height;
      }
      if (snapshotSurface === null) return null;

      // Finish the current recording, render it to the offscreen surface,
      // then restart the recording so the frame can continue.
      current = null;
      const picture = recorder.finishRecordingAsPicture();
      const offscreenCanvas = snapshotSurface.getCanvas();
      offscreenCanvas.drawPicture(picture);
      const snapshot = snapshotSurface.makeImageSnapshot();

      // Restart the recording — frame continues after the snapshot.
      recordingBounds.setXYWH(0, 0, currentViewportW, currentViewportH);
      current = recorder.beginRecording(recordingBounds);
      // Replay the original picture so subsequent drawAtlas calls layer on top.
      current.drawPicture(picture);

      return snapshot;
    },

    applyPostFx(runtime, chain, source, width, height) {
      if (current === null || source === null || !runtime.supported) return;

      // Multi-pass ping-pong path — used when the runtime exposes buildPass +
      // applyPass and there are more than one enabled passes.
      if (
        runtime.buildPass !== undefined &&
        runtime.applyPass !== undefined &&
        Skia.MakeSurface !== undefined
      ) {
        const passes = runtime.buildPass(chain, width, height);
        if (passes.length > 1) {
          // Ensure ping-pong surfaces are allocated / resized.
          if (pingPingSurface === null || pingPongW !== width || pingPongH !== height) {
            pingPingSurface = Skia.MakeSurface(width, height);
            pingPongSurface = Skia.MakeSurface(width, height);
            pingPongW = width;
            pingPongH = height;
          }
          if (pingPingSurface === null || pingPongSurface === null) {
            // Surface allocation failed — fall through to single-pass apply.
            runtime.apply(current, chain, source, width, height);
            return;
          }

          let readSurface = pingPingSurface;
          let writeSurface = pingPongSurface;
          let readSource: unknown = source;

          for (let i = 0; i < passes.length; i++) {
            const pass = passes[i] as PostFxPassLike;
            const isLast = i === passes.length - 1;
            if (isLast) {
              // Final pass blits directly to the current recording canvas.
              runtime.applyPass(current, pass, readSource, width, height);
            } else {
              // Intermediate pass: write to the write surface, then swap.
              runtime.applyPass(writeSurface.getCanvas(), pass, readSource, width, height);
              readSource = writeSurface.makeImageSnapshot();
              const tmp = readSurface;
              readSurface = writeSurface;
              writeSurface = tmp;
            }
          }
          return;
        }
      }

      // Single-pass (or no buildPass): delegate unchanged.
      runtime.apply(current, chain, source, width, height);
    },

    endFrame(): SkPicture | null {
      if (current === null) return null;
      current = null;
      return recorder.finishRecordingAsPicture();
    },
  };
}

// Scratch buffer for ARGB → RGBA-float unpacking in renderShapesToImage.
// Allocated once per call (not module-level) so concurrent callers are safe.
// Hot paths inside createSkiaFrameRenderer use their own pre-allocated buffers.

/**
 * Render a list of solid rectangles into a fresh offscreen surface and return
 * the resulting image snapshot. Returns `null` if `MakeSurface` is absent or
 * fails. The surface is not cached — callers that need reuse should cache the
 * returned image themselves.
 */
export function renderShapesToImage(
  skia: SkiaModuleLike,
  opts: RenderShapesOpts,
): SkImageLike | null {
  if (skia.MakeSurface === undefined) return null;
  const surface = skia.MakeSurface(opts.width, opts.height);
  if (surface === null) return null;

  const scratch = new Float32Array(4);
  const canvas = surface.getCanvas();

  unpackArgb(scratch, opts.clearColor);
  canvas.clear(scratch);

  const paint = skia.Paint();
  for (const shape of opts.shapes) {
    unpackArgb(scratch, shape.color);
    paint.setColor(scratch);
    const rect = skia.XYWHRect(shape.x, shape.y, shape.w, shape.h);
    canvas.drawRect(rect, paint);
  }

  return surface.makeImageSnapshot();
}

/** Unpack a 0xAARRGGBB integer into a Float32Array [r, g, b, a] in 0..1 range. */
function unpackArgb(out: Float32Array, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}

function writeColor(out: SkColor, color: SpriteColor, alphaMul: number): void {
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
  // Row 0: R channel
  out[0] = inv + lr;
  out[1] = lg;
  out[2] = lb;
  out[3] = 0;
  out[4] = 0;
  // Row 1: G channel
  out[5] = lr;
  out[6] = inv + lg;
  out[7] = lb;
  out[8] = 0;
  out[9] = 0;
  // Row 2: B channel
  out[10] = lr;
  out[11] = lg;
  out[12] = inv + lb;
  out[13] = 0;
  out[14] = 0;
  // Row 3: A channel (pass-through) — written once at init and never
  // changes, but re-asserted here so callers don't need to trust the
  // constructor layout.
  out[15] = 0;
  out[16] = 0;
  out[17] = 0;
  out[18] = 1;
  out[19] = 0;
}

function fillCustomUniforms(
  effect: CustomShaderEffect,
  shader: SkRuntimeEffect,
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
