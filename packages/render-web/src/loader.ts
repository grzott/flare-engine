import type { CanvasKit } from 'canvaskit-wasm';

type CanvasKitInitFn = (opts: {
  locateFile: (file: string) => string;
  wasmBinary?: Uint8Array;
}) => Promise<CanvasKit>;

/** Tuning for the load's failure bounds. Defaults suit a browser on a slow connection. */
export interface LoadCanvasKitOptions {
  /** Abort the stream if no bytes arrive for this long. Default 15000. */
  stallMs?: number;
  /** Hard ceiling on the whole load. Default 45000. */
  deadlineMs?: number;
}

const DEFAULT_STALL_MS = 15_000;
const DEFAULT_DEADLINE_MS = 45_000;

let pending: Promise<CanvasKit> | null = null;

/**
 * Load CanvasKit exactly once. Subsequent calls return the same promise.
 *
 * A rejected load is NOT cached — a transient failure would otherwise strand every later caller
 * on the same rejection for the module's lifetime.
 *
 * @param wasmUrl  Absolute URL or filesystem path to canvaskit.wasm.
 * @param onProgress  Optional callback receiving download fraction [0,1].
 * @param options  Stall and deadline bounds.
 */
export function loadCanvasKit(
  wasmUrl: string,
  onProgress?: (fraction: number) => void,
  options: LoadCanvasKitOptions = {},
): Promise<CanvasKit> {
  if (pending !== null) {
    onProgress?.(1);
    return pending;
  }
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  pending = withDeadline(init(wasmUrl, onProgress, options), deadlineMs).catch((err: unknown) => {
    pending = null;
    throw err;
  });
  return pending;
}

// Rejecting unblocks the host even though the underlying work is not cancellable.
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CanvasKit load exceeded ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function init(
  wasmUrl: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: LoadCanvasKitOptions,
): Promise<CanvasKit> {
  const mod = (await import('canvaskit-wasm/bin/full/canvaskit.js')) as {
    default: CanvasKitInitFn;
  };
  try {
    const wasmBinary = await fetchWithProgress(wasmUrl, onProgress, options);
    onProgress?.(1);
    return await mod.default({ locateFile: () => wasmUrl, wasmBinary });
  } catch {
    onProgress?.(1);
    return mod.default({ locateFile: () => wasmUrl });
  }
}

async function fetchWithProgress(
  url: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: LoadCanvasKitOptions,
): Promise<Uint8Array> {
  if (typeof fetch === 'undefined') {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(url);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  const stallMs = options.stallMs ?? DEFAULT_STALL_MS;
  const controller = new AbortController();
  let stall: ReturnType<typeof setTimeout> | undefined;
  const armStall = (): void => {
    if (stall) clearTimeout(stall);
    stall = setTimeout(() => controller.abort(), stallMs);
  };

  try {
    armStall();
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) return new Uint8Array(await res.arrayBuffer());

    const total = Number(res.headers.get('Content-Length')) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      armStall();
      chunks.push(value);
      loaded += value.length;
      // Unknown length (missing or compressed Content-Length) → a smooth creep toward ~0.9 so the
      // bar never sits at 0 and then jumps straight to 100%.
      onProgress?.(
        total > 0 ? Math.min(1, loaded / total) : 0.9 * (1 - Math.exp(-loaded / 3_000_000)),
      );
    }

    const out = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } finally {
    if (stall) clearTimeout(stall);
  }
}
