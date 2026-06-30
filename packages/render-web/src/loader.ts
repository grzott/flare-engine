import type { CanvasKit } from 'canvaskit-wasm';

type CanvasKitInitFn = (opts: {
  locateFile: (file: string) => string;
  wasmBinary?: Uint8Array;
}) => Promise<CanvasKit>;

let pending: Promise<CanvasKit> | null = null;

/**
 * Load CanvasKit exactly once. Subsequent calls return the same promise.
 *
 * @param wasmUrl  Absolute URL or filesystem path to canvaskit.wasm.
 * @param onProgress  Optional callback receiving download fraction [0,1].
 */
export function loadCanvasKit(
  wasmUrl: string,
  onProgress?: (fraction: number) => void,
): Promise<CanvasKit> {
  if (pending !== null) {
    onProgress?.(1);
    return pending;
  }
  pending = init(wasmUrl, onProgress);
  return pending;
}

async function init(wasmUrl: string, onProgress?: (fraction: number) => void): Promise<CanvasKit> {
  const mod = (await import('canvaskit-wasm/bin/full/canvaskit.js')) as {
    default: CanvasKitInitFn;
  };
  try {
    const wasmBinary = await fetchWithProgress(wasmUrl, onProgress);
    onProgress?.(1);
    return await mod.default({ locateFile: () => wasmUrl, wasmBinary });
  } catch {
    onProgress?.(1);
    return mod.default({ locateFile: () => wasmUrl });
  }
}

async function fetchWithProgress(
  url: string,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  if (typeof fetch === 'undefined') {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(url);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) return new Uint8Array(await res.arrayBuffer());

  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) onProgress?.(Math.min(1, loaded / total));
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
