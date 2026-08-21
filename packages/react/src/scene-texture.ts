import type { SkImageLike } from '@flare-engine/assets';
import { useEffect, useRef, useState } from 'react';

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
 *    into the wasm heap. Leaving the GPU snapshot and the previous CPU image
 *    unreleased exhausts that heap and CanvasKit throws `Aborted()` — measured
 *    at frame 566 of a 1280x720 run. Releasing both survives 1500 frames at
 *    2560x1215.
 *
 * The snapshot is released as soon as it has been copied. The frame image is
 * released one capture later, never immediately: the caller has just handed it
 * to React, and it must stay alive until the frame that replaces it has been
 * rendered.
 */
export function createSceneCapture<TImage>(
  Skia: SceneSurfaceModuleLike<TImage>,
): SceneCapture<TImage> {
  const surfaces = createSceneSurfaceCache(Skia);
  let held: TImage | null = null;

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
      if (held !== null) releaseSkiaObject(held);
      held = detached;
      return detached;
    },
    dispose(): void {
      if (held !== null) {
        releaseSkiaObject(held);
        held = null;
      }
      surfaces.dispose();
    },
  };
}

/**
 * Web scene texture: capture `picture` into a **reused** offscreen surface and
 * return an image detached from that surface's GL context.
 *
 * `makeNonTextureImage()` is what makes reuse safe — it copies the snapshot off
 * the GPU, so next frame's draw into the same surface cannot disturb the image
 * React still holds. It is also required regardless of reuse: the offscreen
 * surface has its own WebGL context, and a texture-backed image cannot be
 * sampled by the on-screen canvas's context.
 *
 * Pass `picture: null` to make this hook inert — that is how `GameView` keeps
 * hook order identical on native while paying none of this cost.
 *
 * The surface is never cleared here: `Renderer.begin()` records
 * `canvas.clear(clearColor)` into the picture itself (packages/render
 * `renderer.ts:75`), so replaying the picture repaints the full surface.
 */
export function useWebSceneTexture<TImage>(
  Skia: SceneSurfaceModuleLike<TImage>,
  picture: unknown,
  width: number,
  height: number,
): TImage | null {
  const captureRef = useRef<SceneCapture<TImage> | null>(null);
  const [image, setImage] = useState<TImage | null>(null);

  useEffect(() => {
    return () => {
      captureRef.current?.dispose();
      captureRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (picture === null || picture === undefined) return;

    let capture = captureRef.current;
    if (capture === null) {
      capture = createSceneCapture(Skia);
      captureRef.current = capture;
    }

    const next = capture.capture(picture, width, height);
    if (next !== null) setImage(next);
  }, [Skia, picture, width, height]);

  return image;
}
