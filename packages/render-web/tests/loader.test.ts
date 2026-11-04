import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

type GlueOpts = { locateFile: (file: string) => string; wasmBinary?: Uint8Array };
type Glue = (opts: GlueOpts) => Promise<unknown>;

const FAKE_KIT = { _brand: 'FakeCanvasKit' };
const defaultGlue: Glue = async () => FAKE_KIT;
// Tests swap the glue through this variable: bun's `mock.module` freezes the export set by load
// order, so the mock's `default` stays one stable function that delegates here.
let glue: Glue = defaultGlue;

// Stub the CK init module before importing the loader so the dynamic import
// inside loader.ts resolves to our fake without touching the real wasm binary.
mock.module('canvaskit-wasm/bin/full/canvaskit.js', () => ({
  default: (opts: GlueOpts) => glue(opts),
}));

// Import loader AFTER the mock is in place.
const { loadCanvasKit } = await import('../src/loader.js');

describe('loadCanvasKit', () => {
  it('resolves to the CanvasKit instance', async () => {
    const kit = await loadCanvasKit('/fake/canvaskit.wasm');
    expect((kit as unknown as { _brand: string })._brand).toBe('FakeCanvasKit');
  });

  it('returns the same promise on repeated calls (singleton gate)', async () => {
    const p1 = loadCanvasKit('/fake/canvaskit.wasm');
    const p2 = loadCanvasKit('/fake/canvaskit.wasm');
    expect(p1).toBe(p2);
    await p1;
    await p2;
  });

  it('calls onProgress(1) immediately when load is already complete/in-flight', async () => {
    const calls: number[] = [];
    // Singleton is set — returns cached promise immediately, fires onProgress(1).
    loadCanvasKit('/fake/canvaskit.wasm', (f) => calls.push(f));
    expect(calls).toEqual([1]);
  });
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  glue = defaultGlue;
});

async function freshLoader(): Promise<typeof import('../src/loader.js')> {
  return import(`../src/loader.js?t=${Math.random()}`);
}

describe('loadCanvasKit resilience', () => {
  it('clears the cached promise after a failure so a later call retries', async () => {
    const { loadCanvasKit } = await freshLoader();

    // Drive a rejection that genuinely propagates. A bare fetch error does NOT: init() falls back
    // to locateFile and the shared canvaskit-wasm mock resolves it. The deadline does.
    globalThis.fetch = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    await expect(
      loadCanvasKit('/hang/canvaskit.wasm', undefined, { deadlineMs: 30, stallMs: 500 }),
    ).rejects.toThrow(/exceeded/);

    // A poisoned cache would hand back the same rejected promise without touching fetch again.
    let secondCallFetched = false;
    globalThis.fetch = (() => {
      secondCallFetched = true;
      return Promise.reject(new Error('still down'));
    }) as unknown as typeof fetch;
    await loadCanvasKit('/hang/canvaskit.wasm', undefined, { deadlineMs: 200 }).catch(() => {});

    expect(secondCallFetched).toBe(true);
  });

  it('rejects when the load exceeds the deadline', async () => {
    const { loadCanvasKit } = await freshLoader();
    globalThis.fetch = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;

    await expect(
      loadCanvasKit('/hang/canvaskit.wasm', undefined, { deadlineMs: 40, stallMs: 20 }),
    ).rejects.toThrow(/exceeded/);
  });

  it('aborts a stalled stream', async () => {
    const { loadCanvasKit } = await freshLoader();
    let aborted = false;
    globalThis.fetch = ((_u: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    await loadCanvasKit('/stall/canvaskit.wasm', undefined, {
      stallMs: 20,
      deadlineMs: 200,
    }).catch(() => {});

    expect(aborted).toBe(true);
  });

  it('reports indeterminate progress when Content-Length is absent', async () => {
    const { loadCanvasKit } = await freshLoader();
    const fractions: number[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(1_000_000));
        c.enqueue(new Uint8Array(1_000_000));
        c.close();
      },
    });
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        body,
        headers: new Headers(),
      } as Response)) as unknown as typeof fetch;

    await loadCanvasKit('/nolen/canvaskit.wasm', (f) => fractions.push(f)).catch(() => {});

    // Without a length the bar must creep, not sit at 0 and jump to 1.
    const mid = fractions.filter((f) => f > 0 && f < 1);
    expect(mid.length).toBeGreaterThan(0);
  });
});

const WASM_URL = 'http://localhost/canvaskit.wasm';

function wasmPattern(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (i * 31 + 7) & 0xff;
  return bytes;
}

/**
 * Serves `bytes` for every non-`blob:` URL and counts those hits. `blob:` URLs go to the real
 * fetch, which in bun resolves object URLs minted by `URL.createObjectURL`.
 */
function stubNetwork(bytes: Uint8Array<ArrayBuffer>): { hits: () => number } {
  let hits = 0;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith('blob:')) return realFetch(input, init);
    hits++;
    return Promise.resolve(
      new Response(bytes, { headers: { 'Content-Length': String(bytes.length) } }),
    );
  }) as typeof fetch;
  return { hits: () => hits };
}

async function readUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { credentials: 'same-origin' });
  return new Uint8Array(await res.arrayBuffer());
}

describe('loadCanvasKit single download', () => {
  it('serves a 0.41+ glue (ignores wasmBinary, fetches locateFile) from the progress download', async () => {
    const { loadCanvasKit } = await freshLoader();
    const bytes = wasmPattern(4096);
    const network = stubNetwork(bytes);
    const revoke = spyOn(URL, 'revokeObjectURL');
    const located: string[] = [];
    const received: Uint8Array[] = [];
    glue = async (opts) => {
      const url = opts.locateFile('canvaskit.wasm');
      located.push(url);
      received.push(await readUrl(url));
      return FAKE_KIT;
    };

    try {
      await loadCanvasKit(WASM_URL);
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith(located[0]);
    } finally {
      revoke.mockRestore();
    }

    expect(network.hits()).toBe(1);
    expect(located).toHaveLength(1);
    expect(located[0]?.startsWith('blob:')).toBe(true);
    expect(received).toEqual([bytes]);
  });

  it('serves a 0.40 glue (reads wasmBinary) from the progress download', async () => {
    const { loadCanvasKit } = await freshLoader();
    const bytes = wasmPattern(4096);
    const network = stubNetwork(bytes);
    const received: Uint8Array[] = [];
    glue = async (opts) => {
      received.push(opts.wasmBinary ?? (await readUrl(opts.locateFile('canvaskit.wasm'))));
      return FAKE_KIT;
    };

    await loadCanvasKit(WASM_URL);

    expect(network.hits()).toBe(1);
    expect(received).toEqual([bytes]);
  });

  it('falls back to the network URL when the glue rejects the blob: URL', async () => {
    const { loadCanvasKit } = await freshLoader();
    const network = stubNetwork(wasmPattern(4096));
    const located: string[] = [];
    glue = async (opts) => {
      const url = opts.locateFile('canvaskit.wasm');
      located.push(url);
      if (url.startsWith('blob:')) throw new Error("Refused to connect to 'blob:' (CSP)");
      await readUrl(url);
      return FAKE_KIT;
    };

    const kit = await loadCanvasKit(WASM_URL);

    expect((kit as unknown as { _brand: string })._brand).toBe('FakeCanvasKit');
    expect(located).toHaveLength(2);
    expect(located[0]?.startsWith('blob:')).toBe(true);
    expect(located[1]).toBe(WASM_URL);
    expect(network.hits()).toBe(2);
  });
});
