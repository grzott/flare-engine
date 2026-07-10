import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import type { AnySpriteEffect, SpriteColor } from '../src/sprite-effects.js';
import { fog, updateEffect } from '../src/sprite-effects.js';

const gray: SpriteColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

describe('FogEffect', () => {
  it('fog() factory — defaults', () => {
    const e = fog(gray);
    expect(e.type).toBe('fog');
    expect(e.color).toBe(gray);
    expect(e.density).toBe(0.5);
    expect(e.speed).toBe(0.3);
    expect(e.scale).toBe(2.0);
  });

  it('fog() factory — explicit overrides', () => {
    const color: SpriteColor = { r: 0.1, g: 0.2, b: 0.3, a: 1 };
    const e = fog(color, 0.8, 1.2, 3.5);
    expect(e.type).toBe('fog');
    expect(e.color).toBe(color);
    expect(e.density).toBe(0.8);
    expect(e.speed).toBe(1.2);
    expect(e.scale).toBe(3.5);
  });

  it('updateEffect — fog is time-invariant', () => {
    const e = fog(gray, 0.6, 0.4, 1.5);
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 100)).toBe(e);
  });

  it('type discrimination — fog arm in switch over AnySpriteEffect', () => {
    const effects: AnySpriteEffect[] = [fog(gray, 0.8, 0.3, 2.0)];
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
          matched.push('water');
          break;
        case 'fog':
          matched.push(`fog:${e.density}`);
          break;
      }
    }
    expect(matched).toContain('fog:0.8');
  });
});

// ---------------------------------------------------------------------------
// Resolution plumbing — applyFog must pass real sprite dstW/H as resolution
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
            return 9;
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

function makeFogCmd(dstW: number, dstH: number): SpriteDrawCommand {
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
    effect: fog(gray, 0.6, 0.3, 2.0),
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
  };
}

describe('applyFog — resolution plumbing', () => {
  it('resolution uniforms [0] and [1] equal command dstW and dstH (not hardcoded 0)', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));
    renderer.beginFrame(128, 64, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFogCmd(96, 56)]);
    expect(captured).toHaveLength(1);
    expect(captured[0]![0]).toBe(96);
    expect(captured[0]![1]).toBe(56);
  });

  it('resolution uniforms are non-zero when dstW/H are positive', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));
    renderer.beginFrame(256, 256, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFogCmd(32, 32)]);
    expect(captured[0]![0]).toBeGreaterThan(0);
    expect(captured[0]![1]).toBeGreaterThan(0);
  });
});

describe('applyFog — time forwarding (slot 8)', () => {
  it('fog time uniform advances across consecutive beginFrame calls', () => {
    const captured: number[][] = [];
    const renderer = createFrameRenderer(makeRendererModule(captured));

    renderer.beginFrame(128, 64, 1.5, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFogCmd(32, 32)]);

    renderer.beginFrame(128, 64, 4.2, 1);
    renderer.drawAtlas({} as SkImageLike, [makeFogCmd(32, 32)]);

    expect(captured).toHaveLength(2);
    expect(captured[0]![8]).toBeCloseTo(1.5);
    expect(captured[1]![8]).toBeCloseTo(4.2);
    expect(captured[0]![8]).not.toBe(captured[1]![8]);
  });
});
