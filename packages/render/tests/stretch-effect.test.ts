/**
 * Verifies that the stretch branch in frame-renderer routes effects correctly:
 *
 * - stretch + shader effect (water/custom): resolveEffectPaint() is used so
 *   the effect shader reaches drawImageRect — the fix under test.
 * - stretch + outline: outline requires two passes (SRC_IN silhouette + source)
 *   incompatible with the single drawImageRect stretch path; falls back to the
 *   plain stretchPaint (no shader) — regression guard for fix #1.
 * - stretch + undefined effect: plain stretchPaint, no shader.
 */
import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { outline, water } from '../src/sprite-effects.js';

// A PaintLike with an extra `_shaderSet` flag for assertions.
type TrackPaint = PaintLike & { _shaderSet: boolean };

function makePaint(): TrackPaint {
  const p: TrackPaint = {
    _shaderSet: false,
    setAlphaf() {},
    setColorFilter() {},
    setShader() {
      p._shaderSet = true;
    },
    setImageFilter() {},
  };
  return p;
}

function makeStretchTestModule(): {
  mod: FrameRendererModule;
  drawImageRectPaints: TrackPaint[];
} {
  const drawImageRectPaints: TrackPaint[] = [];

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
    drawRect() {},
    drawImageRect(_img: unknown, _src: unknown, _dst: unknown, paint: unknown) {
      drawImageRectPaints.push(paint as TrackPaint);
    },
  };

  const mod: FrameRendererModule = {
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
    Paint: makePaint,
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
          makeShader(_uniforms: number[]) {
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

  return { mod, drawImageRectPaints };
}

function stretchCmd(partial: Partial<SpriteDrawCommand> = {}): SpriteDrawCommand {
  return {
    image: {} as SkImageLike,
    srcX: 0,
    srcY: 0,
    srcW: 32,
    srcH: 32,
    dstX: 0,
    dstY: 0,
    dstW: 64,
    dstH: 64,
    effect: undefined,
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: true,
    ...partial,
  };
}

describe('frame-renderer — stretch branch effect routing', () => {
  it('stretch + water: resolveEffectPaint used — setShader reaches the drawImageRect paint', () => {
    const { mod, drawImageRectPaints } = makeStretchTestModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 64, 1.0, 1);
    renderer.drawAtlas({} as SkImageLike, [
      stretchCmd({
        effect: water({ r: 0.1, g: 0.3, b: 0.8, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 1.0, 0.05),
      }),
    ]);

    expect(drawImageRectPaints).toHaveLength(1);
    expect(drawImageRectPaints[0]!._shaderSet).toBe(true);
  });

  it('stretch + outline: falls back to plain stretchPaint — no shader on drawImageRect paint', () => {
    const { mod, drawImageRectPaints } = makeStretchTestModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 64, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [
      stretchCmd({
        effect: outline({ r: 0, g: 0, b: 0, a: 1 }, 2),
      }),
    ]);

    expect(drawImageRectPaints).toHaveLength(1);
    expect(drawImageRectPaints[0]!._shaderSet).toBe(false);
  });

  it('stretch + undefined effect: plain stretchPaint — no shader on drawImageRect paint', () => {
    const { mod, drawImageRectPaints } = makeStretchTestModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 64, 0, 1);
    renderer.drawAtlas({} as SkImageLike, [stretchCmd({ effect: undefined })]);

    expect(drawImageRectPaints).toHaveLength(1);
    expect(drawImageRectPaints[0]!._shaderSet).toBe(false);
  });
});
