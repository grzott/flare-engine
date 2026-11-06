import type { FrameRendererCompiledPass } from '@flare-engine/render';
import { releaseSkiaObject } from './scene-texture.js';

/**
 * Imperative postfx compositor for the web scene capture: the blit
 * `@flare-engine/render-web`'s `createPostFxSurface` runs, retargeted at
 * RN-Skia's web wrappers (whose `makeShaderWithChildren` does work there).
 * Why the chain runs in place over the capture surface instead of as RN-Skia
 * shader nodes: scene-texture.ts and docs/plans/web-target-2026-08.md §14.
 */

// RN-Skia enum values: TileMode.Clamp, FilterMode.Linear, MipmapMode.None,
// BlendMode.Src (a full-surface replace, never a blend over the previous pass).
const TILE_CLAMP = 0;
const FILTER_LINEAR = 1;
const MIPMAP_NONE = 0;
const BLEND_SRC = 1;

/** The paint subset the compositor drives. */
export interface WebPostFxPaintLike {
  setShader(shader: unknown): void;
  setBlendMode(mode: number): void;
}

/** An image that can be wrapped as a sampler child (RN-Skia web `SkImage`). */
export interface WebPostFxImageLike {
  makeShaderOptions(tx: number, ty: number, fm: number, mm: number): unknown;
}

/** The canvas subset the compositor draws with. */
export interface WebPostFxCanvasLike {
  drawRect(rect: { x: number; y: number; width: number; height: number }, paint: unknown): void;
}

/** The surface subset the compositor runs over — satisfied by `SceneSurfaceLike`. */
export interface WebPostFxSurfaceLike<TImage = WebPostFxImageLike> {
  getCanvas(): WebPostFxCanvasLike;
  makeImageSnapshot(): TImage;
  flush(): void;
}

/** Structural Skia module — only the paint factory is needed. */
export interface WebPostFxModuleLike {
  Paint(): WebPostFxPaintLike;
}

/** Runs compiled postfx passes in place over an offscreen surface. */
export interface WebPostFxCompositor<TImage = WebPostFxImageLike> {
  /**
   * Run `passes` in place over `surface`'s current contents; each pass samples
   * a snapshot of the previous result. No-op when `passes` is empty.
   */
  composite(
    surface: WebPostFxSurfaceLike<TImage>,
    passes: readonly FrameRendererCompiledPass[],
    width: number,
    height: number,
  ): void;
  /** Release the paint. */
  dispose(): void;
}

/**
 * Create a compositor over `Skia.Paint()`. The paint, the full-surface rect and
 * the shader-children array are allocated once and reused, so a frame allocates
 * nothing here beyond the Skia objects each pass creates and releases.
 */
export function createWebPostFxCompositor<TImage extends WebPostFxImageLike>(
  Skia: WebPostFxModuleLike,
): WebPostFxCompositor<TImage> {
  const paint = Skia.Paint();
  paint.setBlendMode(BLEND_SRC);
  const rect = { x: 0, y: 0, width: 0, height: 0 };
  const childrenBuf: unknown[] = [null];
  const wrap = (img: WebPostFxImageLike): unknown =>
    img.makeShaderOptions(TILE_CLAMP, TILE_CLAMP, FILTER_LINEAR, MIPMAP_NONE);

  return {
    composite(surface, passes, width, height): void {
      if (passes.length === 0) return;
      rect.width = width;
      rect.height = height;
      const canvas = surface.getCanvas();
      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];
        if (pass === undefined) continue;
        const snapshot = surface.makeImageSnapshot();
        // src is child 0; pass.children (which excludes src — e.g. the LUT
        // image) follow in SkSL declaration order. Slots are nulled after the
        // pass so a LUT child cannot leak into a later pass.
        const childCount = 1 + pass.children.length;
        childrenBuf.length = childCount;
        childrenBuf[0] = wrap(snapshot);
        for (let c = 0; c < pass.children.length; c++) {
          const child = pass.children[c] as WebPostFxImageLike | null | undefined;
          if (child !== null && child !== undefined) childrenBuf[c + 1] = wrap(child);
        }
        const shader = pass.shader.makeShaderWithChildren(pass.uniforms, childrenBuf);
        if (shader !== null && shader !== undefined) {
          paint.setShader(shader);
          canvas.drawRect(rect, paint);
          paint.setShader(null);
        }
        surface.flush();
        // The pass.children images themselves are caller-owned and stay alive.
        releaseSkiaObject(shader);
        for (let c = 0; c < childCount; c++) {
          releaseSkiaObject(childrenBuf[c]);
          childrenBuf[c] = null;
        }
        releaseSkiaObject(snapshot);
      }
    },
    dispose(): void {
      releaseSkiaObject(paint);
    },
  };
}
