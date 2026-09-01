import type { SkImageLike } from '@flare-engine/assets';

/**
 * Structural offscreen surface — the subset `GameView`'s scene capture needs.
 * Declared locally so this module does not depend on RN-Skia's concrete types.
 */
export interface SceneSurfaceLike<TImage = SkImageLike> {
  getCanvas(): SceneSurfaceCanvasLike;
  makeImageSnapshot(): TImage;
  flush(): void;
}

/** The canvas subset used when capturing a frame's picture. */
export interface SceneSurfaceCanvasLike {
  drawPicture(picture: unknown): void;
}

/** Structural Skia module — only the offscreen-surface factory is needed. */
export interface SceneSurfaceModuleLike<TImage = SkImageLike> {
  Surface: {
    MakeOffscreen(width: number, height: number): SceneSurfaceLike<TImage> | null;
  };
}

/** A size-keyed offscreen surface holder. */
export interface SceneSurfaceCache<TImage = SkImageLike> {
  /**
   * The surface for this viewport size, allocating only when the size actually
   * changed. Returns null for a zero-sized viewport, or when Skia refuses the
   * allocation.
   */
  acquire(width: number, height: number): SceneSurfaceLike<TImage> | null;
  /** Release the live surface. Safe to call repeatedly. */
  dispose(): void;
}

/**
 * `Symbol.dispose` is not in this project's ES2022 lib, so the well-known
 * symbol is looked up at runtime instead of written as a computed key.
 */
const DISPOSE = (Symbol as unknown as { dispose?: symbol }).dispose;

function releaseSkiaObject(target: unknown): void {
  if (DISPOSE === undefined || target === null || target === undefined) return;
  const disposer = (target as Record<symbol, unknown>)[DISPOSE];
  if (typeof disposer === 'function') {
    (disposer as () => void).call(target);
  }
}

/**
 * Reuse one offscreen surface across frames instead of allocating per frame.
 *
 * On **web** this is a correctness requirement, not an optimisation. RN-Skia's
 * web `MakeOffscreen` builds a fresh `OffscreenCanvas` and a fresh WebGL
 * context on every call and releases neither; Chrome caps a page at 16 live
 * WebGL contexts and evicts the oldest, which is the on-screen `<Canvas>`.
 * A per-frame allocation therefore kills the visible canvas within ~16 frames
 * while the game loop keeps running — the app looks alive and paints nothing.
 * Measured and written up in docs/plans/web-target-2026-08.md §12.
 */
export function createSceneSurfaceCache<TImage>(
  Skia: SceneSurfaceModuleLike<TImage>,
): SceneSurfaceCache<TImage> {
  let surface: SceneSurfaceLike<TImage> | null = null;
  let currentWidth = 0;
  let currentHeight = 0;

  const dispose = (): void => {
    if (surface === null) return;
    releaseSkiaObject(surface);
    surface = null;
    currentWidth = 0;
    currentHeight = 0;
  };

  return {
    acquire(width: number, height: number): SceneSurfaceLike<TImage> | null {
      if (width <= 0 || height <= 0) return null;
      if (surface !== null && currentWidth === width && currentHeight === height) {
        return surface;
      }
      dispose();
      const next = Skia.Surface.MakeOffscreen(width, height);
      if (next === null) return null;
      surface = next;
      currentWidth = width;
      currentHeight = height;
      return surface;
    },
    dispose,
  };
}

/** A snapshot that can be detached from its GL context (RN-Skia web SkImage). */
interface DetachableImage<TImage> {
  makeNonTextureImage?(): TImage;
}

/** Per-frame scene capture over a reused surface. */
export interface SceneCapture<TImage> {
  /**
   * Draw `picture` into the reused surface and return an image detached from
   * that surface's GL context. Returns null for a zero-sized viewport.
   */
  capture(picture: unknown, width: number, height: number): TImage | null;
  /** Release the surface and the frame image still held. */
  dispose(): void;
}

/**
 * Options for `createSceneCapture`.
 *
 * `nonTextureImage` defaults to `true` (web semantics: call
 * `makeNonTextureImage()` to copy the snapshot off the surface's GL context so
 * the on-screen canvas can sample it).
 *
 * **This factory is web-only since XR-1c.** An earlier revision said the
 * snapshot "is a true copy on native", so `false` was safe there. That is
 * wrong: the native snapshot is GPU-backed and belongs to whichever context
 * created the surface. What actually makes it sampleable is building the
 * surface on the **UI thread**, which is a `runOnUI` worklet in
 * `game-view.tsx`, not a call into this module. Passing `false` here on native
 * yields a black frame; passing `true` fixes it only by forcing a per-frame
 * GPU→CPU readback. Verified on a Pixel 7 — external-review-2026-08.md §11.4b.
 *
 * `retentionDepth` defaults to 3 — the web-measured minimum, and the only
 * platform this runs on.
 */
export interface SceneCaptureOptions {
  nonTextureImage?: boolean;
  retentionDepth?: number;
}

/**
 * Capture the scene into a reused offscreen surface, releasing Skia objects as
 * it goes.
 *
 * Two leaks have to be avoided here, and both were measured in a browser
 * (docs/plans/web-target-2026-08.md §12):
 *
 * 1. **Per-frame surfaces.** RN-Skia's web `MakeOffscreen` builds an
 *    `OffscreenCanvas` + WebGL context per call and releases neither; Chrome
 *    caps a page at 16 live contexts and evicts the on-screen canvas. Hence the
 *    surface cache.
 * 2. **Per-frame images.** `makeNonTextureImage()` reads the whole viewport back
 *    into the wasm heap. Leaving old CPU images unreleased exhausts that heap.
 *    A single-slot release strategy is not enough: RN-Skia's web `<Canvas>`
 *    paints on its own rAF, which fires *after* the capture, so the image handed
 *    to React on frame N is still in use when frame N+1 runs. Releasing it
 *    immediately causes `BindingError: Cannot pass deleted object as a pointer of
 *    type Image const*` from `JsiSkImage.width` every frame and a blank canvas.
 *    Measured at 2560×1215 / Chrome (WEB-3):
 *      hold=1 (one slot — what shipped at WEB-2) → blank, BindingError every frame
 *      hold=2                                     → blank
 *      hold=3                                     → 1378 frames, zero errors
 *    A FIFO ring of depth 3 is the measured minimum.
 *
 * The snapshot is released as soon as it has been copied. Frame images are
 * released once the ring exceeds depth 3, ensuring the canvas's rAF always has
 * a live image to paint from.
 */

export function createSceneCapture<TImage>(
  Skia: SceneSurfaceModuleLike<TImage>,
  opts?: SceneCaptureOptions,
): SceneCapture<TImage> {
  const useNonTexture = opts?.nonTextureImage ?? true;
  const retentionDepth = opts?.retentionDepth ?? 3;
  const surfaces = createSceneSurfaceCache(Skia);
  const ring: TImage[] = [];

  return {
    capture(picture: unknown, width: number, height: number): TImage | null {
      const surface = surfaces.acquire(width, height);
      if (surface === null) return null;

      surface.getCanvas().drawPicture(picture);
      surface.flush();

      const snapshot = surface.makeImageSnapshot();
      const detachable = snapshot as DetachableImage<TImage>;
      const detached =
        useNonTexture && detachable.makeNonTextureImage
          ? detachable.makeNonTextureImage()
          : snapshot;

      if (detached !== snapshot) releaseSkiaObject(snapshot);
      ring.push(detached);
      if (ring.length > retentionDepth) {
        releaseSkiaObject(ring.shift()!);
      }
      return detached;
    },
    dispose(): void {
      for (const img of ring) {
        releaseSkiaObject(img);
      }
      ring.length = 0;
      surfaces.dispose();
    },
  };
}
