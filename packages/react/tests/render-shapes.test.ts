import { describe, expect, it, mock } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';

// Restore the real createFrameRenderer after game-view.test.ts may have mocked it.
const realRender = await import('../../render/src/frame-renderer.js');
mock.module('@flare-engine/render', () => ({ ...realRender }));

import {
  type RenderShapesOpts,
  type ShapeRect,
  type SkOffscreenCanvasLike,
  type SkSurfaceLike,
  type SkiaModuleLike,
  renderShapesToImage,
} from '../src/skia-bridge.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface MockPaint {
  setColorCalls: Float32Array[];
  setColor(c: Float32Array): void;
}

interface MockCanvas extends SkOffscreenCanvasLike {
  clearCalls: Float32Array[];
  drawRectCalls: Array<{ rect: unknown; paint: unknown }>;
}

interface MockSurface extends SkSurfaceLike {
  canvas: MockCanvas;
  snapshotCount: number;
  flush(): void;
}

function makeMockSurface(): MockSurface {
  const canvas: MockCanvas = {
    clearCalls: [],
    drawRectCalls: [],
    drawPicture: () => {},
    drawImageRect: () => {},
    drawRect(rect: unknown, paint: unknown) {
      canvas.drawRectCalls.push({ rect, paint });
    },
    clear(color: unknown) {
      canvas.clearCalls.push(new Float32Array(color as Float32Array));
    },
  };
  const surface: MockSurface = {
    canvas,
    snapshotCount: 0,
    flush() {},
    getCanvas() {
      return canvas;
    },
    makeImageSnapshot(): SkImageLike {
      surface.snapshotCount++;
      return { width: () => 0, height: () => 0, readPixels: () => null };
    },
  };
  return surface;
}

function makeMockPaint(): MockPaint {
  return {
    setColorCalls: [],
    setColor(c: Float32Array) {
      this.setColorCalls.push(new Float32Array(c));
    },
  };
}

interface MockSkia {
  skia: SkiaModuleLike;
  allocCount: number;
  lastW: number;
  lastH: number;
  lastSurface: MockSurface | null;
  paint: MockPaint;
}

function makeMockSkia(surfaceReturnNull = false): MockSkia {
  const mock: MockSkia = {
    allocCount: 0,
    lastW: 0,
    lastH: 0,
    lastSurface: null,
    paint: makeMockPaint(),
    skia: null as unknown as SkiaModuleLike,
  };

  const xywhrect = (x: number, y: number, w: number, h: number) =>
    ({ x, y, w, h }) as unknown as ReturnType<SkiaModuleLike['XYWHRect']>;

  mock.skia = {
    XYWHRect: xywhrect,
    RSXform: () => ({}) as unknown as ReturnType<SkiaModuleLike['RSXform']>,
    Paint: () => mock.paint as unknown as ReturnType<SkiaModuleLike['Paint']>,
    PictureRecorder: () => ({}) as unknown as ReturnType<SkiaModuleLike['PictureRecorder']>,
    ColorFilter: {} as SkiaModuleLike['ColorFilter'],
    Surface: {
      Make(w: number, h: number): SkSurfaceLike | null {
        mock.allocCount++;
        mock.lastW = w;
        mock.lastH = h;
        if (surfaceReturnNull) return null;
        mock.lastSurface = makeMockSurface();
        return mock.lastSurface;
      },
    },
  };

  return mock;
}

function makeOpts(overrides: Partial<RenderShapesOpts> = {}): RenderShapesOpts {
  return {
    width: 64,
    height: 32,
    clearColor: 0xff000000,
    shapes: [],
    ...overrides,
  };
}

function makeRect(overrides: Partial<ShapeRect> = {}): ShapeRect {
  return { x: 0, y: 0, w: 10, h: 10, color: 0xff102030, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderShapesToImage', () => {
  it('returns null when Surface factory is absent', () => {
    const { skia } = makeMockSkia();
    const { Surface: _unused, ...skiaWithout } = skia;
    const result = renderShapesToImage(skiaWithout as SkiaModuleLike, makeOpts());
    expect(result).toBeNull();
  });

  it('returns null when Surface.Make returns null', () => {
    const { skia } = makeMockSkia(true);
    const result = renderShapesToImage(skia, makeOpts());
    expect(result).toBeNull();
  });

  it('empty shape list: clear once, snapshot once, zero drawRect calls', () => {
    const { skia, lastSurface: _ } = makeMockSkia();
    const result = renderShapesToImage(skia, makeOpts({ shapes: [] }));
    const _surface = (makeMockSkia as unknown as { _last?: MockSurface })._last;
    // Use the returned non-null result as proof snapshot was called.
    expect(result).not.toBeNull();
    // Re-run to capture the surface directly via factory.
    const mock = makeMockSkia();
    renderShapesToImage(mock.skia, makeOpts({ shapes: [] }));
    const s = mock.lastSurface as MockSurface;
    expect(s.canvas.clearCalls).toHaveLength(1);
    expect(s.canvas.drawRectCalls).toHaveLength(0);
    expect(s.snapshotCount).toBe(1);
  });

  it('single rect: clear once, drawRect once, snapshot once', () => {
    const mock = makeMockSkia();
    renderShapesToImage(mock.skia, makeOpts({ shapes: [makeRect()] }));
    const s = mock.lastSurface as MockSurface;
    expect(s.canvas.clearCalls).toHaveLength(1);
    expect(s.canvas.drawRectCalls).toHaveLength(1);
    expect(s.snapshotCount).toBe(1);
  });

  it('multiple rects: three shapes produce three drawRect calls', () => {
    const mock = makeMockSkia();
    renderShapesToImage(
      mock.skia,
      makeOpts({
        shapes: [makeRect({ x: 0 }), makeRect({ x: 10 }), makeRect({ x: 20 })],
      }),
    );
    const s = mock.lastSurface as MockSurface;
    expect(s.canvas.drawRectCalls).toHaveLength(3);
  });

  it('ARGB unpack: 0xFF102030 → [r≈0x10/255, g≈0x20/255, b≈0x30/255, a≈1.0]', () => {
    const mock = makeMockSkia();
    renderShapesToImage(mock.skia, makeOpts({ shapes: [makeRect({ color: 0xff102030 })] }));
    const calls = mock.paint.setColorCalls;
    expect(calls).toHaveLength(1);
    const c = calls[0] as Float32Array;
    expect(Math.abs(c[0]! - 0x10 / 255)).toBeLessThan(1e-6);
    expect(Math.abs(c[1]! - 0x20 / 255)).toBeLessThan(1e-6);
    expect(Math.abs(c[2]! - 0x30 / 255)).toBeLessThan(1e-6);
    expect(Math.abs(c[3]! - 1.0)).toBeLessThan(1e-6);
  });

  it('fresh surface each call: two calls invoke Surface.Make twice', () => {
    const mock = makeMockSkia();
    renderShapesToImage(mock.skia, makeOpts());
    renderShapesToImage(mock.skia, makeOpts());
    expect(mock.allocCount).toBe(2);
  });

  it('width/height passthrough: Surface.Make receives opts.width and opts.height', () => {
    const mock = makeMockSkia();
    renderShapesToImage(mock.skia, makeOpts({ width: 128, height: 256 }));
    expect(mock.lastW).toBe(128);
    expect(mock.lastH).toBe(256);
  });
});
