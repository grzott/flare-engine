import { describe, expect, it, mock } from 'bun:test';

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
    expect((kit as { _brand: string })._brand).toBe('FakeCanvasKit');
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
