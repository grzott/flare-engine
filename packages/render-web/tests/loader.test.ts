import { afterEach, describe, expect, it, mock } from 'bun:test';

// Stub the CK init module before importing the loader so the dynamic import
// inside loader.ts resolves to our fake without touching the real wasm binary.
mock.module('canvaskit-wasm/bin/full/canvaskit.js', () => ({
  default: async (_opts: unknown) => ({ _brand: 'FakeCanvasKit' }),
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
