import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import type { AnySpriteEffect } from '../src/sprite-effects.js';

// ---------------------------------------------------------------------------
// FrameRendererModule stub (pattern from frame-renderer-counters.test.ts) whose
// ColorFilter.MakeBlend records the numeric blend mode it is handed.
// ---------------------------------------------------------------------------

function makeModule(modes: number[]): FrameRendererModule {
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
      MakeBlend(_color: Float32Array, mode: number) {
        modes.push(mode);
        return {};
      },
      MakeMatrix(_m: number[]) {
        return {};
      },
    },
  };
}

function makeCmd(effect: AnySpriteEffect, stretch = false): SpriteDrawCommand {
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
    effect,
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch,
    blend: 'normal',
    flipX: false,
    flipY: false,
  };
}

function recordModes(cmd: SpriteDrawCommand): number[] {
  const modes: number[] = [];
  const renderer = createFrameRenderer(makeModule(modes));
  renderer.beginFrame(128, 128);
  renderer.drawAtlas({} as SkImageLike, [cmd]);
  renderer.endFrame();
  return modes;
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

// Literal Skia BlendMode values on purpose — importing the renderer's private
// constant would make the assertion tautological. SrcATop = 9 keeps the art's
// alpha (r = s·da + d·(1−sa)); SrcOver = 3 would paint transparent padding.
describe('tint / flash colour-filter blend mode (ADR-0009)', () => {
  it('tint builds its colour filter with SrcATop (9), not SrcOver', () => {
    expect(recordModes(makeCmd({ type: 'tint', color: WHITE, amount: 0.5 }))).toEqual([9]);
  });

  it('flash builds its colour filter with SrcATop (9), not SrcOver', () => {
    const flash: AnySpriteEffect = { type: 'flash', color: WHITE, duration: 1, elapsed: 0 };
    expect(recordModes(makeCmd(flash))).toEqual([9]);
  });

  it('tint on the stretch (drawImageRect) path also uses SrcATop (9)', () => {
    expect(recordModes(makeCmd({ type: 'tint', color: WHITE, amount: 0.5 }, true))).toEqual([9]);
  });

  it('outline keeps SrcIn (5) for its silhouette passes', () => {
    const modes = recordModes(makeCmd({ type: 'outline', color: WHITE, width: 1 }));
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) expect(mode).toBe(5);
  });
});
