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

// #210 A/B: how the 0.41+ glue gets the wasm. A bench page sets `globalThis.__FLARE_WASM_ARM`;
// unset or unknown is 'blob', today's path. 'url' skips our download and lets the glue fetch the
// server URL itself; 'url-cached' keeps our download, then gives the glue the same server URL so
// its fetch can come from the HTTP cache with an http(s) source. Only when the global is set, the
// path actually taken is written back to `globalThis.__FLARE_WASM_ARM_TAKEN` for the driver.
type WasmArm = 'blob' | 'url' | 'url-cached';

function wasmArm(): WasmArm {
  const arm: unknown = Reflect.get(globalThis, '__FLARE_WASM_ARM');
  return arm === 'url' || arm === 'url-cached' ? arm : 'blob';
}

function markWasmArmTaken(path: WasmArm | 'fallback'): void {
  if (Reflect.has(globalThis, '__FLARE_WASM_ARM')) {
    Reflect.set(globalThis, '__FLARE_WASM_ARM_TAKEN', path);
  }
}

async function init(
  wasmUrl: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: LoadCanvasKitOptions,
): Promise<CanvasKit> {
  const mod = (await import('canvaskit-wasm/bin/full/canvaskit.js')) as {
    default: CanvasKitInitFn;
  };
  // #210 A/B arm 'url'.
  if (wasmArm() === 'url' && typeof fetch !== 'undefined') {
    markWasmArmTaken('url');
    onProgress?.(1);
    return mod.default({ locateFile: () => wasmUrl });
  }
  try {
    const wasmBinary = await fetchWithProgress(wasmUrl, onProgress, options);
    onProgress?.(1);
    return await initFromBytes(mod.default, wasmUrl, wasmBinary);
  } catch {
    markWasmArmTaken('fallback'); // #210 A/B
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

  // #210 A/B arm 'url-cached': the pre-#196 call. `fetchWithProgress` uses the default cache mode.
  if (wasmArm() === 'url-cached') {
    markWasmArmTaken('url-cached');
    return initFn({ locateFile: () => wasmUrl, wasmBinary });
  }
  markWasmArmTaken('blob'); // #210 A/B

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
