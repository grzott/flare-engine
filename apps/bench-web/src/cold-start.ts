import { loadCanvasKit } from '@flare-engine/render-web';

declare global {
  interface Window {
    /** Set once the page has produced its first rendered frame (or failed). */
    __COLDSTART_DONE__?: boolean;
    /** `performance.now()` at the first completed raster — already relative to the page's time
     *  origin, i.e. navigation start. */
    __COLDSTART_MS__?: number;
    __COLDSTART_ERROR__?: string;
  }
}

/**
 * Measures navigation start to the first rendered frame.
 *
 * There is no on-screen `<canvas>` on this page — like the render suite (see `src/runner.ts`),
 * it draws to an off-screen CPU-raster `CanvasKit.MakeSurface` only — so the browser's own
 * paint/composite timings (First Contentful Paint, etc.) do not apply here; nothing is ever
 * painted to the visible page. "First completed composite()" is instead the first
 * `surface.flush()` that follows a real draw call: the earliest point at which CanvasKit has
 * produced actual pixel output after loading, which is the composite analogue this
 * CPU-raster-only architecture actually has.
 */
async function main(): Promise<void> {
  const kit = await loadCanvasKit('/canvaskit.wasm');
  const surface = kit.MakeSurface(64, 64);
  if (surface === null) {
    throw new Error('bench-web cold-start: CanvasKit.MakeSurface(64, 64) returned null');
  }
  const canvas = surface.getCanvas();
  canvas.clear(kit.Color4f(0.2, 0.4, 0.8, 1));
  const paint = new kit.Paint();
  canvas.drawRect(kit.XYWHRect(8, 8, 32, 32), paint);
  surface.flush();
  window.__COLDSTART_MS__ = performance.now();
  window.__COLDSTART_DONE__ = true;
  paint.delete();
  surface.delete();
}

main().catch((err: unknown) => {
  window.__COLDSTART_ERROR__ =
    err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  window.__COLDSTART_DONE__ = true;
});
