import type { SkImageLike } from '@flare-engine/assets';
import {
  type AnySpriteEffect,
  type CanvasLike,
  type CustomShaderEffect,
  type FlashEffect,
  type GrayscaleEffect,
  type OutlineEffect,
  type SpriteColor,
  type SpriteDrawCommand,
  type TintEffect,
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

/**
 * Narrow view of the Skia module — only the factories the bridge needs.
 * Declared as its own type so tests can pass a plain mock without pulling
 * in the full `@shopify/react-native-skia` surface.
 */
export type SkiaModuleLike = Pick<
  typeof Skia,
  'XYWHRect' | 'RSXform' | 'Paint' | 'PictureRecorder' | 'ColorFilter'
>;

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
  beginFrame(viewportWidth: number, viewportHeight: number): void;
  /**
   * drawAtlas callback compatible with `SpriteBatch.flush`. Accepts
   * `SkImageLike` (the narrow `@flare-engine/assets` type used by the batch) and
   * upcasts to a full Skia `SkImage` at the boundary — in practice callers
   * always supply a real `SkImage`.
   */
  drawAtlas(image: SkImageLike, commands: SpriteDrawCommand[]): void;
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

  let current: SkCanvas | null = null;

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

  function drawOutlined(
    canvas: SkCanvas,
    image: SkImage,
    commands: SpriteDrawCommand[],
    n: number,
    effect: OutlineEffect,
  ): void {
    const paint = applyOutlinePaint(effect);
    const srcs = srcRects.length === n ? srcRects : srcRects.slice(0, n);
    for (let k = 0; k < OUTLINE_OFFSETS.length; k++) {
      const offset = OUTLINE_OFFSETS[k] as readonly [number, number];
      fillXforms(commands, n, offset[0] * effect.width, offset[1] * effect.width);
      const dsts = xforms.length === n ? xforms : xforms.slice(0, n);
      canvas.drawAtlas(image, srcs, dsts, paint);
    }
    // Main pass with original positions and the default (unfiltered) paint.
    fillXforms(commands, n, 0, 0);
    const mainDsts = xforms.length === n ? xforms : xforms.slice(0, n);
    canvas.drawAtlas(image, srcs, mainDsts, defaultPaint);
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
      case 'outline':
        // Outline is drawn via a multi-pass path; this branch is only reached
        // if a caller bypasses `drawOutlined`. Return the outline paint so
        // the single-pass drawAtlas still renders something visible.
        return applyOutlinePaint(effect);
    }
  }

  return {
    canvas,

    beginFrame(viewportWidth: number, viewportHeight: number): void {
      if (viewportWidth === 0 || viewportHeight === 0) return;
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
      const skImage = image as SkImage;

      if (effect?.type === 'outline') {
        drawOutlined(current, skImage, commands, n, effect);
        return;
      }

      fillXforms(commands, n, 0, 0);
      const srcs = srcRects.length === n ? srcRects : srcRects.slice(0, n);
      const dsts = xforms.length === n ? xforms : xforms.slice(0, n);
      const paint = effect === undefined ? defaultPaint : resolveEffectPaint(effect);
      current.drawAtlas(skImage, srcs, dsts, paint);
    },

    endFrame(): SkPicture | null {
      if (current === null) return null;
      current = null;
      return recorder.finishRecordingAsPicture();
    },
  };
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
