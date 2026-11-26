import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import {
  CAPTURE_PADDING,
  captureView,
  modernScreenshotRasterizer,
  setWebRasterizer,
  type WebRasterizer,
} from '../../src/web/capture';
import { installDom } from '../support/dom';

installDom();

type DomToCanvasOptions = {
  scale: number;
  width: number;
  height: number;
  style: { margin: string };
};

/** A raster result: only its size is read before it reaches CanvasKit. */
const raster = (width: number, height: number): HTMLCanvasElement =>
  ({ width, height }) as HTMLCanvasElement;

// What modern-screenshot does with the options: a canvas of `width` by `height` at `scale`.
const domToCanvas = mock((_el: HTMLElement, o: DomToCanvasOptions) =>
  Promise.resolve(raster(Math.floor(o.width * o.scale), Math.floor(o.height * o.scale))),
);
mock.module('modern-screenshot', () => ({ domToCanvas }));

function element(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => new DOMRect(10, 20, width, height);
  return el;
}

const warn = spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  Reflect.set(globalThis, 'devicePixelRatio', 2);
  warn.mockClear();
  domToCanvas.mockClear();
});

afterEach(() => {
  setWebRasterizer(null);
});

test('with no rasterizer set it resolves null, and warns once however often it is asked', async () => {
  expect(await captureView(element(100, 40), 2048)).toBeNull();
  expect(await captureView(element(100, 40), 2048)).toBeNull();

  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0]?.[0])).toContain('setWebRasterizer');
});

test('the rasterizer gets the element and the screen pixel ratio, and its result is the handle', async () => {
  const source = raster(200, 80);
  const rasterizer = mock<WebRasterizer>(() => Promise.resolve(source));
  setWebRasterizer(rasterizer);
  const el = element(100, 40);

  const image = await captureView(el, 2048);

  expect(rasterizer.mock.calls).toEqual([[el, 2]]);
  expect(image).toEqual({ width: 200, height: 80, pixelRatio: 2, padding: 0, handle: source });
  expect(image?.handle).toBe(source);
  expect(warn).not.toHaveBeenCalled();
});

test('a rasterizer throwing SecurityError resolves null, warns once and does not throw', async () => {
  setWebRasterizer(() => {
    throw new DOMException('The canvas has been tainted', 'SecurityError');
  });

  expect(await captureView(element(100, 40), 2048)).toBeNull();
  expect(await captureView(element(100, 40), 2048)).toBeNull();

  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0]?.[0])).toContain('SecurityError');
});

test('a rasterizer that rejects resolves null', async () => {
  setWebRasterizer(() => Promise.reject(new Error('no')));

  expect(await captureView(element(100, 40), 2048)).toBeNull();
});

test('a rasterizer with nothing to give resolves null', async () => {
  setWebRasterizer(() => Promise.resolve(null));
  expect(await captureView(element(100, 40), 2048)).toBeNull();

  setWebRasterizer(() => Promise.resolve(raster(0, 0)));
  expect(await captureView(element(100, 40), 2048)).toBeNull();
});

test('an element with no size is never rasterized', async () => {
  const rasterizer = mock<WebRasterizer>(() => Promise.resolve(raster(1, 1)));
  setWebRasterizer(rasterizer);

  expect(await captureView(element(0, 40), 2048)).toBeNull();
  expect(rasterizer).not.toHaveBeenCalled();
});

test('a 1080×1920 element at pixel ratio 3 is rasterized at a lower ratio, 2048 px on its longer side', async () => {
  Reflect.set(globalThis, 'devicePixelRatio', 3);
  const rasterizer = mock<WebRasterizer>((_el, ratio) =>
    Promise.resolve(raster(Math.round(1080 * ratio), Math.round(1920 * ratio))),
  );
  setWebRasterizer(rasterizer);

  const image = await captureView(element(1080, 1920), 2048);

  expect(rasterizer.mock.calls[0]?.[1]).toBeCloseTo(2048 / 1920, 10);
  expect(image?.pixelRatio).toBeCloseTo(2048 / 1920, 10);
  expect(Math.max(image?.width ?? 0, image?.height ?? 0)).toBe(2048);
  expect(image?.width).toBe(1152);
});

test('a result longer than asked for is redrawn at 2048 px, and its pixel ratio drops to match', async () => {
  Reflect.set(globalThis, 'devicePixelRatio', 3);
  // It ignores the ratio it is given.
  const source = raster(3240, 5760);
  setWebRasterizer(() => Promise.resolve(source));
  const drawn: unknown[][] = [];
  const getContext = spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    drawImage: (...args: unknown[]) => {
      drawn.push(args);
    },
  })) as unknown as HTMLCanvasElement['getContext']);

  const image = await captureView(element(1080, 1920), 2048);
  getContext.mockRestore();

  expect(image?.width).toBe(1152);
  expect(image?.height).toBe(2048);
  expect(image?.pixelRatio).toBeCloseTo((2048 / 1920) * (2048 / 5760), 10);
  expect(image?.handle).not.toBe(source);
  expect(image?.handle).toBeInstanceOf(HTMLCanvasElement);
  expect(drawn).toEqual([[source, 0, 0, 1152, 2048]]);
});

test('a result longer than asked for, where no 2D canvas can redraw it, resolves null', async () => {
  setWebRasterizer(() => Promise.resolve(raster(4096, 100)));
  const getContext = spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => null) as unknown as HTMLCanvasElement['getContext'],
  );

  const image = await captureView(element(100, 40), 2048);
  getContext.mockRestore();

  expect(image).toBeNull();
});

test('the modern-screenshot adapter captures the element with its padding on every side', async () => {
  setWebRasterizer(await modernScreenshotRasterizer());
  const el = element(100, 40);

  const image = await captureView(el, 2048);

  expect(CAPTURE_PADDING).toBe(24);
  expect(domToCanvas.mock.calls).toEqual([
    [el, { scale: 2, width: 148, height: 88, style: { margin: '24px' } }],
  ]);
  expect(image?.padding).toBe(24);
  expect(image?.width).toBe(296);
  expect(image?.height).toBe(176);
  expect(image?.pixelRatio).toBe(2);
});

test('the padding counts towards the 2048 px cap', async () => {
  Reflect.set(globalThis, 'devicePixelRatio', 3);
  setWebRasterizer(await modernScreenshotRasterizer());

  const image = await captureView(element(1080, 1920), 2048);

  expect(image?.pixelRatio).toBeCloseTo(2048 / 1968, 10);
  expect(Math.max(image?.width ?? 0, image?.height ?? 0)).toBeLessThanOrEqual(2048);
  expect(image?.padding).toBe(24);
});

test('setWebRasterizer(null) takes the rasterizer away again', async () => {
  const rasterizer = mock<WebRasterizer>(() => Promise.resolve(raster(200, 80)));
  setWebRasterizer(rasterizer);
  setWebRasterizer(null);

  expect(await captureView(element(100, 40), 2048)).toBeNull();
  expect(rasterizer).not.toHaveBeenCalled();
});
