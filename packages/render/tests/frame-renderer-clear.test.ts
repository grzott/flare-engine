import { describe, expect, it } from 'bun:test';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';

function makeModule(cleared: number[][]): FrameRendererModule {
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
    clear(color: Float32Array) {
      cleared.push([...color]);
    },
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
    RSXform() {
      return { scos: 0, ssin: 0, tx: 0, ty: 0, set() {} };
    },
    Paint() {
      return fakePaint;
    },
    PictureRecorder() {
      return {
        beginRecording() {
          return fakeCanvas;
        },
        finishRecordingAsPicture() {
          return {};
        },
      };
    },
    ColorFilter: {
      MakeBlend() {
        return {};
      },
      MakeMatrix() {
        return {};
      },
    },
  };
}

describe('frame renderer canvas.clear', () => {
  it('unpacks the 0xAARRGGBB colour into [r, g, b, a] for the recording canvas', () => {
    const cleared: number[][] = [];
    const renderer = createFrameRenderer(makeModule(cleared));
    renderer.beginFrame(64, 64);
    const f = (byte: number) => Math.fround(byte / 255);

    renderer.canvas.clear(0x80ff0000);
    renderer.canvas.clear(0xc0336699);

    expect(cleared).toEqual([
      [1, 0, 0, f(0x80)],
      [f(0x33), f(0x66), f(0x99), f(0xc0)],
    ]);
  });
});
