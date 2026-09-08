import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import {
  type AnySpriteEffect,
  type FireEffect,
  fire,
  updateEffect,
} from '../src/sprite-effects.js';

describe('fire effect', () => {
  it('fire() with required args applies defaults for speed and intensity', () => {
    const color = { r: 1, g: 0.4, b: 0, a: 1 };
    const tipColor = { r: 1, g: 1, b: 0, a: 1 };
    const effect = fire({ color, tipColor });
    expect(effect.type).toBe('fire');
    expect(effect.color).toBe(color);
    expect(effect.tipColor).toBe(tipColor);
    expect(effect.speed).toBe(1.0);
    expect(effect.intensity).toBe(0.8);
  });

  it('fire() with explicit overrides passes speed and intensity through', () => {
    const effect = fire({
      color: { r: 1, g: 0, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
      speed: 2.5,
      intensity: 0.5,
    });
    expect(effect.speed).toBe(2.5);
    expect(effect.intensity).toBe(0.5);
  });

  it('updateEffect for fire is time-invariant — returns the same reference', () => {
    const effect: FireEffect = fire({
      color: { r: 1, g: 0, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
    });
    const result1 = updateEffect(effect, 0.016);
    const result2 = updateEffect(effect, 99);
    expect(result1).toBe(effect);
    expect(result2).toBe(effect);
  });

  it('AnySpriteEffect fire arm — switch over array including fire executes the arm', () => {
    const effects: AnySpriteEffect[] = [
      fire({ color: { r: 1, g: 0, b: 0, a: 1 }, tipColor: { r: 1, g: 1, b: 0, a: 1 } }),
    ];
    let fireHit = false;
    for (const e of effects) {
      switch (e.type) {
        case 'fire':
          fireHit = true;
          break;
        default:
          break;
      }
    }
    expect(fireHit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resolution plumbing — applyFire must pass real sprite dstW/H as resolution
// uniforms slots 0 and 1. Old code hardcoded 0.
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

function makeFireCmd(dstW: number, dstH: number): SpriteDrawCommand {
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
    effect: fire({ color: { r: 1, g: 0.3, b: 0, a: 1 }, tipColor: { r: 1, g: 1, b: 0, a: 1 } }),
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
    blend: 'normal',
    flipX: false,
    flipY: false,
  };
}

describe('applyFire — resolution plumbing', () => {
  it('resolution uniforms [0] and [1] equal command dstW and dstH (not hardcoded 0)', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));
    renderer.beginFrame(128, 64, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFireCmd(72, 40)]);
    expect(captured).toHaveLength(1);
    expect(captured[0]![0]).toBe(72);
    expect(captured[0]![1]).toBe(40);
  });

  it('resolution uniforms are non-zero when dstW/H are positive', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));
    renderer.beginFrame(256, 256, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFireCmd(48, 48)]);
    expect(captured[0]![0]).toBeGreaterThan(0);
    expect(captured[0]![1]).toBeGreaterThan(0);
  });
});

describe('applyFire — time forwarding (slot 10)', () => {
  it('fire time uniform advances across consecutive beginFrame calls', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));

    renderer.beginFrame(128, 64, 2.0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFireCmd(32, 32)]);

    renderer.beginFrame(128, 64, 5.5, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFireCmd(32, 32)]);

    expect(captured).toHaveLength(2);
    expect(captured[0]![10]).toBeCloseTo(2.0);
    expect(captured[1]![10]).toBeCloseTo(5.5);
    expect(captured[0]![10]).not.toBe(captured[1]![10]);
  });
});
