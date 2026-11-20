/**
 * Shape atlas bake tests against a recording stub Skia: cell sizing and
 * placement, the 2048 px cell cap, the re-raster band, and instance draws
 * through a real `SpriteBatch`. Real pixels are covered on CanvasKit by
 * `packages/render-web/tests/web-shape-skia.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import { Renderer, SpriteBatch, type SpriteDrawCommand } from '@flare-engine/render';
import {
  bakeShapeAtlas,
  drawBakedShape,
  rebakeShapeAtlas,
  SHAPE_ATLAS_MAX_CELL,
  type ShapeAtlasSkia,
  shapeAtlasNeedsRebake,
} from '../src/atlas.js';
import { shapeBoundsBox } from '../src/bounds.js';
import type { ShapeSpec } from '../src/types.js';

interface Call {
  readonly method: string;
  readonly args: readonly number[];
}

interface Stub {
  readonly Skia: ShapeAtlasSkia;
  readonly calls: Call[];
  readonly surfaces: { w: number; h: number; disposed: boolean }[];
  readonly images: object[];
}

function createStubSkia(surfaceIsNull = false): Stub {
  const calls: Call[] = [];
  const surfaces: { w: number; h: number; disposed: boolean }[] = [];
  const images: object[] = [];
  const rec = (method: string, ...args: number[]): void => {
    calls.push({ method, args });
  };

  const paint = {
    setColor: (c: Float32Array) => rec('paint.setColor', ...c),
    setStyle: (s: number) => rec('paint.setStyle', s),
    setStrokeWidth: (w: number) => rec('paint.setStrokeWidth', w),
  };
  const path = {
    moveTo: () => {},
    lineTo: () => {},
    close: () => {},
    addArc: () => {},
  };
  const canvas = {
    save: () => rec('save'),
    restore: () => rec('restore'),
    translate: (x: number, y: number) => rec('translate', x, y),
    scale: (x: number, y: number) => rec('scale', x, y),
    rotate: (deg: number) => rec('rotate', deg),
    clear: (c: Float32Array) => rec('clear', ...c),
    drawCircle: (cx: number, cy: number, r: number) => rec('drawCircle', cx, cy, r),
    drawRect: () => rec('drawRect'),
    drawPath: () => rec('drawPath'),
  };

  const Skia: ShapeAtlasSkia = {
    Surface: {
      Make(w, h) {
        if (surfaceIsNull) return null;
        const record = { w, h, disposed: false };
        surfaces.push(record);
        return {
          getCanvas: () => canvas,
          makeImageSnapshot() {
            const image = { width: () => w, height: () => h, readPixels: () => null };
            images.push(image);
            return image;
          },
          dispose() {
            record.disposed = true;
          },
        };
      },
    },
    Paint: () => paint,
    Path: { Make: () => path, MakeFromSVGString: () => path },
    XYWHRect: (x, y, w, h) => ({ x, y, w, h }),
  };
  return { Skia, calls, surfaces, images };
}

const CIRCLE: ShapeSpec = { kind: 'circle', r: 10, fill: 0xffff0000 };
const RECT: ShapeSpec = { kind: 'rect', w: 40, h: 12, fill: 0xff00ff00, ox: 6 };
const RING: ShapeSpec = {
  kind: 'ring',
  r: 8,
  stroke: 0xff0000ff,
  strokeWidth: 2,
  glow: 'friendly',
};

describe('bakeShapeAtlas — cells', () => {
  test('sizes each cell from shapeBoundsBox times the raster scale', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT, RING], 2);
    expect(atlas.cells).toHaveLength(3);
    [CIRCLE, RECT, RING].forEach((spec, i) => {
      const box = shapeBoundsBox([spec]);
      const cell = atlas.cells[i]!;
      expect(cell.frame.w).toBe(Math.ceil((box.maxX - box.minX) * 2));
      expect(cell.frame.h).toBe(Math.ceil((box.maxY - box.minY) * 2));
      expect(cell.scale).toBe(2);
      expect(cell.width).toBe(cell.frame.w / 2);
      expect(cell.height).toBe(cell.frame.h / 2);
      // The anchor is the spec's origin inside the cell.
      expect(cell.anchorX * cell.width).toBeCloseTo(-box.minX);
      expect(cell.anchorY * cell.height).toBeCloseTo(-box.minY);
    });
  });

  test('returns the { image, sheet } pair with one named frame per distinct spec', () => {
    const { Skia, images, surfaces } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT], 1);
    expect(atlas.image).toBe(images[0] as never);
    expect(atlas.sheet.frames).toEqual([atlas.cells[0]!.frame, atlas.cells[1]!.frame]);
    expect(atlas.sheet.frameMap.get('0')).toBe(0);
    expect(atlas.sheet.frameMap.get('1')).toBe(1);
    expect(surfaces).toEqual([{ w: atlas.width, h: atlas.height, disposed: true }]);
    expect(atlas.scale).toBe(1);
  });

  test('packs cells with the default 2 px gap and no overlap', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT, RING], 1);
    const [a, b, c] = atlas.cells.map((cell) => cell.frame);
    expect(a!.x).toBe(0);
    expect(b!.x).toBe(a!.w + 2);
    expect(c!.x).toBe(b!.x + b!.w + 2);
    expect(atlas.width).toBe(c!.x + c!.w);
    expect(atlas.height).toBe(Math.max(a!.h, b!.h, c!.h));
  });

  test('honours padding and maxWidth', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT], 1, { padding: 5, maxWidth: 40 });
    const [a, b] = atlas.cells.map((cell) => cell.frame);
    expect(b!.x).toBe(0);
    expect(b!.y).toBe(a!.h + 5);
    expect(atlas.padding).toBe(5);
    expect(atlas.maxWidth).toBe(40);
  });

  test('bakes a spec object that repeats only once', () => {
    const { Skia, calls } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT, CIRCLE], 1);
    expect(atlas.cells).toHaveLength(3);
    expect(atlas.cells[2]).toBe(atlas.cells[0]!);
    expect(atlas.sheet.frames).toHaveLength(2);
    expect(calls.filter((c) => c.method === 'drawCircle')).toHaveLength(1);
  });

  test('copies the spec list, so a later edit of the caller array cannot change a re-bake', () => {
    const { Skia } = createStubSkia();
    const specs: ShapeSpec[] = [CIRCLE];
    const atlas = bakeShapeAtlas(Skia, specs, 1);
    specs.push(RECT);
    expect(atlas.specs).toEqual([CIRCLE]);
  });

  test('an empty spec list bakes a 1x1 atlas with no cells', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [], 1);
    expect(atlas.cells).toHaveLength(0);
    expect(atlas.width).toBe(1);
    expect(atlas.height).toBe(1);
  });
});

describe('bakeShapeAtlas — drawing', () => {
  test('clears to transparent, then draws each spec at its cell origin under the raster scale', () => {
    const { Skia, calls } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RING], 3);
    expect(calls[0]).toEqual({ method: 'clear', args: [0, 0, 0, 0] });

    const canvasCalls = calls.filter((c) => !c.method.startsWith('paint.'));
    const second = atlas.cells[1]!;
    const box = shapeBoundsBox([CIRCLE]);
    expect(canvasCalls.slice(1, 6)).toEqual([
      { method: 'save', args: [] },
      { method: 'translate', args: [-box.minX * 3, -box.minY * 3] },
      { method: 'scale', args: [3, 3] },
      { method: 'drawCircle', args: [0, 0, 10] },
      { method: 'restore', args: [] },
    ]);
    const ringBox = shapeBoundsBox([RING]);
    expect(canvasCalls[7]).toEqual({
      method: 'translate',
      args: [second.frame.x - ringBox.minX * 3, second.frame.y - ringBox.minY * 3],
    });
  });

  test('bakes the real fill, stroke and glow colours', () => {
    const { Skia, calls } = createStubSkia();
    bakeShapeAtlas(Skia, [RING], 1);
    const colours = calls.filter((c) => c.method === 'paint.setColor').map((c) => c.args);
    // Friendly glow ring first, then the ring's own stroke.
    expect(colours).toHaveLength(2);
    expect(colours[0]![1]).toBeCloseTo(0xa6 / 255);
    expect(colours[1]).toEqual([0, 0, 1, 1]);
  });

  test('throws on a raster scale that is not a positive finite number', () => {
    const { Skia } = createStubSkia();
    for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => bakeShapeAtlas(Skia, [CIRCLE], scale)).toThrow(/raster scale/);
    }
  });

  test('throws when Skia.Surface.Make returns null', () => {
    const { Skia } = createStubSkia(true);
    expect(() => bakeShapeAtlas(Skia, [CIRCLE], 1)).toThrow(/Surface\.Make returned null/);
  });
});

describe('bakeShapeAtlas — 2048 px cell cap', () => {
  const BIG: ShapeSpec = { kind: 'rect', w: 1000, h: 100, fill: 0xffffffff };

  test('a cell that would exceed the cap is baked at a lower scale of its own', () => {
    const { Skia, calls } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [BIG, CIRCLE], 4);
    const box = shapeBoundsBox([BIG]);
    const [big, small] = atlas.cells;

    expect(SHAPE_ATLAS_MAX_CELL).toBe(2048);
    expect(big!.frame.w).toBe(2048);
    expect(big!.scale).toBeCloseTo(2048 / (box.maxX - box.minX));
    expect(big!.scale).toBeLessThan(4);
    // Height follows the same reduced scale, so the cell keeps its aspect.
    expect(big!.frame.h).toBe(Math.ceil((box.maxY - box.minY) * big!.scale));
    // The logical size is unchanged: an instance draws as large as an uncapped one.
    expect(big!.width).toBeCloseTo(box.maxX - box.minX);
    expect(calls).toContainEqual({ method: 'scale', args: [big!.scale, big!.scale] });

    // Other cells keep the requested scale, and the atlas reports it.
    expect(small!.scale).toBe(4);
    expect(atlas.scale).toBe(4);
  });

  test('caps on the taller axis too', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [{ kind: 'rect', w: 10, h: 3000, fill: 0xffffffff }], 1);
    expect(atlas.cells[0]!.frame.h).toBe(2048);
    expect(atlas.cells[0]!.frame.w).toBeLessThan(20);
  });

  test('a cell exactly at the cap is not rescaled', () => {
    const { Skia } = createStubSkia();
    const spec: ShapeSpec = { kind: 'rect', w: 1020, h: 10, fill: 0xffffffff };
    const box = shapeBoundsBox([spec]);
    expect(box.maxX - box.minX).toBe(1024);
    const atlas = bakeShapeAtlas(Skia, [spec], 2);
    expect(atlas.cells[0]!.frame.w).toBe(2048);
    expect(atlas.cells[0]!.scale).toBe(2);
  });
});

describe('re-raster band', () => {
  test('a scale inside 0.75x to 1.5x of the baked scale needs no re-bake', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE], 2);
    for (const scale of [1.5, 1.6, 2, 2.9, 3]) {
      expect(shapeAtlasNeedsRebake(atlas, scale)).toBe(false);
    }
  });

  test('a scale outside the band needs one', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE], 2);
    for (const scale of [0.5, 1.49, 3.01, 8]) {
      expect(shapeAtlasNeedsRebake(atlas, scale)).toBe(true);
    }
  });

  test('a scale that is not a positive finite number never asks for a re-bake', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE], 2);
    for (const scale of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(shapeAtlasNeedsRebake(atlas, scale)).toBe(false);
    }
  });

  test('rebakeShapeAtlas returns the same atlas inside the band without touching Skia', () => {
    const { Skia, surfaces } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT], 2);
    expect(rebakeShapeAtlas(Skia, atlas, 1.5)).toBe(atlas);
    expect(rebakeShapeAtlas(Skia, atlas, 3)).toBe(atlas);
    expect(surfaces).toHaveLength(1);
  });

  test('rebakeShapeAtlas bakes the same specs and options at the new scale outside the band', () => {
    const { Skia, surfaces } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT], 1, { padding: 6, maxWidth: 512 });
    const next = rebakeShapeAtlas(Skia, atlas, 2);

    expect(next).not.toBe(atlas);
    expect(surfaces).toHaveLength(2);
    expect(next.scale).toBe(2);
    expect(next.specs).toEqual([CIRCLE, RECT]);
    expect(next.padding).toBe(6);
    expect(next.maxWidth).toBe(512);
    expect(next.image).not.toBe(atlas.image);
    expect(next.cells[0]!.frame.w).toBe(atlas.cells[0]!.frame.w * 2);
    // The logical size and anchor are scale-independent, so instance draws need no change.
    expect(next.cells[0]!.width).toBe(atlas.cells[0]!.width);
    expect(next.cells[0]!.anchorX).toBeCloseTo(atlas.cells[0]!.anchorX);
    // The band now follows the new baked scale.
    expect(shapeAtlasNeedsRebake(next, 3)).toBe(false);
    expect(shapeAtlasNeedsRebake(atlas, 3)).toBe(true);
  });

  test('a downward re-bake keeps each spec origin even when the cell size rounds differently', () => {
    const { Skia } = createStubSkia();
    // Non-whole bounds: each bake rounds its cell up to whole pixels at its own scale.
    const ODD: ShapeSpec = { kind: 'rect', w: 2.01, h: 1.37, fill: 0xffffffff, ox: 0.3 };
    const atlas = bakeShapeAtlas(Skia, [ODD], 4);
    const next = rebakeShapeAtlas(Skia, atlas, 1);
    const before = atlas.cells[0]!;
    const after = next.cells[0]!;

    expect(next).not.toBe(atlas);
    // The origin offset inside the cell, in spec units, is exactly the spec's -minX / -minY.
    expect(after.anchorX * after.width).toBeCloseTo(before.anchorX * before.width, 9);
    expect(after.anchorY * after.height).toBeCloseTo(before.anchorY * before.height, 9);
    // The cell itself may grow by the coarser bake's rounding margin, never shrink below the spec.
    expect(after.width).toBeGreaterThanOrEqual(before.width - 1e-9);
    expect(after.height).toBeGreaterThanOrEqual(before.height - 1e-9);
  });
});

describe('drawBakedShape', () => {
  function flushed(batch: SpriteBatch, renderer?: Renderer): SpriteDrawCommand[][] {
    const runs: SpriteDrawCommand[][] = [];
    batch.flush((_image, commands) => {
      runs.push(commands.map((c) => ({ ...c })));
    }, renderer);
    return runs;
  }

  test('N baked entities of mixed specs, rotations and scales draw in one run', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT, RING], 2);
    const batch = new SpriteBatch();
    const renderer = new Renderer();

    const N = 500;
    for (let i = 0; i < N; i++) {
      drawBakedShape(batch, atlas, i % 3, i * 3, i * 2, i * 0.1, 0.5 + (i % 4) * 0.5);
    }
    const runs = flushed(batch, renderer);

    expect(renderer.stats.drawCalls).toBe(1);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(N);
    expect(runs[0]!.every((c) => c.image === atlas.image && !c.stretch)).toBe(true);
  });

  test('coloured instances also share one run, whatever their colours and alphas', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT], 1);
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    for (let i = 0; i < 64; i++) {
      drawBakedShape(batch, atlas, i % 2, i, i, 0, 1, 0xff000000 | (i * 1000), 1 - i / 100);
    }
    batch.flush(() => {}, renderer);
    expect(renderer.stats.drawCalls).toBe(1);
  });

  test('two atlases draw in one run per atlas image', () => {
    const { Skia } = createStubSkia();
    const a = bakeShapeAtlas(Skia, [CIRCLE], 1);
    const b = bakeShapeAtlas(Skia, [RECT], 1);
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    for (let i = 0; i < 10; i++) drawBakedShape(batch, a, 0, i, 0);
    for (let i = 0; i < 10; i++) drawBakedShape(batch, b, 0, i, 0);
    batch.flush(() => {}, renderer);
    expect(renderer.stats.drawCalls).toBe(2);
  });

  test('places the spec origin at (x, y) and scales the logical size uniformly', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [RECT], 2);
    const cell = atlas.cells[0]!;
    const batch = new SpriteBatch();
    drawBakedShape(batch, atlas, 0, 100, 50, 0.7, 3);
    const cmd = flushed(batch)[0]![0]!;

    expect(cmd.srcX).toBe(cell.frame.x);
    expect(cmd.srcY).toBe(cell.frame.y);
    expect(cmd.srcW).toBe(cell.frame.w);
    expect(cmd.srcH).toBe(cell.frame.h);
    expect(cmd.dstW).toBeCloseTo(cell.width * 3);
    expect(cmd.dstH).toBeCloseTo(cell.height * 3);
    // Uniform: both axes share one source-to-destination ratio.
    expect(cmd.dstW / cmd.srcW).toBeCloseTo(cmd.dstH / cmd.srcH);
    // The anchor point, which is the spec origin, lands on (x, y).
    expect(cmd.dstX + cmd.anchorX * cmd.dstW).toBeCloseTo(100);
    expect(cmd.dstY + cmd.anchorY * cmd.dstH).toBeCloseTo(50);
    expect(cmd.rotation).toBe(0.7);
    expect(cmd.alpha).toBe(1);
  });

  test('a capped cell draws at the same logical size as an uncapped one', () => {
    const { Skia } = createStubSkia();
    const spec: ShapeSpec = { kind: 'rect', w: 1000, h: 100, fill: 0xffffffff };
    const capped = bakeShapeAtlas(Skia, [spec], 4);
    const plain = bakeShapeAtlas(Skia, [spec], 1);
    const batch = new SpriteBatch();
    drawBakedShape(batch, capped, 0, 0, 0);
    drawBakedShape(batch, plain, 0, 0, 0);
    const [a, b] = flushed(batch).flat();
    expect(a!.dstW).toBeCloseTo(b!.dstW);
    expect(a!.dstX).toBeCloseTo(b!.dstX);
  });

  test('defaults draw unrotated, unscaled and uncoloured', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE], 1);
    const batch = new SpriteBatch();
    const seen: (Uint32Array | undefined)[] = [];
    drawBakedShape(batch, atlas, 0, 5, 5);
    batch.flush((_image, commands, colors) => {
      seen.push(colors);
      expect(commands[0]!.rotation).toBe(0);
      expect(commands[0]!.dstW).toBe(atlas.cells[0]!.width);
    });
    expect(seen).toEqual([undefined]);
  });

  test('passes the colour multiplier and alpha through to the batch', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE], 1);
    const batch = new SpriteBatch();
    const seen: number[] = [];
    drawBakedShape(batch, atlas, 0, 0, 0, 0, 1, 0xff336699, 0.5);
    batch.flush((_image, _commands, colors) => {
      seen.push(colors![0]!);
    });
    expect(seen).toEqual([0x80336699]);
  });

  test('an index with no cell draws nothing', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE], 1);
    const batch = new SpriteBatch();
    drawBakedShape(batch, atlas, 7, 0, 0);
    expect(batch.count).toBe(0);
  });

  test('queues without allocating a command once the batch pool is warm', () => {
    const { Skia } = createStubSkia();
    const atlas = bakeShapeAtlas(Skia, [CIRCLE, RECT], 1);
    const batch = new SpriteBatch();
    const frame = (): void => {
      for (let i = 0; i < 200; i++) drawBakedShape(batch, atlas, i % 2, i, i, i, 1, 0xffffffff);
      batch.flush(() => {});
    };
    frame();
    const warm = batch.allocCount;
    for (let i = 0; i < 20; i++) frame();
    expect(batch.allocCount).toBe(warm);
  });
});

describe('bakeShapeAtlas — builder-only handle (react-native-skia 2.14+)', () => {
  interface StubBuilder {
    moveTo(x: number, y: number): StubBuilder;
    lineTo(x: number, y: number): StubBuilder;
    close(): StubBuilder;
    addArc(oval: unknown, startDeg: number, sweepDeg: number): StubBuilder;
    detach(): object;
  }

  test('bakes path kinds on PathBuilder and draws the detached paths', () => {
    const base = createStubSkia();
    const built: string[] = [];
    const detached: object[] = [];
    const drawn: unknown[] = [];
    let pathMakes = 0;

    const builder: StubBuilder = {
      moveTo() {
        built.push('moveTo');
        return builder;
      },
      lineTo() {
        built.push('lineTo');
        return builder;
      },
      close() {
        built.push('close');
        return builder;
      },
      addArc() {
        built.push('addArc');
        return builder;
      },
      detach() {
        built.push('detach');
        const path = { detachedPath: detached.length };
        detached.push(path);
        return path;
      },
    };

    const Skia: ShapeAtlasSkia = {
      ...base.Skia,
      Surface: {
        Make(w, h) {
          const surface = base.Skia.Surface.Make(w, h);
          if (surface === null) return null;
          const canvas = {
            ...surface.getCanvas(),
            drawPath(path: unknown) {
              drawn.push(path);
            },
          };
          return { ...surface, getCanvas: () => canvas };
        },
      },
      // No mutators: what `Path.Make()` returns from react-native-skia 2.14.
      Path: {
        Make() {
          pathMakes++;
          return {};
        },
        MakeFromSVGString: () => ({}),
      },
      PathBuilder: { Make: () => builder },
    };

    const triangle: ShapeSpec = { kind: 'triangle', size: 10, fill: 0xffff0000 };
    const sector: ShapeSpec = {
      kind: 'arc',
      r: 12,
      startAngle: 0,
      endAngle: Math.PI,
      sector: true,
      fill: 0xff00ff00,
      stroke: 0xff0000ff,
    };

    let atlas: ReturnType<typeof bakeShapeAtlas> | undefined;
    expect(() => {
      atlas = bakeShapeAtlas(Skia, [triangle, sector], 2);
    }).not.toThrow();
    expect(atlas?.cells).toHaveLength(2);

    expect(built).toEqual([
      'moveTo',
      'lineTo',
      'lineTo',
      'close',
      'detach',
      'moveTo',
      'addArc',
      'close',
      'detach',
    ]);
    // The triangle fills once; the sector fills, then strokes, the same path.
    expect(drawn).toHaveLength(3);
    expect(drawn[0]).toBe(detached[0]);
    expect(drawn[1]).toBe(detached[1]);
    expect(drawn[2]).toBe(detached[1]);
    expect(pathMakes).toBe(0);
  });
});
