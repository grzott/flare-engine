import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import {
  createFrameRenderer,
  getXformCounters,
  resetXformCounters,
} from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';

// ---------------------------------------------------------------------------
// Minimal FrameRendererModule stub (pattern from water-effect.test.ts)
// ---------------------------------------------------------------------------

function makeModule(): FrameRendererModule {
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
    drawAtlas() {},
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

function makeCmd(rotation: number): SpriteDrawCommand {
  return {
    image: {} as SkImageLike,
    srcX: 0,
    srcY: 0,
    srcW: 32,
    srcH: 32,
    dstX: 0,
    dstY: 0,
    dstW: 32,
    dstH: 32,
    effect: undefined,
    alpha: 1,
    rotation,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
    blend: 'normal',
    flipX: false,
    flipY: false,
  };
}

// ---------------------------------------------------------------------------
// __DEV__ save / restore — pattern from packages/core/tests/pool.test.ts
// ---------------------------------------------------------------------------

const g = globalThis as Record<string, unknown>;
let originalDev: unknown;

describe('getXformCounters / resetXformCounters', () => {
  beforeEach(() => {
    originalDev = g.__DEV__;
    g.__DEV__ = true;
    resetXformCounters();
  });

  afterEach(() => {
    g.__DEV__ = originalDev;
  });

  it('a. after resetXformCounters, both counters are zero', () => {
    expect(getXformCounters()).toEqual({ rotated: 0, unrotated: 0 });
  });

  it('b. 3 unrotated commands → unrotated===3, rotated===0', () => {
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, [makeCmd(0), makeCmd(0), makeCmd(0)]);
    expect(getXformCounters()).toEqual({ rotated: 0, unrotated: 3 });
  });

  it('c. 2 rotated commands → rotated===2, unrotated===0', () => {
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, [makeCmd(Math.PI / 4), makeCmd(Math.PI / 2)]);
    expect(getXformCounters()).toEqual({ rotated: 2, unrotated: 0 });
  });

  it('d. mixed batch counts each branch exactly once per command', () => {
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    // 2 unrotated + 1 rotated in one drawAtlas call
    renderer.drawAtlas({} as SkImageLike, [makeCmd(0), makeCmd(Math.PI / 4), makeCmd(0)]);
    expect(getXformCounters()).toEqual({ rotated: 1, unrotated: 2 });
  });

  it('e. resetXformCounters zeroes both after accumulation', () => {
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, [makeCmd(0), makeCmd(Math.PI / 4)]);
    resetXformCounters();
    expect(getXformCounters()).toEqual({ rotated: 0, unrotated: 0 });
  });

  it('f. with __DEV__ deleted from globalThis, drawing does NOT increment either counter', () => {
    delete g.__DEV__;
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, [makeCmd(0), makeCmd(Math.PI / 4)]);
    // Counters were zeroed in beforeEach and must still be 0
    expect(getXformCounters()).toEqual({ rotated: 0, unrotated: 0 });
  });

  it('g. counts transform writes, not sprites: 1 outlined command → 9 hits', () => {
    const cmd = makeCmd(0);
    // drawOutlined fans fillXforms into 8 offset passes + 1 main pass, so the
    // counters report the transform work actually performed, not the sprite count.
    cmd.effect = { type: 'outline', color: { r: 1, g: 0, b: 0, a: 1 }, width: 1 };
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(getXformCounters()).toEqual({ rotated: 0, unrotated: 9 });
  });

  it('h. rotated outlined commands attribute all 9 passes to the rotated branch', () => {
    const cmd = makeCmd(Math.PI / 4);
    cmd.effect = { type: 'outline', color: { r: 1, g: 0, b: 0, a: 1 }, width: 1 };
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(getXformCounters()).toEqual({ rotated: 9, unrotated: 0 });
  });
});
