import { loadCanvasKit } from '@flare-engine/render-web';
import type { CanvasKit } from 'canvaskit-wasm';

/** `globalThis.CanvasKit` when it is a loaded CanvasKit, as RN-Skia's `LoadSkiaWeb` leaves it. */
function globalCanvasKit(): CanvasKit | null {
  const kit: unknown = Reflect.get(globalThis, 'CanvasKit');
  if (typeof kit !== 'object' || kit === null) return null;
  if (!('MakeWebGLCanvasSurface' in kit) || typeof kit.MakeWebGLCanvasSurface !== 'function') {
    return null;
  }
  return kit as CanvasKit;
}

/**
 * The CanvasKit a web FX host draws with: `canvasKit` when given, else `globalThis.CanvasKit`,
 * else the one `loadCanvasKit(wasmUrl)` loads. A page therefore holds one copy.
 *
 * `wasmUrl` is the URL the app serves the full binary from,
 * `canvaskit-wasm/bin/full/canvaskit.wasm`. It rejects when there is nothing to load from, and
 * with whatever `loadCanvasKit` rejects with.
 */
export function resolveCanvasKit(o: {
  canvasKit?: CanvasKit;
  wasmUrl?: string;
}): Promise<CanvasKit> {
  if (o.canvasKit !== undefined) return Promise.resolve(o.canvasKit);
  const global = globalCanvasKit();
  if (global !== null) return Promise.resolve(global);
  if (o.wasmUrl === undefined) {
    return Promise.reject(
      new Error(
        'ui-fx: no CanvasKit to draw with. Give FlareFxHost a `canvasKit`, or the `wasmUrl` of canvaskit-wasm/bin/full/canvaskit.wasm.',
      ),
    );
  }
  return loadCanvasKit(o.wasmUrl);
}
