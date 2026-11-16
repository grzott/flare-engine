/**
 * `createWebShapeSkia` against a real CanvasKit CPU surface: `bakeShapeAtlas`
 * from `@flare-engine/shapes` rasterizes through it, and the baked pixels are
 * read back. Then baked instances go through `SpriteBatch` and the CanvasKit
 * frame renderer, to confirm they land where `drawBakedShape` puts them, in one
 * draw call. A mock kit covers what real pixels cannot: object lifetimes and
 * the CanvasKit 0.40 mutable-`Path` fallback.
 */
import { beforeAll, describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { createFrameRenderer, Renderer, SpriteBatch } from '@flare-engine/render';
import {
  bakeShapeAtlas,
  drawBakedShape,
  type ShapeAtlas,
  type ShapeAtlasSkia,
  type ShapeSpec,
} from '@flare-engine/shapes';
import type { CanvasKit, Image as CKImage } from 'canvaskit-wasm';
import { createWebShapeSkia, type WebShapeSkia } from '../src/web-shape-skia.js';
import { createWebSkiaModule } from '../src/web-skia-module.js';

const WASM_PATH = resolve(
  import.meta.dir,
  '../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

async function loadCK(): Promise<CanvasKit> {
  const { default: initCK } = await import('canvaskit-wasm/bin/full/canvaskit.js');
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  return initCK({ locateFile: () => WASM_PATH, wasmBinary });
}

let kit: CanvasKit;

beforeAll(async () => {
  kit = await loadCK();
}, 30_000);

/** Unpremultiplied RGBA bytes of a CanvasKit image. */
function readRgba(image: CKImage): { pixels: Uint8Array; width: number } {
  const width = image.width();
  const pixels = image.readPixels(0, 0, {
    width,
    height: image.height(),
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Unpremul,
    colorSpace: kit.ColorSpace.SRGB,
  }) as Uint8Array;
  return { pixels, width };
}

function at(img: { pixels: Uint8Array; width: number }, x: number, y: number): number[] {
  const i = (Math.floor(y) * img.width + Math.floor(x)) * 4;
  return [img.pixels[i]!, img.pixels[i + 1]!, img.pixels[i + 2]!, img.pixels[i + 3]!];
}

/** Atlas pixel under the point (`ux`, `uy`) of cell `index`, in spec units from the spec origin. */
function cellPixel(
  atlas: ShapeAtlas,
  img: { pixels: Uint8Array; width: number },
  index: number,
  ux: number,
  uy: number,
): number[] {
  const cell = atlas.cells[index]!;
  return at(
    img,
    cell.frame.x + cell.anchorX * cell.frame.w + ux * cell.scale,
    cell.frame.y + cell.anchorY * cell.frame.h + uy * cell.scale,
  );
}

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 0, 0, 0];

describe('createWebShapeSkia — baking on a real CanvasKit surface', () => {
  it('is a ShapeAtlasSkia with no cast', () => {
    const skia: ShapeAtlasSkia = createWebShapeSkia(kit);
    expect(typeof skia.Surface.Make).toBe('function');
  });

  it('bakes fills, strokes and path kinds with their own colours', () => {
    const specs: ShapeSpec[] = [
      { kind: 'circle', r: 10, fill: 0xffff0000 },
      { kind: 'circle', r: 10, stroke: 0xff00ff00, strokeWidth: 4 },
      { kind: 'triangle', size: 12, fill: 0xff0000ff },
      { kind: 'rect', w: 20, h: 8, fill: 0xff00ff00 },
      { kind: 'path', d: 'M -8 -8 L 8 -8 L 8 8 L -8 8 Z', boundsR: 12, fill: 0xffff0000 },
      { kind: 'arc', r: 10, startAngle: 0, endAngle: Math.PI, fill: 0xff0000ff },
    ];
    const atlas = bakeShapeAtlas(createWebShapeSkia(kit), specs, 2);
    const image = atlas.image as unknown as CKImage;
    expect(image.width()).toBe(atlas.width);
    expect(image.height()).toBe(atlas.height);
    const img = readRgba(image);

    // Filled circle: solid inside, transparent in the cell corner.
    expect(cellPixel(atlas, img, 0, 0, 0)).toEqual(RED);
    expect(at(img, atlas.cells[0]!.frame.x, atlas.cells[0]!.frame.y)).toEqual(CLEAR);
    // Stroke-only circle: nothing at the centre, the stroke colour on the rim.
    expect(cellPixel(atlas, img, 1, 0, 0)).toEqual(CLEAR);
    expect(cellPixel(atlas, img, 1, 10, 0)).toEqual(GREEN);
    // Path-built kinds.
    expect(cellPixel(atlas, img, 2, 0, 0)).toEqual(BLUE);
    expect(cellPixel(atlas, img, 3, 0, 0)).toEqual(GREEN);
    expect(cellPixel(atlas, img, 4, 0, 0)).toEqual(RED);
    // Skia's arc sweeps clockwise from +X in a Y-down canvas: the lower half.
    expect(cellPixel(atlas, img, 5, 0, 5)).toEqual(BLUE);
    expect(cellPixel(atlas, img, 5, 0, -5)).toEqual(CLEAR);
    image.delete();
  });

  it('bakes every spec kind without throwing, glow included', () => {
    const specs: ShapeSpec[] = [
      { kind: 'ngon', n: 6, r: 10, fill: 0xffffffff, stroke: 0xff000000 },
      { kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: 0xffffffff, glow: 'hazard' },
      { kind: 'ring', r: 8, stroke: 0xffffffff, strokeWidth: 2, glow: 'friendly' },
      { kind: 'polyline', points: [-5, 0, 0, 5, 5, 0], stroke: 0xffffffff },
      { kind: 'gradient-rect', w: 20, h: 6, colorA: 0xffff0000, colorB: 0xff0000ff, axis: 0 },
      { kind: 'annulus', rOuter: 10, rInner: 6, fill: 0xffffffff },
      { kind: 'annulus', rOuter: 10, rInner: 6, fill: 0xffffffff, startAngle: 0, endAngle: 2 },
      { kind: 'trapezoid', topW: 6, botW: 12, h: 8, fill: 0xffffffff, rot: 0.5 },
      { kind: 'path', d: 'not a path', boundsR: 4, fill: 0xffffffff },
      {
        kind: 'ship',
        hull: { kind: 'triangle', size: 14, fill: 0xffffffff },
        weapons: [{ kind: 'rect', w: 3, h: 8, fill: 0xffffffff, ox: 8 }],
        engine: { kind: 'square', size: 6, fill: 0xffffffff, oy: 8 },
        glow: { color: 0x80ffffff, width: 2 },
      },
    ];
    const atlas = bakeShapeAtlas(createWebShapeSkia(kit), specs, 1.5);
    expect(atlas.cells).toHaveLength(specs.length);
    const img = readRgba(atlas.image as unknown as CKImage);
    // The ship's hull covers its origin.
    expect(cellPixel(atlas, img, 9, 0, 0)).toEqual([255, 255, 255, 255]);
    (atlas.image as unknown as CKImage).delete();
  });

  it('keeps every painted pixel inside its own cell', () => {
    const spec: ShapeSpec = {
      kind: 'star',
      points: 5,
      rOuter: 12,
      rInner: 5,
      fill: 0xffffffff,
      stroke: 0xffff0000,
      strokeWidth: 3,
      glow: 'friendly',
    };
    // Two copies of an equal spec, as separate objects, sit side by side.
    const atlas = bakeShapeAtlas(createWebShapeSkia(kit), [spec, { ...spec }], 2, { padding: 4 });
    const img = readRgba(atlas.image as unknown as CKImage);
    const [a, b] = atlas.cells.map((c) => c.frame);
    expect(b!.x).toBe(a!.w + 4);
    for (let y = 0; y < atlas.height; y++) {
      // The 4 px gap between the cells, and each cell's outermost columns.
      for (const x of [a!.x, a!.w - 1, a!.w, a!.w + 3, b!.x, b!.x + b!.w - 1]) {
        expect(at(img, x, y)[3]).toBe(0);
      }
    }
    (atlas.image as unknown as CKImage).delete();
  });
});

describe('createWebShapeSkia — baked instances through the CanvasKit frame renderer', () => {
  it('draws N instances in one draw call, each with its origin at (x, y)', () => {
    const disc: ShapeSpec = { kind: 'circle', r: 6, fill: 0xffff0000 };
    const bar: ShapeSpec = { kind: 'rect', w: 24, h: 4, fill: 0xff0000ff };
    const atlas = bakeShapeAtlas(createWebShapeSkia(kit), [disc, bar], 1);

    const W = 120;
    const H = 80;
    const frameRenderer = createFrameRenderer(createWebSkiaModule(kit));
    const stats = new Renderer();
    const batch = new SpriteBatch();
    frameRenderer.beginFrame(W, H, 0, 1);
    drawBakedShape(batch, atlas, 0, 20, 20);
    drawBakedShape(batch, atlas, 0, 60, 20, 0, 2);
    // A quarter turn stands the bar upright.
    drawBakedShape(batch, atlas, 1, 100, 40, Math.PI / 2);
    // A colour multiplier: red times (0, 0, 0) is black, at full alpha.
    drawBakedShape(batch, atlas, 0, 20, 60, 0, 1, 0xff000000);
    batch.flush(frameRenderer.drawAtlas, stats);
    const pic = frameRenderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    const target = kit.MakeSurface(W, H);
    expect(target).not.toBeNull();
    if (!target) return;
    const tc = target.getCanvas();
    tc.clear(kit.Color4f(0, 0, 0, 0));
    tc.drawPicture(pic as Parameters<typeof tc.drawPicture>[0]);
    target.flush();
    const snapshot = target.makeImageSnapshot();
    const img = readRgba(snapshot);

    // Three uncoloured instances are one run whatever their scale and rotation; the
    // coloured one is a second, because coloured and uncoloured sprites never share a run.
    expect(stats.stats.drawCalls).toBe(2);

    expect(at(img, 20, 20)).toEqual(RED);
    expect(at(img, 20, 30)).toEqual(CLEAR);
    // Scale 2: radius 12, so 8 px out, outside the unscaled disc, is solid.
    expect(at(img, 60, 28)).toEqual(RED);
    expect(at(img, 60, 36)).toEqual(CLEAR);
    // The 24x4 bar, turned: 10 px above and below the origin, nothing 10 px to the side.
    expect(at(img, 100, 30)).toEqual(BLUE);
    expect(at(img, 100, 50)).toEqual(BLUE);
    expect(at(img, 110, 40)).toEqual(CLEAR);
    expect(at(img, 20, 60)).toEqual([0, 0, 0, 255]);

    snapshot.delete();
    target.delete();
    (pic as { delete?: () => void }).delete?.();
    (atlas.image as unknown as CKImage).delete();
  });

  it('draws 200 uncoloured instances of mixed specs in a single draw call', () => {
    const specs: ShapeSpec[] = [
      { kind: 'circle', r: 6, fill: 0xffff0000 },
      { kind: 'triangle', size: 8, fill: 0xff00ff00 },
      { kind: 'star', points: 5, rOuter: 8, rInner: 3, fill: 0xff0000ff, glow: 'hazard' },
    ];
    const atlas = bakeShapeAtlas(createWebShapeSkia(kit), specs, 1);
    const frameRenderer = createFrameRenderer(createWebSkiaModule(kit));
    const stats = new Renderer();
    const batch = new SpriteBatch();
    frameRenderer.beginFrame(400, 400, 0, 1);
    for (let i = 0; i < 200; i++) {
      drawBakedShape(batch, atlas, i % 3, (i % 20) * 20, Math.floor(i / 20) * 40, i * 0.3, 1.25);
    }
    batch.flush(frameRenderer.drawAtlas, stats);
    const pic = frameRenderer.endFrame();
    expect(stats.stats.drawCalls).toBe(1);
    (pic as { delete?: () => void } | null)?.delete?.();
    (atlas.image as unknown as CKImage).delete();
  });
});

describe('createWebShapeSkia — object lifetimes (mock kit)', () => {
  interface Mock {
    kit: CanvasKit;
    log: string[];
  }

  function makeMock(withBuilder: boolean, surfaceIsNull = false): Mock {
    const log: string[] = [];
    let id = 0;
    const verbs = (name: string) => ({
      moveTo: () => log.push(`${name}.moveTo`),
      lineTo: () => log.push(`${name}.lineTo`),
      close: () => log.push(`${name}.close`),
      addArc: () => log.push(`${name}.addArc`),
      delete: () => log.push(`${name}.delete`),
    });
    const immutablePath = (name: string) => ({ delete: () => log.push(`${name}.delete`), name });

    class Paint {
      readonly name = `paint${++id}`;
      setAntiAlias(aa: boolean): void {
        log.push(`${this.name}.setAntiAlias(${aa})`);
      }
      setColor(): void {}
      setStyle(style: string): void {
        log.push(`${this.name}.setStyle(${style})`);
      }
      setStrokeWidth(): void {}
      delete(): void {
        log.push(`${this.name}.delete`);
      }
    }

    function PathBuilder(this: object, from?: { name: string }): object {
      const name = `builder${++id}`;
      if (from) log.push(`${name}.copyOf(${from.name})`);
      return Object.assign(this, verbs(name), {
        snapshot: () => immutablePath(`${name}.snap`),
      });
    }

    function Path(this: object): object {
      const name = `path${++id}`;
      return Object.assign(this, verbs(name), { name });
    }
    Path.MakeFromSVGString = (d: string) => {
      if (d === 'bad') return null;
      const name = `svg${++id}`;
      return withBuilder ? immutablePath(name) : { ...verbs(name), name };
    };

    const canvas = {
      drawPath: (path: { name: string }) => log.push(`drawPath(${path.name})`),
      drawCircle: () => log.push('drawCircle'),
      save: () => 0,
      restore: () => {},
      translate: () => {},
      scale: () => {},
      clear: () => {},
    };

    const mock = {
      MakeSurface: () =>
        surfaceIsNull
          ? null
          : {
              getCanvas: () => canvas,
              flush: () => log.push('surface.flush'),
              makeImageSnapshot: () => {
                log.push('surface.snapshot');
                return { image: true };
              },
              delete: () => log.push('surface.delete'),
            },
      Paint,
      Path,
      PathBuilder: withBuilder ? PathBuilder : undefined,
      PaintStyle: { Fill: 'Fill', Stroke: 'Stroke' },
      XYWHRect: (x: number, y: number, w: number, h: number) => Float32Array.of(x, y, x + w, y + h),
    };
    return { kit: mock as unknown as CanvasKit, log };
  }

  function exercise(skia: WebShapeSkia): void {
    const surface = skia.Surface.Make(8, 8);
    if (surface === null) throw new Error('no surface');
    const canvas = surface.getCanvas();
    const paint = skia.Paint();
    paint.setStyle(0);
    paint.setStyle(1);
    const path = skia.Path.Make();
    path.moveTo(0, 0);
    path.lineTo(1, 1);
    path.close();
    canvas.drawPath(path, paint);
    canvas.drawPath(path, paint);
    const svg = skia.Path.MakeFromSVGString('M 0 0');
    if (svg !== null) canvas.drawPath(svg, paint);
    surface.makeImageSnapshot();
    surface.dispose();
  }

  it('maps the numeric paint style onto CanvasKit enum entries and turns anti-aliasing on', () => {
    const { kit: mock, log } = makeMock(true);
    exercise(createWebShapeSkia(mock));
    expect(log).toContain('paint1.setAntiAlias(true)');
    expect(log).toContain('paint1.setStyle(Fill)');
    expect(log).toContain('paint1.setStyle(Stroke)');
  });

  it('PathBuilder: draws a snapshot per draw and deletes it; dispose frees surface, paint and builders', () => {
    const { kit: mock, log } = makeMock(true);
    exercise(createWebShapeSkia(mock));
    expect(log).toEqual([
      'paint1.setAntiAlias(true)',
      'paint1.setStyle(Fill)',
      'paint1.setStyle(Stroke)',
      'builder2.moveTo',
      'builder2.lineTo',
      'builder2.close',
      'drawPath(builder2.snap)',
      'builder2.snap.delete',
      'drawPath(builder2.snap)',
      'builder2.snap.delete',
      // The parsed path is copied into a builder and freed at once.
      'builder4.copyOf(svg3)',
      'svg3.delete',
      'drawPath(builder4.snap)',
      'builder4.snap.delete',
      'surface.flush',
      'surface.snapshot',
      'surface.delete',
      'paint1.delete',
      'builder2.delete',
      'builder4.delete',
    ]);
  });

  it('CanvasKit 0.40 (no PathBuilder): builds on the mutable Path and draws it directly', () => {
    const { kit: mock, log } = makeMock(false);
    exercise(createWebShapeSkia(mock));
    expect(log).toEqual([
      'paint1.setAntiAlias(true)',
      'paint1.setStyle(Fill)',
      'paint1.setStyle(Stroke)',
      'path2.moveTo',
      'path2.lineTo',
      'path2.close',
      'drawPath(path2)',
      'drawPath(path2)',
      'drawPath(svg3)',
      'surface.flush',
      'surface.snapshot',
      'surface.delete',
      'paint1.delete',
      'path2.delete',
      'svg3.delete',
    ]);
  });

  it('a second dispose does not free the first bake objects again', () => {
    const { kit: mock, log } = makeMock(true);
    const skia = createWebShapeSkia(mock);
    exercise(skia);
    log.length = 0;
    skia.Surface.Make(4, 4)?.dispose();
    expect(log).toEqual(['surface.delete']);
  });

  it('returns null for an unparsable SVG string and for a surface CanvasKit cannot make', () => {
    expect(createWebShapeSkia(makeMock(true).kit).Path.MakeFromSVGString('bad')).toBeNull();
    expect(createWebShapeSkia(makeMock(true, true).kit).Surface.Make(4, 4)).toBeNull();
  });

  it('bakeShapeAtlas disposes the surface it made', () => {
    const { kit: mock, log } = makeMock(true);
    bakeShapeAtlas(
      createWebShapeSkia(mock),
      [
        { kind: 'circle', r: 4, fill: 0xffffffff },
        { kind: 'triangle', size: 4, fill: 0xffffffff },
      ],
      1,
    );
    // Snapshot first, then the surface, the bake's paint and the triangle's path builder.
    expect(log.slice(log.indexOf('surface.snapshot'))).toEqual([
      'surface.snapshot',
      'surface.delete',
      'paint1.delete',
      'builder2.delete',
    ]);
  });
});
