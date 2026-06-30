import type { CanvasLike } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';

/**
 * Create a `CanvasLike` that draws into a WebGL-backed CanvasKit surface
 * for the given `<canvas>` element.
 *
 * Returns `null` when WebGL is unavailable (e.g. headless test environments).
 * Callers should fall back to a CPU surface in that case.
 *
 * The returned object satisfies `CanvasLike` so it can be passed directly
 * to `Renderer.setCanvas()` and `createFrameRenderer()`.
 *
 * Note: the underlying `SkCanvas` returned by `getCanvas()` is owned by the
 * surface. The surface is not exposed here; the caller should call
 * `surface.flush()` / `surface.delete()` via the `PostFxSurface` wrapper.
 */

// Pre-allocated scratch buffer for unpacking packed-ARGB → Float32Array [r,g,b,a].
const clearScratch = new Float32Array(4);

/** Unpack a 0xAARRGGBB integer into a Float32Array [r, g, b, a] in [0, 1]. */
function unpackArgb(out: Float32Array, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}

export function createWebSurface(kit: CanvasKit, canvas: HTMLCanvasElement): CanvasLike | null {
  const surface = kit.MakeWebGLCanvasSurface(canvas);
  if (!surface) return null;
  const ck = surface.getCanvas();
  return {
    save: () => ck.save(),
    restore: () => ck.restore(),
    translate: (x, y) => ck.translate(x, y),
    scale: (sx, sy) => ck.scale(sx, sy),
    // Forwarded verbatim to match the native bridge (no radians→degrees conversion).
    // Both RN-Skia and CanvasKit Canvas.rotate take degrees; the engine labels the
    // param "radians" — a pre-existing dormant mismatch tracked for a cross-backend fix.
    rotate: (radians, cx, cy) => ck.rotate(radians, cx, cy),
    clear: (color) => {
      unpackArgb(clearScratch, color);
      ck.clear(clearScratch);
    },
  };
}
