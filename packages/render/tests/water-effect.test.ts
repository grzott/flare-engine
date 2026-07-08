import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { updateEffect, water } from '../src/sprite-effects.js';
import type { AnySpriteEffect, SpriteColor } from '../src/sprite-effects.js';

const blue: SpriteColor = { r: 0.1, g: 0.3, b: 0.8, a: 1 };
const white: SpriteColor = { r: 1, g: 1, b: 1, a: 1 };

describe('WaterEffect', () => {
  it('water() factory returns correct shape', () => {
    const e = water(blue, white, 1.5, 0.02);
    expect(e.type).toBe('water');
    expect(e.color).toBe(blue);
    expect(e.foamColor).toBe(white);
    expect(e.waveSpeed).toBe(1.5);
    expect(e.waveAmplitude).toBe(0.02);
  });

  it('updateEffect returns same reference for water (time-invariant)', () => {
    const e = water(blue, white, 1.5, 0.02);
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 100)).toBe(e);
  });

  it('type discriminates in a switch over AnySpriteEffect including water arm', () => {
    const effects: AnySpriteEffect[] = [water(blue, white, 2.0, 0.05)];
    const matched: string[] = [];
    for (const e of effects) {
      switch (e.type) {
        case 'tint':
          matched.push('tint');
          break;
        case 'flash':
          matched.push('flash');
          break;
        case 'grayscale':
          matched.push('grayscale');
          break;
        case 'outline':
          matched.push('outline');
          break;
        case 'custom':
          matched.push('custom');
          break;
        case 'water':
          matched.push(`water:${e.waveSpeed}`);
          break;
      }
    }
    expect(matched).toEqual(['water:2']);
  });
});

// ---------------------------------------------------------------------------
// Resolution plumbing — applyWater must pass real sprite dstW/H as resolution
// uniforms slots 0 and 1. Old code hardcoded 0, causing div-by-zero in SkSL.
// ---------------------------------------------------------------------------

function makeRendererModule(capturedUniforms: number[][]): FrameRendererModule {
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
    RuntimeEffect: {
      Make(_sksl: string) {
        return {
          makeShader(uniforms: number[]) {
            capturedUniforms.push([...uniforms]);
            return {};
          },
          getUniformCount() {
            return 0;
          },
          getUniformFloatCount() {
            return 11;
          },
          getUniformName(_i: number) {
            return '';
          },
          getUniform(_i: number) {
            return { columns: 1, rows: 1, slot: _i };
          },
        };
      },
    },
  };
}

function makeWaterCmd(dstW: number, dstH: number): SpriteDrawCommand {
  return {
    image: {} as SkImageLike,
    srcX: 0,
    srcY: 0,
    srcW: 32,
    srcH: 32,
    dstX: 0,
    dstY: 0,
    dstW,
    dstH,
    effect: water(blue, white, 1.0, 0.05),
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
  };
}

describe('applyWater — resolution plumbing', () => {
  it('resolution uniforms [0] and [1] equal command dstW and dstH (not hardcoded 0)', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));
    renderer.beginFrame(128, 64, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeWaterCmd(80, 48)]);
    expect(captured).toHaveLength(1);
    expect(captured[0]![0]).toBe(80);
    expect(captured[0]![1]).toBe(48);
  });

  it('resolution uniforms are non-zero when dstW/H are positive', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));
    renderer.beginFrame(256, 256, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeWaterCmd(64, 64)]);
    expect(captured[0]![0]).toBeGreaterThan(0);
    expect(captured[0]![1]).toBeGreaterThan(0);
  });
});
