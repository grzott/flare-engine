import type { FxImage } from '../runtime/contracts';

declare const process: { env: { NODE_ENV?: string } } | undefined;

/**
 * Draws `el` at `pixelRatio` image pixels per layout pixel. Resolves `null` when it has nothing
 * to give; it may also throw or reject, which a capture treats the same way.
 */
export type WebRasterizer = (
  el: HTMLElement,
  pixelRatio: number,
) => Promise<HTMLCanvasElement | ImageBitmap | null>;

/**
 * How far a `modernScreenshotRasterizer` capture reaches beyond its element on every side, in
 * layout pixels (C36).
 */
export const CAPTURE_PADDING = 24;

let rasterizer: WebRasterizer | null = null;

// How far each padded rasterizer's result reaches beyond the element. One that is not here
// draws the element's own box.
const paddings = new WeakMap<WebRasterizer, number>();

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
  warned.add(key);
  console.warn(message);
}

/**
 * Set what captures an element for a snapshot effect on the web, or `null` for nothing. With
 * nothing set, snapshot presets play their live fallback.
 */
export function setWebRasterizer(r: WebRasterizer | null): void {
  rasterizer = r;
}

/**
 * A rasterizer over `modern-screenshot`, which is loaded here, on the first call:
 * `setWebRasterizer(await modernScreenshotRasterizer())`. It rejects when the package is not
 * installed.
 *
 * Its captures reach `CAPTURE_PADDING` layout pixels beyond the element on every side, so a
 * `box-shadow` is part of the image.
 */
export async function modernScreenshotRasterizer(): Promise<WebRasterizer> {
  const { domToCanvas } = await import('modern-screenshot');
  const rasterize: WebRasterizer = (el, pixelRatio) => {
    const rect = el.getBoundingClientRect();
    return domToCanvas(el, {
      scale: pixelRatio,
      width: rect.width + 2 * CAPTURE_PADDING,
      height: rect.height + 2 * CAPTURE_PADDING,
      style: { margin: `${CAPTURE_PADDING}px` },
    });
  };
  paddings.set(rasterize, CAPTURE_PADDING);
  return rasterize;
}

/** `source` redrawn at `width` by `height`, or `null` when no 2D canvas can be had. */
function downscale(
  source: HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * Capture `el` with the rasterizer `setWebRasterizer` was given. Resolves `null` when no capture
 * can be taken: no rasterizer is set, the element has no size, or the rasterizer failed. It never
 * rejects, and warns once in development for a missing or a failing rasterizer.
 *
 * The rasterizer is asked for the screen's pixel ratio, or for less when that would make the
 * capture longer than `maxPx` image pixels on its longer side. A result that is longer all the
 * same is redrawn at that size. `handle` is the canvas or bitmap, which CanvasKit uploads.
 */
export async function captureView(el: HTMLElement, maxPx: number): Promise<FxImage | null> {
  const rasterize = rasterizer;
  if (rasterize === null) {
    warnOnce(
      'none',
      'ui-fx: no web rasterizer is set, so snapshot effects play their live fallback. Call setWebRasterizer(await modernScreenshotRasterizer()).',
    );
    return null;
  }
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return null;

  const padding = paddings.get(rasterize) ?? 0;
  const longest = Math.max(rect.width, rect.height) + 2 * padding;
  const screenRatio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  const pixelRatio = Math.min(screenRatio, maxPx / longest);

  try {
    const source = await rasterize(el, pixelRatio);
    if (source === null || !(source.width > 0 && source.height > 0)) return null;
    const drawn = Math.max(source.width, source.height);
    if (drawn <= maxPx) {
      return { width: source.width, height: source.height, pixelRatio, padding, handle: source };
    }

    const scale = maxPx / drawn;
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const scaled = downscale(source, width, height);
    if (scaled === null) return null;
    return { width, height, pixelRatio: pixelRatio * scale, padding, handle: scaled };
  } catch (error) {
    // A tainted canvas, as from a cross-origin image without CORS, throws `SecurityError`.
    warnOnce(
      'failed',
      `ui-fx: the web rasterizer failed, so snapshot effects play their live fallback. ${String(error)}`,
    );
    return null;
  }
}
