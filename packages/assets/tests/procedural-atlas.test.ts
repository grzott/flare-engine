import { describe, expect, it } from 'bun:test';
import {
  createProceduralAtlas,
  type ProceduralFrameSpec,
  packAtlasRows,
  type SkCanvasLike,
  type SkiaAtlasModuleLike,
  type SkPaintLike,
  type SkRectLike,
  type SkSurfaceLike,
} from '../src/procedural-atlas.js';
import type { SkImageLike } from '../src/texture.js';

interface DrawCall {
  rect: SkRectLike;
  color: [number, number, number, number];
}

function createMockSkia(): {
  skia: SkiaAtlasModuleLike;
  calls: DrawCall[];
  surfaces: Array<{ w: number; h: number }>;
} {
  const calls: DrawCall[] = [];
  const surfaces: Array<{ w: number; h: number }> = [];
  let currentPaint: Float32Array = new Float32Array(4);

  const paint: SkPaintLike = {
    setColor(color) {
      currentPaint = new Float32Array(color);
    },
  };

  const canvas: SkCanvasLike = {
    drawRect(rect, _paint) {
      calls.push({
        rect,
        color: [
          currentPaint[0] ?? 0,
          currentPaint[1] ?? 0,
          currentPaint[2] ?? 0,
          currentPaint[3] ?? 0,
        ],
      });
    },
  };

  const image: SkImageLike = {
    width: () => 0,
    height: () => 0,
    readPixels: () => null,
  } as SkImageLike;

  const skia: SkiaAtlasModuleLike = {
    Surface: {
      Make(w, h): SkSurfaceLike | null {
        surfaces.push({ w, h });
        return {
          getCanvas: () => canvas,
          makeImageSnapshot: () => image,
        };
      },
    },
    Paint: () => paint,
    XYWHRect: (x, y, w, h) => ({ x, y, width: w, height: h }),
  };

  return { skia, calls, surfaces };
}

describe('createProceduralAtlas', () => {
  it('packs frames left-to-right within a single row', () => {
    const { skia } = createMockSkia();
    const frames: ProceduralFrameSpec[] = [
      { name: 'a', w: 32, h: 32, color: 0xffff0000 },
      { name: 'b', w: 16, h: 16, color: 0xff00ff00 },
      { name: 'c', w: 48, h: 8, color: 0xff0000ff },
    ];
    const atlas = createProceduralAtlas(skia, frames);
    expect(atlas.sheet.frames).toHaveLength(3);
    expect(atlas.sheet.frames[0]).toEqual({ name: 'a', x: 0, y: 0, w: 32, h: 32 });
    expect(atlas.sheet.frames[1]).toEqual({ name: 'b', x: 32, y: 0, w: 16, h: 16 });
    expect(atlas.sheet.frames[2]).toEqual({ name: 'c', x: 48, y: 0, w: 48, h: 8 });
    expect(atlas.width).toBe(96);
    expect(atlas.height).toBe(32);
  });

  it('wraps to a new row when maxWidth is exceeded', () => {
    const { skia } = createMockSkia();
    const frames: ProceduralFrameSpec[] = [
      { name: 'a', w: 64, h: 32, color: 0xffffffff },
      { name: 'b', w: 64, h: 32, color: 0xffffffff },
      { name: 'c', w: 64, h: 32, color: 0xffffffff },
    ];
    const atlas = createProceduralAtlas(skia, frames, { maxWidth: 100 });
    expect(atlas.sheet.frames[0]?.x).toBe(0);
    expect(atlas.sheet.frames[0]?.y).toBe(0);
    expect(atlas.sheet.frames[1]?.x).toBe(0);
    expect(atlas.sheet.frames[1]?.y).toBe(32);
    expect(atlas.sheet.frames[2]?.x).toBe(0);
    expect(atlas.sheet.frames[2]?.y).toBe(64);
    expect(atlas.height).toBe(96);
  });

  it('applies padding between frames and between rows', () => {
    const { skia } = createMockSkia();
    const frames: ProceduralFrameSpec[] = [
      { name: 'a', w: 10, h: 10, color: 0xff000000 },
      { name: 'b', w: 10, h: 10, color: 0xff000000 },
    ];
    const atlas = createProceduralAtlas(skia, frames, { padding: 4 });
    expect(atlas.sheet.frames[1]?.x).toBe(14);
    expect(atlas.width).toBe(24);
  });

  it('decodes ARGB color into Skia color values', () => {
    const { skia, calls } = createMockSkia();
    const frames: ProceduralFrameSpec[] = [
      { name: 'red', w: 4, h: 4, color: 0xffff0000 },
      { name: 'green', w: 4, h: 4, color: 0x8000ff00 },
    ];
    createProceduralAtlas(skia, frames);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.color).toEqual([1, 0, 0, 1]);
    expect(calls[1]?.color[1]).toBe(1);
    expect(calls[1]?.color[3]).toBeCloseTo(128 / 255);
  });

  it('exposes frames via sheet.frameMap for lookup by name', () => {
    const { skia } = createMockSkia();
    const atlas = createProceduralAtlas(skia, [{ name: 'ship', w: 20, h: 20, color: 0xff00ff00 }]);
    expect(atlas.sheet.frameMap.get('ship')).toBe(0);
  });

  it('throws when Skia.Surface.Make returns null', () => {
    const frames: ProceduralFrameSpec[] = [{ name: 'x', w: 4, h: 4, color: 0 }];
    const skia: SkiaAtlasModuleLike = {
      Surface: { Make: () => null },
      Paint: () => ({ setColor: () => {} }),
      XYWHRect: (x, y, w, h) => ({ x, y, width: w, height: h }),
    };
    expect(() => createProceduralAtlas(skia, frames)).toThrow();
  });
});

describe('packAtlasRows', () => {
  it('packs left to right and wraps when the next frame would cross maxWidth', () => {
    const layout = packAtlasRows(
      [
        { w: 40, h: 10 },
        { w: 40, h: 30 },
        { w: 40, h: 20 },
      ],
      100,
      0,
    );
    expect(layout.rects).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 0, y: 30 },
    ]);
    expect(layout.width).toBe(80);
    expect(layout.height).toBe(50);
  });

  it('puts padding between neighbours and rows, none at the edges', () => {
    const layout = packAtlasRows(
      [
        { w: 10, h: 10 },
        { w: 10, h: 10 },
        { w: 10, h: 10 },
      ],
      24,
      4,
    );
    expect(layout.rects).toEqual([
      { x: 0, y: 0 },
      { x: 14, y: 0 },
      { x: 0, y: 14 },
    ]);
    expect(layout.width).toBe(24);
    expect(layout.height).toBe(24);
  });

  it('gives a frame wider than maxWidth its own row and widens the atlas', () => {
    const layout = packAtlasRows(
      [
        { w: 8, h: 8 },
        { w: 50, h: 8 },
      ],
      32,
      0,
    );
    expect(layout.rects[1]).toEqual({ x: 0, y: 8 });
    expect(layout.width).toBe(50);
  });

  it('returns a 1x1 layout for no frames', () => {
    expect(packAtlasRows([], 64, 2)).toEqual({ rects: [], width: 1, height: 1 });
  });
});
