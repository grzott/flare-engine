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
let pendingUrl: string | null = null;

/**
 * Load CanvasKit exactly once. A later call with the same `wasmUrl` returns the same promise.
 *
 * A later call with a different `wasmUrl`, while a load is in flight or has succeeded, returns a
 * promise that rejects with an `Error` naming both URLs: one page holds one CanvasKit, and the
 * call would otherwise silently get the kit loaded from the first URL. The URLs are compared by
 * exact string equality, so two spellings of one address count as different. The first load is
 * unaffected.
 *
 * A rejected load is NOT cached — a transient failure would otherwise strand every later caller
 * on the same rejection for the module's lifetime. After a failed load any `wasmUrl` is accepted.
 *
 * A rejection that is not an `Error` is wrapped in one that names the likely cause, a wasm that
 * does not match the full glue, with the original value as `cause`.
 *
 * @param wasmUrl  Absolute URL or filesystem path to the full binary,
 *   `canvaskit-wasm/bin/full/canvaskit.wasm`. The non-full `bin/canvaskit.wasm` does not load.
 * @param onProgress  Optional callback receiving download fraction [0,1].
 * @param options  Stall and deadline bounds.
 */
export function loadCanvasKit(
  wasmUrl: string,
  onProgress?: (fraction: number) => void,
  options: LoadCanvasKitOptions = {},
): Promise<CanvasKit> {
  if (pending !== null) {
    if (wasmUrl !== pendingUrl) {
      return Promise.reject(
        new Error(
          `loadCanvasKit: CanvasKit is already loaded or loading from "${pendingUrl}"; cannot load it again from "${wasmUrl}"`,
        ),
      );
    }
    onProgress?.(1);
    return pending;
  }
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  pendingUrl = wasmUrl;
  pending = withDeadline(init(wasmUrl, onProgress, options), deadlineMs).catch((err: unknown) => {
    pending = null;
    pendingUrl = null;
    // The full glue rejects with a bare value (seen: `Infinity`) when the wasm it was handed is
    // not the full build.
    if (err instanceof Error) throw err;
    throw new Error(
      'CanvasKit init failed: the served canvaskit.wasm likely does not match the full glue; serve canvaskit-wasm/bin/full/canvaskit.wasm',
      { cause: err },
    );
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
    return await initFromBytes(mod.default, wasmUrl, wasmBinary);
  } catch {
    onProgress?.(1);
    return mod.default({ locateFile: () => wasmUrl });
  }
}

// canvaskit-wasm ≤0.40 reads `wasmBinary`; 0.41+ ignores it and fetches `locateFile()` itself, so
// the same bytes are also offered as a Blob URL — either glue then takes the wasm from memory
// instead of downloading it again. Without `fetch` the bytes came from `node:fs`, and the Node-mode
// glue reads `locateFile()` with `fs.readFileSync`, which cannot open a `blob:` URL.
async function initFromBytes(
  initFn: CanvasKitInitFn,
  wasmUrl: string,
  wasmBinary: Uint8Array<ArrayBuffer>,
): Promise<CanvasKit> {
  const canBlob =
    typeof fetch !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL.createObjectURL === 'function';
  if (!canBlob) return initFn({ locateFile: () => wasmUrl, wasmBinary });

  const blobUrl = URL.createObjectURL(new Blob([wasmBinary], { type: 'application/wasm' }));
  try {
    return await initFn({ locateFile: () => blobUrl, wasmBinary });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function fetchWithProgress(
  url: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: LoadCanvasKitOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof fetch === 'undefined') {
    const fs = await import('node:fs/promises');
    return new Uint8Array(await fs.readFile(url));
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
