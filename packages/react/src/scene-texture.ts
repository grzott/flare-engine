import type { SkImageLike } from '@flare-engine/assets';
import { useCallback, useEffect, useRef, useState } from 'react';

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

const RETENTION_DEPTH = 3;

export function createSceneCapture<TImage>(
  Skia: SceneSurfaceModuleLike<TImage>,
): SceneCapture<TImage> {
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
      const detached = detachable.makeNonTextureImage ? detachable.makeNonTextureImage() : snapshot;

      if (detached !== snapshot) releaseSkiaObject(snapshot);
      ring.push(detached);
      if (ring.length > RETENTION_DEPTH) {
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

/**
 * Returned by `useWebSceneTexture`. `image` is the latest captured frame (null
 * until the first capture). `capture` is the imperative callback `GameView`'s
 * frame callback invokes directly each frame.
 */
export interface WebSceneTexture<TImage> {
  image: TImage | null;
  capture(picture: unknown, width: number, height: number): void;
}

/**
 * Web scene texture (imperative form): expose a `capture` callback that
 * `GameView`'s `onPreRender` frame callback invokes directly instead of pushing
 * a picture through React state.
 *
 * The previous reactive form called `setImage` from a `useEffect` keyed on
 * `[Skia, picture, width, height]`. `onPreRender` would call `setPicture`,
 * React would re-render, the effect would re-run, `setImage` would re-render
 * again. That is a setState-in-a-passive-effect cascade; React's
 * NESTED_PASSIVE_UPDATE_LIMIT (50) trips and logs `Maximum update depth
 * exceeded` on every web load. It also costs two React renders per frame and
 * delays the captured image by two hops.
 *
 * `GameLoop` schedules via `requestAnimationFrame`, so calling `setImage`
 * directly from `onPreRender` is an ordinary root update that never touches the
 * passive-update counter. Both hooks still run on both platforms so hook order
 * never varies, but this hook is now inert on native simply because nothing
 * calls `capture` on that platform.
 *
 * `makeNonTextureImage()` is required regardless of reuse: the offscreen surface
 * has its own WebGL context, and a texture-backed image cannot be sampled by the
 * on-screen canvas's context. It also makes reuse safe — the snapshot is copied
 * off the GPU so next frame's draw into the same surface cannot disturb the image
 * React still holds.
 *
 * The surface is never cleared here: `Renderer.begin()` records
 * `canvas.clear(clearColor)` into the picture itself (packages/render
 * `renderer.ts:75`), so replaying the picture repaints the full surface.
 */
export function useWebSceneTexture<TImage>(
  Skia: SceneSurfaceModuleLike<TImage>,
): WebSceneTexture<TImage> {
  const captureRef = useRef<SceneCapture<TImage> | null>(null);
  const [image, setImage] = useState<TImage | null>(null);

  useEffect(() => {
    return () => {
      captureRef.current?.dispose();
      captureRef.current = null;
    };
  }, []);

  const capture = useCallback(
    (picture: unknown, width: number, height: number): void => {
      if (picture === null || picture === undefined) return;
      if (captureRef.current === null) {
        captureRef.current = createSceneCapture(Skia);
      }
      const next = captureRef.current.capture(picture, width, height);
      if (next !== null) setImage(next);
    },
    [Skia],
  );

  return { image, capture };
}
