/**
 * `setImageSampling(image, mode)` follows the image onto every draw of it:
 * the atlas path gets the sampling object as `drawAtlas`'s 7th argument (RN
 * Skia's order — blendMode and colors stay `undefined`), the stretch/flip path
 * is routed to `drawImageRectOptions(image, src, dst, filter, mipmap, paint)`.
 * An image without a setting makes exactly today's calls, so each path keeps
 * its own Skia default.
 */
import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type {
  DrawSurfaceLike,
  FrameRendererModule,
  ImageSampling,
  PaintLike,
  SamplingOptionsLike,
} from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { outline, tint } from '../src/sprite-effects.js';

interface Call {
  method: 'drawAtlas' | 'drawImageRect' | 'drawImageRectOptions';
  args: unknown[];
}

function makePaint(): PaintLike {
  return {
    setAlphaf() {},
    setColorFilter() {},
    setShader() {},
    setImageFilter() {},
    setBlendMode() {},
  };
}

function makeRecordingModule(opts: { withImageRectOptions: boolean }): {
  mod: FrameRendererModule;
  calls: Call[];
} {
  const calls: Call[] = [];

  const plain: DrawSurfaceLike = {
    save() {
      return 0;
    },
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clear() {},
    drawRect() {},
    drawAtlas(...args: unknown[]) {
      calls.push({ method: 'drawAtlas', args });
    },
    drawImageRect(...args: unknown[]) {
      calls.push({ method: 'drawImageRect', args });
    },
  };
  const canvas: DrawSurfaceLike = opts.withImageRectOptions
    ? {
        ...plain,
        drawImageRectOptions(...args: unknown[]) {
          calls.push({ method: 'drawImageRectOptions', args });
        },
      }
    : plain;

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
    RSXform() {
      return { scos: 1, ssin: 0, tx: 0, ty: 0, set() {} };
    },
    Paint: makePaint,
    PictureRecorder() {
      return {
        beginRecording() {
          return canvas;
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

  return { mod, calls };
}

function image(): SkImageLike {
  return { width: () => 2, height: () => 1 } as unknown as SkImageLike;
}

function cmdOf(img: SkImageLike, o: Partial<SpriteDrawCommand> = {}): SpriteDrawCommand {
  return {
    image: img,
    srcX: 0,
    srcY: 0,
    srcW: 16,
    srcH: 16,
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
    ...o,
  };
}

function byMethod(calls: Call[], method: Call['method']): Call[] {
  return calls.filter((c) => c.method === method);
}

function samplingOf(call: Call): SamplingOptionsLike {
  return call.args[6] as SamplingOptionsLike;
}

describe('frame-renderer — setImageSampling', () => {
  it("'nearest' puts the filter-0 sampling object in drawAtlas's 7th slot on the plain atlas draw", () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img)]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(1);
    expect(atlas[0]!.args).toHaveLength(7);
    expect(atlas[0]!.args[0]).toBe(img);
    expect(atlas[0]!.args[4]).toBeUndefined();
    expect(atlas[0]!.args[5]).toBeUndefined();
    expect(samplingOf(atlas[0]!)).toEqual({ filter: 0 });
  });

  it("'nearest' reaches every one of the 9 outline drawAtlas calls", () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img, { effect: outline({ r: 0, g: 0, b: 0, a: 1 }, 1) })]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(9);
    for (const call of atlas) {
      expect(call.args).toHaveLength(7);
      expect(samplingOf(call).filter).toBe(0);
    }
  });

  it("'nearest' reaches an effect draw (tint)", () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img, { effect: tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5) })]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(1);
    expect(samplingOf(atlas[0]!).filter).toBe(0);
  });

  it("'nearest' routes a stretch draw and a flipX draw to drawImageRectOptions(filter 0, mipmap 0)", () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img, { stretch: true, dstW: 48 })]);
    renderer.drawAtlas(img, [cmdOf(img, { flipX: true })]);

    expect(byMethod(calls, 'drawImageRect')).toHaveLength(0);
    const sampled = byMethod(calls, 'drawImageRectOptions');
    expect(sampled).toHaveLength(2);
    for (const call of sampled) {
      expect(call.args).toHaveLength(6);
      expect(call.args[0]).toBe(img);
      expect(call.args[3]).toBe(0);
      expect(call.args[4]).toBe(0);
    }
  });

  it("'linear' gives filter 1 on both the atlas and the stretch path", () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'linear');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img)]);
    renderer.drawAtlas(img, [cmdOf(img, { stretch: true })]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(1);
    expect(samplingOf(atlas[0]!)).toEqual({ filter: 1 });
    const sampled = byMethod(calls, 'drawImageRectOptions');
    expect(sampled).toHaveLength(1);
    expect(sampled[0]!.args[3]).toBe(1);
    expect(sampled[0]!.args[4]).toBe(0);
  });

  it('an unset image makes exactly the previous calls: 4-arg drawAtlas, drawImageRect only', () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img)]);
    renderer.drawAtlas(img, [cmdOf(img, { effect: outline({ r: 0, g: 0, b: 0, a: 1 }, 1) })]);
    renderer.drawAtlas(img, [cmdOf(img, { stretch: true })]);
    renderer.drawAtlas(img, [cmdOf(img, { flipY: true })]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(10);
    for (const call of atlas) expect(call.args).toHaveLength(4);
    expect(byMethod(calls, 'drawImageRect')).toHaveLength(2);
    expect(byMethod(calls, 'drawImageRectOptions')).toHaveLength(0);
  });

  it('passes the same sampling object instance across two frames', () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img)]);
    renderer.endFrame();
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img)]);
    renderer.endFrame();

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(2);
    expect(samplingOf(atlas[0]!)).toBe(samplingOf(atlas[1]!));
  });

  it('setting image A leaves image B unset in the same frame', () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const a = image();
    const b = image();
    renderer.setImageSampling(a, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(a, [cmdOf(a)]);
    renderer.drawAtlas(b, [cmdOf(b)]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(2);
    expect(atlas[0]!.args[0]).toBe(a);
    expect(atlas[0]!.args).toHaveLength(7);
    expect(atlas[1]!.args[0]).toBe(b);
    expect(atlas[1]!.args).toHaveLength(4);
  });

  it('the last call wins (nearest, then linear)', () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');
    renderer.setImageSampling(img, 'linear');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img)]);

    const atlas = byMethod(calls, 'drawAtlas');
    expect(atlas).toHaveLength(1);
    expect(samplingOf(atlas[0]!).filter).toBe(1);
  });

  it('a surface without drawImageRectOptions falls back to drawImageRect for a nearest image', () => {
    const { mod, calls } = makeRecordingModule({ withImageRectOptions: false });
    const renderer = createFrameRenderer(mod);
    const img = image();
    renderer.setImageSampling(img, 'nearest');

    renderer.beginFrame(64, 64);
    renderer.drawAtlas(img, [cmdOf(img, { stretch: true })]);

    expect(byMethod(calls, 'drawImageRectOptions')).toHaveLength(0);
    const plain = byMethod(calls, 'drawImageRect');
    expect(plain).toHaveLength(1);
    expect(plain[0]!.args).toHaveLength(4);
  });

  it('an unknown mode throws RangeError naming the value', () => {
    const { mod } = makeRecordingModule({ withImageRectOptions: true });
    const renderer = createFrameRenderer(mod);
    const img = image();
    const bad = 'cubic' as unknown as ImageSampling;

    expect(() => renderer.setImageSampling(img, bad)).toThrow(RangeError);
    expect(() => renderer.setImageSampling(img, bad)).toThrow('cubic');
  });
});
