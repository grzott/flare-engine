import { afterEach, expect, mock, test } from 'bun:test';
import { makeMockKit } from '../support/mock-kit';

const real = await import('@flare-engine/render-web');
const loaded = makeMockKit().kit;
const loadCanvasKit = mock((_wasmUrl: string) => Promise.resolve(loaded));
mock.module('@flare-engine/render-web', () => ({ ...real, loadCanvasKit }));

// Loaded after the mock, so `resolveCanvasKit` never reaches the real loader.
const { resolveCanvasKit } = await import('../../src/web/kit');

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'CanvasKit');
  loadCanvasKit.mockClear();
});

test('the kit passed in wins over the global one and the loader', async () => {
  const prop = makeMockKit().kit;
  Reflect.set(globalThis, 'CanvasKit', makeMockKit().kit);

  expect(await resolveCanvasKit({ canvasKit: prop, wasmUrl: '/canvaskit.wasm' })).toBe(prop);
  expect(loadCanvasKit).not.toHaveBeenCalled();
});

test('globalThis.CanvasKit comes next, and loadCanvasKit is not called', async () => {
  const global = makeMockKit().kit;
  Reflect.set(globalThis, 'CanvasKit', global);

  expect(await resolveCanvasKit({ wasmUrl: '/canvaskit.wasm' })).toBe(global);
  expect(loadCanvasKit).not.toHaveBeenCalled();
});

test('a global that is no CanvasKit is passed over', async () => {
  Reflect.set(globalThis, 'CanvasKit', 'not a kit');

  expect(await resolveCanvasKit({ wasmUrl: '/canvaskit.wasm' })).toBe(loaded);
});

test('with neither, loadCanvasKit loads from wasmUrl', async () => {
  expect(await resolveCanvasKit({ wasmUrl: '/canvaskit.wasm' })).toBe(loaded);
  expect(loadCanvasKit.mock.calls).toEqual([['/canvaskit.wasm']]);
});

test('with no kit, no global and no wasmUrl it rejects, naming the full binary', async () => {
  const failure = await resolveCanvasKit({}).catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).toContain('canvaskit-wasm/bin/full/canvaskit.wasm');
  expect(loadCanvasKit).not.toHaveBeenCalled();
});

test('a rejection from loadCanvasKit is passed on as it is', async () => {
  loadCanvasKit.mockImplementationOnce(() => Promise.reject(Number.POSITIVE_INFINITY));

  const failure = await resolveCanvasKit({ wasmUrl: '/canvaskit.wasm' }).catch(
    (error: unknown) => error,
  );
  expect(failure).toBe(Number.POSITIVE_INFINITY);
});
