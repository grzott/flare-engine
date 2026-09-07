import type { CanvasLike } from '@flare-engine/render';
import type { CanvasKit, Canvas as CKCanvas, Surface } from 'canvaskit-wasm';

/**
 * A WebGL-backed CanvasKit surface for one `<canvas>` element.
 *
 * `canvas` is the `CanvasLike` view for `Renderer.setCanvas()`; `ckCanvas` is
 * the same on-screen canvas as CanvasKit sees it, for presenting a frame
 * picture with `drawPicture`. Nothing appears on screen until `flush()`.
 */
export interface WebSurface {
  /** `CanvasLike` view of the on-screen canvas — pass to `Renderer.setCanvas()`. */
  readonly canvas: CanvasLike;
  /** The same on-screen canvas as CanvasKit's `Canvas`, for `drawPicture` and other CK draws. */
  readonly ckCanvas: CKCanvas;
  /** Present everything drawn since the last flush. */
  flush(): void;
  /** Free the GPU surface. `flush()` becomes a no-op; the canvases must not be used afterwards. */
  dispose(): void;
}

// Pre-allocated scratch buffer for unpacking packed-ARGB → Float32Array [r,g,b,a].
const clearScratch = new Float32Array(4);

/** Unpack a 0xAARRGGBB integer into a Float32Array [r, g, b, a] in [0, 1]. */
function unpackArgb(out: Float32Array, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}

/**
 * Create a `WebSurface` for the given `<canvas>` element.
 *
 * Returns `null` when WebGL is unavailable (e.g. headless test environments).
 * Callers should fall back to a CPU surface in that case.
 */
export function createWebSurface(kit: CanvasKit, canvas: HTMLCanvasElement): WebSurface | null {
  let surface: Surface | null = kit.MakeWebGLCanvasSurface(canvas);
  if (!surface) return null;
  const ck = surface.getCanvas();
  return {
    canvas: {
      save: () => ck.save(),
      restore: () => ck.restore(),
      translate: (x, y) => ck.translate(x, y),
      scale: (sx, sy) => ck.scale(sx, sy),
      // CanvasLike.rotate is degrees (contract); CanvasKit Canvas.rotate takes degrees — pass-through.
      rotate: (degrees, cx, cy) => ck.rotate(degrees, cx, cy),
      clear: (color) => {
        unpackArgb(clearScratch, color);
        ck.clear(clearScratch);
      },
    },
    ckCanvas: ck,
    flush() {
      surface?.flush();
    },
    dispose() {
      surface?.delete();
      surface = null;
    },
  };
}
