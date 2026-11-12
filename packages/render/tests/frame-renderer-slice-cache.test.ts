import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';

// ---------------------------------------------------------------------------
// FrameRendererModule stub that records the arrays handed to drawAtlas
// (pattern from frame-renderer-counters.test.ts)
// ---------------------------------------------------------------------------

type AtlasCall = { srcs: unknown[]; dsts: unknown[] };

function makeModule(calls: AtlasCall[]): FrameRendererModule {
  const fakePaint: PaintLike = {
    setAlphaf() {},
    setColorFilter() {},
    setShader() {},
    setImageFilter() {},
  };
  const fakeCanvas = {
    save() {
      return 0;
    },
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clear() {},
    drawAtlas(_image: unknown, srcs: unknown[], dsts: unknown[]) {
      calls.push({ srcs, dsts });
    },
    drawImageRect() {},
    drawRect() {},
  };
  return {
    XYWHRect(x, y, w, h) {
      const r = {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx: number, ny: number, nw: number, nh: number) {
          r.x = nx;
          r.y = ny;
          r.width = nw;
          r.height = nh;
        },
      };
      return r;
    },
    RSXform(_scos, _ssin, _tx, _ty) {
      return { scos: 0, ssin: 0, tx: 0, ty: 0, set() {} };
    },
    Paint() {
      return fakePaint;
    },
    PictureRecorder() {
      return {
        beginRecording(_bounds: unknown) {
          return fakeCanvas;
        },
        finishRecordingAsPicture() {
          return {};
        },
      };
    },
    ColorFilter: {
      MakeBlend(_color: Float32Array, _mode: number) {
        return {};
      },
      MakeMatrix(_m: number[]) {
        return {};
      },
    },
  };
}

function makeRun(n: number): SpriteDrawCommand[] {
  const run: SpriteDrawCommand[] = [];
  for (let i = 0; i < n; i++) {
    run.push({
      image: {} as SkImageLike,
      srcX: i,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    });
  }
  return run;
}

describe('frame renderer atlas slice cache', () => {
  it('alternating run lengths 3, 5, 3, 5 reuse the slice arrays of the first pair', () => {
    const calls: AtlasCall[] = [];
    const renderer = createFrameRenderer(makeModule(calls));
    const image = {} as SkImageLike;
    renderer.beginFrame(128, 128);
    for (const n of [3, 5, 3, 5]) renderer.drawAtlas(image, makeRun(n));

    expect(calls.map((c) => c.srcs.length)).toEqual([3, 5, 3, 5]);
    expect(calls.map((c) => c.dsts.length)).toEqual([3, 5, 3, 5]);
    expect(calls[2]?.srcs).toBe(calls[0]?.srcs);
    expect(calls[2]?.dsts).toBe(calls[0]?.dsts);
    expect(calls[3]?.srcs).toBe(calls[1]?.srcs);
    expect(calls[3]?.dsts).toBe(calls[1]?.dsts);
  });

  it('a reused slice holds the live pooled elements, so it carries the new run', () => {
    const calls: AtlasCall[] = [];
    const renderer = createFrameRenderer(makeModule(calls));
    const image = {} as SkImageLike;
    renderer.beginFrame(128, 128);
    renderer.drawAtlas(image, makeRun(3));
    renderer.drawAtlas(image, makeRun(5));
    const shifted = makeRun(3);
    for (const cmd of shifted) cmd.srcX += 100;
    renderer.drawAtlas(image, shifted);

    expect(calls[2]?.srcs).toBe(calls[0]?.srcs);
    const reused = (calls[2]?.srcs ?? []) as { x: number }[];
    expect(reused.map((r) => r.x)).toEqual([100, 101, 102]);
  });

  it('a run of the old full-capacity length still gets exactly n entries after the pool grows', () => {
    const calls: AtlasCall[] = [];
    const renderer = createFrameRenderer(makeModule(calls));
    const image = {} as SkImageLike;
    renderer.beginFrame(128, 128);
    // 3 fills the pool exactly; 5 grows it; the second 3 must not see the grown pool.
    for (const n of [3, 5, 3]) renderer.drawAtlas(image, makeRun(n));

    expect(calls[0]?.srcs.length).toBe(3);
    expect(calls[0]?.dsts.length).toBe(3);
    expect(calls[2]?.srcs.length).toBe(3);
    expect(calls[2]?.dsts.length).toBe(3);
  });

  it('runs longer than the per-length cache keep only the most recent length', () => {
    const calls: AtlasCall[] = [];
    const renderer = createFrameRenderer(makeModule(calls));
    const image = {} as SkImageLike;
    renderer.beginFrame(128, 128);
    for (const n of [300, 300, 400, 300, 3, 300]) renderer.drawAtlas(image, makeRun(n));

    expect(calls.map((c) => c.srcs.length)).toEqual([300, 300, 400, 300, 3, 300]);
    expect(calls.map((c) => c.dsts.length)).toEqual([300, 300, 400, 300, 3, 300]);
    expect(calls[1]?.srcs).toBe(calls[0]?.srcs);
    expect(calls[1]?.dsts).toBe(calls[0]?.dsts);
    expect(calls[3]?.srcs).not.toBe(calls[0]?.srcs);
    expect(calls[3]?.dsts).not.toBe(calls[0]?.dsts);
    // A short run in between does not evict the long slot.
    expect(calls[5]?.srcs).toBe(calls[3]?.srcs);
    expect(calls[5]?.dsts).toBe(calls[3]?.dsts);
  });
});
