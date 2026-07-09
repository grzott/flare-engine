import { type FrameRenderer, createFrameRenderer } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from './web-skia-module.js';

/**
 * Create a `FrameRenderer` backed by CanvasKit (web/WASM).
 *
 * The web analog of `createSkiaFrameRenderer` from `@flare-engine/react`:
 * delegates to `createFrameRenderer(createWebSkiaModule(kit))` so the
 * frame-renderer body is backend-neutral and shared with native.
 *
 * Presentation (drawing the `endFrame()` picture onto a surface and flushing)
 * is the consumer's responsibility — use `createWebSurface` or
 * `createPostFxSurface` for that step.
 */
export function createWebFrameRenderer(kit: CanvasKit): FrameRenderer {
  return createFrameRenderer(createWebSkiaModule(kit));
}
