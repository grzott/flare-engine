import type { SkImageLike } from '@flare-engine/assets';
import {
  type FrameRenderer,
  type FrameRendererCompiledPass,
  type FrameRendererModule,
  type FrameRendererPostFxChain,
  type FrameRendererPostFxDescriptor,
  type FrameRendererPostFxRuntime,
  type SpriteDrawCommand,
  createFrameRenderer,
} from '@flare-engine/render';
import type { SkColor, SkImage, SkImageFilter, SkRuntimeEffect } from '@shopify/react-native-skia';

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
  /** Force queued draws to execute. Required for GPU-backed surfaces before
   *  makeImageSnapshot is called, otherwise the snapshot may capture
   *  uninitialized texture content. See Skia's SkSurface.flush docs. */
  flush(): void;
}

/**
 * A single post-processing pass descriptor built by `buildPostFxPasses`.
 * GameView maps each descriptor to a `<RuntimeShader>` child of `<Image>`.
 */
export interface PostFxPassDescriptor {
  /** Stable id, used as React key. */
  readonly id: string;
  /** The compiled SkRuntimeEffect passed as `<RuntimeShader source={…}/>`. */
  readonly source: SkRuntimeEffect;
  /**
   * Uniform map keyed by SkSL uniform name. Vector uniforms are `number[]`
   * whose length equals `columns * rows`; scalar uniforms are `number`.
   * Built by zipping `shader.getUniformName(i)` → sliced Float32Array values.
   */
  readonly uniforms: Record<string, number | readonly number[]>;
  /**
   * Extra child shader slots beyond the implicit scene sampler. Empty for every
   * built-in PT effect; only color-grading-lut would populate it. Each entry
   * is an SkImage that GameView wraps in `<ImageShader>`.
   */
  readonly children: readonly SkImage[];
}

/**
 * Take a snapshot of `surface` and detach it from the GPU context so it can
 * be safely sampled from a different GrDirectContext (e.g. the on-screen
 * Canvas).  RN-Skia's MakeOffscreen allocates a private Gr context per
 * surface; without this step Skia silently renders black when the texture is
 * read from any other context.
 *
 * Calls `makeNonTextureImage()` when available (RN-Skia ≥ 0.1 on device).
 * Falls back to the raw snapshot when the method is absent (CPU surfaces,
 * test mocks) — no behavioural change in those paths.
 */
function detachSnapshot(surface: SkSurfaceLike): SkImageLike {
  const snap = surface.makeImageSnapshot();
  if (typeof snap.makeNonTextureImage === 'function') {
    return snap.makeNonTextureImage();
  }
  return snap;
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
 *
 * Extends `FrameRendererModule` from `@flare-engine/render` with the
 * native Surface and ImageFilter that are not needed in render-web.
 */
export type SkiaModuleLike = FrameRendererModule & {
  RuntimeEffect?: { Make(sksl: string): SkRuntimeEffect | null };
  Surface?: {
    Make(width: number, height: number): SkSurfaceLike | null;
    MakeOffscreen?(width: number, height: number): SkSurfaceLike | null;
  };
  /** Optional — present on device builds; absent in CPU/test mocks (drop-shadow falls back to the default paint). */
  ImageFilter?: {
    MakeDropShadow(
      dx: number,
      dy: number,
      sigmaX: number,
      sigmaY: number,
      color: SkColor,
      input: SkImageFilter | null,
    ): SkImageFilter;
  };
};

/**
 * A single compiled postfx pass descriptor produced by the runtime.
 * Re-exported from render's FrameRendererCompiledPass for consumer compatibility.
 */
export type CompiledPassLike = FrameRendererCompiledPass;

/**
 * Minimal structural view of a PostFxRuntime that the bridge needs.
 * Re-exported from render's FrameRendererPostFxRuntime for consumer compatibility.
 */
export type PostFxRuntimeLike = FrameRendererPostFxRuntime;

/** Minimal structural view of an EffectChain the bridge needs. */
export type PostFxChainLike = FrameRendererPostFxChain;

/**
 * Frame renderer that bridges a `SpriteBatch` to a Skia `<Picture>`.
 * The implementation lives in `@flare-engine/render` (`createFrameRenderer`);
 * this interface narrows the return type for native-Skia consumers.
 */
export type SkiaFrameRenderer = FrameRenderer;

/**
 * Create a `SkiaFrameRenderer`.
 *
 * `Skia` is passed in (rather than imported) so unit tests can supply a
 * mock. Production code constructs this once inside `<GameView>` using the
 * real `Skia` import from `@shopify/react-native-skia`.
 *
 * Delegates to `createFrameRenderer` from `@flare-engine/render` — the
 * frame-renderer body is backend-neutral and shared with render-web.
 */
export function createSkiaFrameRenderer(Skia: SkiaModuleLike): SkiaFrameRenderer {
  return createFrameRenderer(Skia);
}

// Scratch buffer for ARGB → RGBA-float unpacking in renderShapesToImage.
// Allocated once per call (not module-level) so concurrent callers are safe.
// Hot paths inside createSkiaFrameRenderer use their own pre-allocated buffers.

/**
 * Render a list of solid rectangles into a fresh offscreen surface and return
 * the resulting image snapshot. Returns `null` if `Surface` factory is absent or
 * fails. The surface is not cached — callers that need reuse should cache the
 * returned image themselves.
 */
export function renderShapesToImage(
  skia: SkiaModuleLike,
  opts: RenderShapesOpts,
): SkImageLike | null {
  if (skia.Surface === undefined) return null;
  const surface = skia.Surface.Make(opts.width, opts.height);
  if (surface === null) return null;

  const scratch = new Float32Array(4);
  const canvas = surface.getCanvas();

  unpackArgb(scratch, opts.clearColor);
  canvas.clear(scratch);

  const paint = skia.Paint();
  for (const shape of opts.shapes) {
    unpackArgb(scratch, shape.color);
    if (paint.setColor) paint.setColor(scratch);
    const rect = skia.XYWHRect(shape.x, shape.y, shape.w, shape.h);
    canvas.drawRect(rect, paint);
  }

  return detachSnapshot(surface);
}

/** Unpack a 0xAARRGGBB integer into a Float32Array [r, g, b, a] in 0..1 range. */
function unpackArgb(out: Float32Array, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}

// Re-export the PostFxPassDescriptor shape for GameView consumers.
// The type is defined above in this file so it carries the concrete SkRuntimeEffect/SkImage
// types that GameView needs — unlike the generic FrameRendererPostFxDescriptor from render.
export type { FrameRendererPostFxDescriptor };
// Alias for clarity at call-sites.
export type { SpriteDrawCommand };
