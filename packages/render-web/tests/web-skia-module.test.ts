import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type {
  DrawSurfaceLike,
  FrameRendererModule,
  PaintLike,
  RectLike,
  RSXformLike,
} from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from '../src/web-skia-module.js';

interface AtlasCall {
  /** The view objects handed to CanvasKit, for identity checks. */
  srcs: Float32Array;
  xforms: Float32Array;
  /** Their contents at call time; the scratch buffers are overwritten by later runs. */
  srcData: number[];
  xformData: number[];
}

interface FakeCanvas {
  id: number;
  calls: string[];
  atlas: AtlasCall[];
}

function makeFakeKit(): { kit: CanvasKit; canvases: FakeCanvas[] } {
  const canvases: FakeCanvas[] = [];

  const makeCanvas = (): FakeCanvas & Record<string, unknown> => {
    const calls: string[] = [];
    const atlas: AtlasCall[] = [];
    return {
      id: canvases.length,
      calls,
      atlas,
      save: () => {
        calls.push('save');
        return 0;
      },
      restore: () => calls.push('restore'),
      translate: (x: number, y: number) => calls.push(`translate(${x},${y})`),
      scale: (sx: number, sy: number) => calls.push(`scale(${sx},${sy})`),
      rotate: (deg: number, cx: number, cy: number) => calls.push(`rotate(${deg},${cx},${cy})`),
      clear: () => calls.push('clear'),
      drawRect: (r: Float32Array) => calls.push(`drawRect(${Array.from(r).join(',')})`),
      drawImageRect: (_img: unknown, src: Float32Array, dst: Float32Array) =>
        calls.push(`drawImageRect(${Array.from(src).join(',')}|${Array.from(dst).join(',')})`),
      drawAtlas: (_img: unknown, srcs: Float32Array, xforms: Float32Array) => {
        calls.push(`drawAtlas(${srcs.length / 4})`);
        atlas.push({ srcs, xforms, srcData: Array.from(srcs), xformData: Array.from(xforms) });
      },
    };
  };

  const kit = {
    FilterMode: { Nearest: { name: 'Nearest' }, Linear: { name: 'Linear' } },
    MipmapMode: {
      None: { name: 'None' },
      Nearest: { name: 'Nearest' },
      Linear: { name: 'Linear' },
    },
    BlendMode: { SrcOver: {}, SrcIn: {}, SrcATop: {}, Plus: {} },
    XYWHRect: (x: number, y: number, w: number, h: number) =>
      new Float32Array([x, y, x + w, y + h]),
    Paint: class {
      setAlphaf() {}
      setColor() {}
      setColorFilter() {}
      setShader() {}
      setImageFilter() {}
      setBlendMode() {}
    },
    PictureRecorder: class {
      beginRecording() {
        const canvas = makeCanvas();
        canvases.push(canvas);
        return canvas;
      }
      finishRecordingAsPicture() {
        return {};
      }
    },
  } as unknown as CanvasKit;

  return { kit, canvases };
}

const IMAGE = {} as SkImageLike;

interface Run {
  srcs: RectLike[];
  xforms: RSXformLike[];
  expectedSrcs: number[];
  expectedXforms: number[];
}

/** `n` sprites whose values are derived from `seed`, plus the flat data CanvasKit should receive. */
function makeRun(mod: FrameRendererModule, n: number, seed: number): Run {
  const srcs: RectLike[] = [];
  const xforms: RSXformLike[] = [];
  const expectedSrcs: number[] = [];
  const expectedXforms: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = seed + i;
    const y = seed + i * 2;
    srcs.push(mod.XYWHRect(x, y, 8, 16));
    expectedSrcs.push(x, y, x + 8, y + 16);
    xforms.push(mod.RSXform(1, 0, x * 10, y * 10));
    expectedXforms.push(1, 0, x * 10, y * 10);
  }
  return { srcs, xforms, expectedSrcs, expectedXforms };
}

function draw(surface: DrawSurfaceLike, run: Run, paint: PaintLike): void {
  surface.drawAtlas(IMAGE, run.srcs, run.xforms, paint);
}

describe('createWebSkiaModule recorder canvas wrapper', () => {
  it('returns the same wrapper from consecutive beginRecording calls on one recorder', () => {
    const { kit } = makeFakeKit();
    const mod = createWebSkiaModule(kit);
    const rec = mod.PictureRecorder();
    const bounds = mod.XYWHRect(0, 0, 64, 64);

    const first = rec.beginRecording(bounds);
    rec.finishRecordingAsPicture();
    const second = rec.beginRecording(bounds);

    expect(second).toBe(first);
  });

  it('draws into the canvas of the latest beginRecording, not an earlier one', () => {
    const { kit, canvases } = makeFakeKit();
    const mod = createWebSkiaModule(kit);
    const rec = mod.PictureRecorder();
    const bounds = mod.XYWHRect(0, 0, 64, 64);
    const paint = mod.Paint();

    const first = rec.beginRecording(bounds);
    first.translate(1, 2);
    rec.finishRecordingAsPicture();

    const second = rec.beginRecording(bounds);
    second.save();
    second.scale(2, 3);
    second.rotate(90, 4, 5);
    second.drawRect(mod.XYWHRect(1, 2, 3, 4), paint);
    second.drawImageRect(IMAGE, mod.XYWHRect(0, 0, 2, 2), mod.XYWHRect(10, 20, 4, 4), paint);
    draw(second, makeRun(mod, 2, 1), paint);
    second.restore();

    expect(canvases).toHaveLength(2);
    expect(canvases[0]?.calls).toEqual(['translate(1,2)']);
    expect(canvases[1]?.calls).toEqual([
      'save',
      'scale(2,3)',
      'rotate(90,4,5)',
      'drawRect(1,2,4,6)',
      'drawImageRect(0,0,2,2|10,20,14,24)',
      'drawAtlas(2)',
      'restore',
    ]);
  });

  it('keeps a separate wrapper per recorder', () => {
    const { kit, canvases } = makeFakeKit();
    const mod = createWebSkiaModule(kit);
    const bounds = mod.XYWHRect(0, 0, 64, 64);
    const recA = mod.PictureRecorder();
    const recB = mod.PictureRecorder();

    const a = recA.beginRecording(bounds);
    const b = recB.beginRecording(bounds);
    expect(b).not.toBe(a);

    a.translate(1, 1);
    b.translate(2, 2);
    expect(canvases[0]?.calls).toEqual(['translate(1,1)']);
    expect(canvases[1]?.calls).toEqual(['translate(2,2)']);
  });
});

describe('createWebSkiaModule drawAtlas views', () => {
  function setup() {
    const { kit, canvases } = makeFakeKit();
    const mod = createWebSkiaModule(kit);
    const surface = mod.PictureRecorder().beginRecording(mod.XYWHRect(0, 0, 64, 64));
    const atlas = (): AtlasCall[] => canvases[0]?.atlas ?? [];
    return { mod, surface, paint: mod.Paint(), atlas };
  }

  it('hands CanvasKit the same view objects for two runs of the same length', () => {
    const { mod, surface, paint, atlas } = setup();
    const runA = makeRun(mod, 3, 1);
    const runB = makeRun(mod, 3, 100);

    draw(surface, runA, paint);
    draw(surface, runB, paint);

    const [a, b] = atlas();
    expect(b?.srcs).toBe(a?.srcs as Float32Array);
    expect(b?.xforms).toBe(a?.xforms as Float32Array);
    expect(a?.srcData).toEqual(runA.expectedSrcs);
    expect(a?.xformData).toEqual(runA.expectedXforms);
    expect(b?.srcData).toEqual(runB.expectedSrcs);
    expect(b?.xformData).toEqual(runB.expectedXforms);
  });

  it('gives a run of a different length its own correctly sized views', () => {
    const { mod, surface, paint, atlas } = setup();
    const three = makeRun(mod, 3, 1);
    const five = makeRun(mod, 5, 50);
    const threeAgain = makeRun(mod, 3, 200);

    draw(surface, three, paint);
    draw(surface, five, paint);
    draw(surface, threeAgain, paint);

    const [a, b, c] = atlas();
    expect(a?.srcs.length).toBe(12);
    expect(a?.xforms.length).toBe(12);
    expect(b?.srcs.length).toBe(20);
    expect(b?.xforms.length).toBe(20);
    expect(b?.srcs).not.toBe(a?.srcs as Float32Array);
    expect(b?.srcData).toEqual(five.expectedSrcs);
    expect(b?.xformData).toEqual(five.expectedXforms);
    // The length-3 views survive an intervening run of another length.
    expect(c?.srcs).toBe(a?.srcs as Float32Array);
    expect(c?.xforms).toBe(a?.xforms as Float32Array);
    expect(c?.srcData).toEqual(threeAgain.expectedSrcs);
    expect(c?.xformData).toEqual(threeAgain.expectedXforms);
  });

  it('drops the cached views when the scratch buffers grow', () => {
    const { mod, surface, paint, atlas } = setup();
    const small = makeRun(mod, 4, 1);
    // The scratch buffers start at 32 sprites; 40 forces a reallocation.
    const big = makeRun(mod, 40, 300);
    const smallAgain = makeRun(mod, 4, 700);
    const smallThird = makeRun(mod, 4, 900);

    draw(surface, small, paint);
    draw(surface, big, paint);
    draw(surface, smallAgain, paint);
    draw(surface, smallThird, paint);

    const [a, b, c, d] = atlas();
    expect(b?.srcs.length).toBe(160);
    expect(b?.srcData).toEqual(big.expectedSrcs);
    expect(b?.xformData).toEqual(big.expectedXforms);
    expect(b?.srcs.buffer).not.toBe(a?.srcs.buffer as ArrayBufferLike);
    expect(b?.xforms.buffer).not.toBe(a?.xforms.buffer as ArrayBufferLike);

    // Same length as before the growth, but a fresh view over the grown buffer.
    expect(c?.srcs).not.toBe(a?.srcs as Float32Array);
    expect(c?.xforms).not.toBe(a?.xforms as Float32Array);
    expect(c?.srcs.buffer).toBe(b?.srcs.buffer as ArrayBufferLike);
    expect(c?.xforms.buffer).toBe(b?.xforms.buffer as ArrayBufferLike);
    expect(c?.srcs.length).toBe(16);
    expect(c?.xforms.length).toBe(16);
    expect(c?.srcData).toEqual(smallAgain.expectedSrcs);
    expect(c?.xformData).toEqual(smallAgain.expectedXforms);

    // The cache refills after the growth.
    expect(d?.srcs).toBe(c?.srcs as Float32Array);
    expect(d?.xforms).toBe(c?.xforms as Float32Array);
    expect(d?.srcData).toEqual(smallThird.expectedSrcs);
    expect(d?.xformData).toEqual(smallThird.expectedXforms);
  });

  it('shares the view cache across recorders of one module', () => {
    const { kit, canvases } = makeFakeKit();
    const mod = createWebSkiaModule(kit);
    const bounds = mod.XYWHRect(0, 0, 64, 64);
    const paint = mod.Paint();
    const runA = makeRun(mod, 2, 1);
    const runB = makeRun(mod, 2, 40);

    draw(mod.PictureRecorder().beginRecording(bounds), runA, paint);
    draw(mod.PictureRecorder().beginRecording(bounds), runB, paint);

    const a = canvases[0]?.atlas[0];
    const b = canvases[1]?.atlas[0];
    expect(b?.srcs).toBe(a?.srcs as Float32Array);
    expect(a?.srcData).toEqual(runA.expectedSrcs);
    expect(b?.srcData).toEqual(runB.expectedSrcs);
    expect(b?.xformData).toEqual(runB.expectedXforms);
  });
});
