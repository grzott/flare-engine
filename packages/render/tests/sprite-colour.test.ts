import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike, RuntimeEffectLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import { Renderer } from '../src/renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { SpriteBatch } from '../src/sprite-batch.js';
import { outline, roofsCity, tint } from '../src/sprite-effects.js';

/** Skia `BlendMode.Modulate`. */
const MODULATE = 13;

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64, readPixels: () => null };
}

/** `drawRaw` with every argument between `alpha` and `color` left at its default. */
function drawColoured(
  batch: SpriteBatch,
  image: SkImageLike,
  x: number,
  alpha: number | undefined,
  color: number | undefined,
): void {
  batch.drawRaw(
    image,
    0,
    0,
    8,
    8,
    x,
    0,
    8,
    8,
    undefined,
    0,
    0,
    alpha,
    0,
    false,
    'normal',
    false,
    false,
    color,
  );
}

interface FlushCall {
  image: SkImageLike;
  count: number;
  argCount: number;
  colors: Uint32Array | undefined;
  /** The run's colours at call time; the buffer is reused by later runs. */
  colorData: number[] | undefined;
  alphas: number[];
}

function flushInto(batch: SpriteBatch, renderer?: Renderer): FlushCall[] {
  const calls: FlushCall[] = [];
  batch.flush((...args) => {
    const [image, commands, colors] = args;
    calls.push({
      image,
      count: commands.length,
      argCount: args.length,
      colors,
      colorData: colors === undefined ? undefined : Array.from(colors.subarray(0, commands.length)),
      alphas: commands.map((c) => c.alpha),
    });
  }, renderer);
  return calls;
}

// ---------------------------------------------------------------------------
// SpriteBatch — the colour buffer and the run key
// ---------------------------------------------------------------------------

describe('SpriteBatch per-sprite colour', () => {
  it('an uncoloured run still reaches the callback with two arguments', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    batch.drawRaw(image, 0, 0, 8, 8, 0, 0, 8, 8);
    batch.draw(image, { name: 'f', x: 0, y: 0, w: 8, h: 8 }, 8, 0);

    const calls = flushInto(batch);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argCount).toBe(2);
    expect(calls[0]?.colors).toBeUndefined();
  });

  it('uncoloured sprites with different alphas still split into one run per alpha', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 1, undefined);
    drawColoured(batch, image, 8, 0.5, undefined);
    drawColoured(batch, image, 16, 0.25, undefined);

    const calls = flushInto(batch);
    expect(calls.map((c) => c.count)).toEqual([1, 1, 1]);
    expect(calls.every((c) => c.colors === undefined)).toBe(true);
  });

  it('coloured sprites with distinct colours and alphas share one run', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 1, 0xffff0000);
    drawColoured(batch, image, 8, 0.5, 0xff00ff00);
    drawColoured(batch, image, 16, 0.25, 0xff0000ff);

    const calls = flushInto(batch);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.count).toBe(3);
    expect(calls[0]?.argCount).toBe(3);
    // alpha folds into the colour's alpha byte: 255, round(127.5), round(63.75).
    expect(calls[0]?.colorData).toEqual([0xffff0000, 0x8000ff00, 0x400000ff]);
  });

  it("alpha multiplies the colour's own alpha rather than replacing it", () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 0.5, 0x80ffffff);
    drawColoured(batch, image, 8, undefined, 0x80123456);

    const calls = flushInto(batch);
    expect(calls[0]?.colorData).toEqual([0x40ffffff, 0x80123456]);
  });

  it('alpha outside [0, 1] clamps instead of wrapping the alpha byte', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 2, 0xffabcdef);
    drawColoured(batch, image, 8, -1, 0xffabcdef);

    const calls = flushInto(batch);
    expect(calls[0]?.colorData).toEqual([0xffabcdef, 0x00abcdef]);
  });

  it('the command keeps the alpha it was given; only the colour buffer carries the fold', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 0.5, 0xffffffff);

    const calls = flushInto(batch);
    expect(calls[0]?.alphas).toEqual([0.5]);
  });

  it('an explicit opaque white is a coloured sprite: it joins a coloured run, not an uncoloured one', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 1, undefined);
    drawColoured(batch, image, 8, 1, 0xffffffff);
    drawColoured(batch, image, 16, 0.5, 0xffffffff);

    const calls = flushInto(batch);
    expect(calls.map((c) => c.count)).toEqual([1, 2]);
    expect(calls[0]?.colors).toBeUndefined();
    expect(calls[1]?.colorData).toEqual([0xffffffff, 0x80ffffff]);
  });

  it('coloured and uncoloured sprites never share a run, in either order', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 1, 0xffff0000);
    drawColoured(batch, image, 8, 1, undefined);
    drawColoured(batch, image, 16, 1, 0xff00ff00);

    const calls = flushInto(batch);
    expect(calls.map((c) => c.count)).toEqual([1, 1, 1]);
    expect(calls.map((c) => c.colorData)).toEqual([[0xffff0000], undefined, [0xff00ff00]]);
  });

  it('a coloured run still splits on image, effect, blend, stretch and flip', () => {
    const batch = new SpriteBatch();
    const a = mockImage();
    const b = mockImage();
    const fx = tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5);
    const red = 0xffff0000;
    batch.drawRaw(
      a,
      0,
      0,
      8,
      8,
      0,
      0,
      8,
      8,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      false,
      false,
      red,
    );
    batch.drawRaw(
      b,
      0,
      0,
      8,
      8,
      0,
      0,
      8,
      8,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      false,
      false,
      red,
    );
    batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 1, 0, false, 'normal', false, false, red);
    batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 1, 0, false, 'additive', false, false, red);
    batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 1, 0, true, 'additive', false, false, red);
    batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 1, 0, true, 'additive', true, false, red);
    batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 1, 0, true, 'additive', true, true, red);

    expect(flushInto(batch)).toHaveLength(7);
  });

  it('uncoloured sprites form the same runs whether or not the queue also holds a coloured one', () => {
    // A queue with a coloured sprite flushes through a different loop from one
    // without. Each key field changes once, so a loop that dropped one would
    // merge two of these runs.
    const a = mockImage();
    const b = mockImage();
    const fx = tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5);
    const queueUncoloured = (batch: SpriteBatch): void => {
      batch.drawRaw(a, 0, 0, 8, 8, 0, 0, 8, 8);
      batch.drawRaw(a, 0, 0, 8, 8, 8, 0, 8, 8);
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8);
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx);
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 0.5);
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 0.5, 0, true);
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 0.5, 0, true, 'additive');
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 0.5, 0, true, 'additive', true);
      batch.drawRaw(b, 0, 0, 8, 8, 0, 0, 8, 8, fx, 0, 0, 0.5, 0, true, 'additive', true, true);
    };

    const plain = new SpriteBatch();
    queueUncoloured(plain);
    const plainCalls = flushInto(plain);

    const mixed = new SpriteBatch();
    queueUncoloured(mixed);
    drawColoured(mixed, a, 0, 1, 0xffff0000);
    const mixedCalls = flushInto(mixed);

    expect(plainCalls.map((c) => c.count)).toEqual([2, 1, 1, 1, 1, 1, 1, 1]);
    expect(mixedCalls.slice(0, -1)).toEqual(plainCalls);
    expect(mixedCalls.at(-1)?.colorData).toEqual([0xffff0000]);
  });

  it('draw() takes the same trailing colour as drawRaw()', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    const f = { name: 'f', x: 0, y: 0, w: 8, h: 8 };
    batch.draw(
      image,
      f,
      0,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      0.5,
      0,
      false,
      'normal',
      false,
      false,
      0xff336699,
    );

    const calls = flushInto(batch);
    expect(calls[0]?.colorData).toEqual([0x80336699]);
  });

  it('a pooled command drawn uncoloured after a coloured frame is uncoloured again', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 0.5, 0xffff0000);
    flushInto(batch);

    drawColoured(batch, image, 0, 0.5, undefined);
    const calls = flushInto(batch);
    expect(calls[0]?.argCount).toBe(2);
    expect(calls[0]?.colors).toBeUndefined();
  });

  it('clear() drops queued colours along with their commands', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    drawColoured(batch, image, 0, 1, 0xffff0000);
    batch.clear();
    drawColoured(batch, image, 0, 1, undefined);
    drawColoured(batch, image, 8, 1, 0xff00ff00);

    const calls = flushInto(batch);
    expect(calls.map((c) => c.colorData)).toEqual([undefined, [0xff00ff00]]);
  });

  it('keeps every colour when the queue outgrows the colour buffer', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    const expected: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const color = (0xff000000 | i) >>> 0;
      expected.push(color);
      drawColoured(batch, image, i, 1, color);
    }

    const calls = flushInto(batch);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.colorData).toEqual(expected);
  });

  it('hands the callback the same colour buffer every frame once it is warm', () => {
    const batch = new SpriteBatch();
    const image = mockImage();
    const seen: (Uint32Array | undefined)[] = [];
    for (let frame = 0; frame < 4; frame++) {
      for (let i = 0; i < 300; i++) {
        drawColoured(batch, image, i, ((i + frame) % 100) / 100, (0xff000000 | (i * 7)) >>> 0);
      }
      seen.push(flushInto(batch)[0]?.colors);
    }
    expect(seen[0]).toBeInstanceOf(Uint32Array);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
    expect(seen[3]).toBe(seen[0]);
    // 300 commands allocated on the first frame, none after.
    expect(batch.allocCount).toBe(300);
  });

  it('N sprites with distinct colours and alphas draw in one run per image (Renderer.stats.drawCalls)', () => {
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    const imageA = mockImage();
    const imageB = mockImage();
    for (let i = 0; i < 200; i++) {
      drawColoured(batch, imageA, i, (i + 1) / 200, (0xff000000 | (i * 4099)) >>> 0);
    }
    for (let i = 0; i < 200; i++) {
      drawColoured(batch, imageB, i, (i + 1) / 200, (0xff000000 | (i * 8191)) >>> 0);
    }

    batch.flush(() => {}, renderer);
    expect(renderer.stats.drawCalls).toBe(2);
    expect(renderer.stats.batchCount).toBe(2);
  });

  it('the same sprites without a colour draw in one run per distinct alpha', () => {
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    const image = mockImage();
    for (let i = 0; i < 200; i++) drawColoured(batch, image, i, (i + 1) / 200, undefined);

    batch.flush(() => {}, renderer);
    expect(renderer.stats.drawCalls).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// FrameRenderer — what reaches the draw surface
// ---------------------------------------------------------------------------

interface AtlasCall {
  args: unknown[];
  paint: PaintLike;
  /** paint alpha at call time */
  alpha: number;
  blendMode: unknown;
  colors: Float32Array[] | undefined;
  /** Colour values at call time; the pooled arrays are overwritten by later runs. */
  colorData: number[][] | undefined;
  sampling: unknown;
}

interface RectCall {
  kind: 'drawImageRect' | 'drawRect';
  alpha: number;
}

interface Harness {
  module: FrameRendererModule;
  atlas: AtlasCall[];
  rects: RectCall[];
  factoryCalls: { rect: number; xform: number; paint: number; blend: number };
}

function makeHarness(): Harness {
  const atlas: AtlasCall[] = [];
  const rects: RectCall[] = [];
  const factoryCalls = { rect: 0, xform: 0, paint: 0, blend: 0 };
  const alphaOf = new WeakMap<PaintLike, number>();

  function makePaint(): PaintLike {
    const paint: PaintLike = {
      setAlphaf(a) {
        alphaOf.set(paint, a);
      },
      setColorFilter() {},
      setShader() {},
      setImageFilter() {},
    };
    alphaOf.set(paint, 1);
    return paint;
  }

  const canvas = {
    save: () => 0,
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clear() {},
    drawAtlas(...args: unknown[]) {
      const paint = args[3] as PaintLike;
      const colors = args[5] as Float32Array[] | undefined;
      atlas.push({
        args,
        paint,
        alpha: alphaOf.get(paint) ?? Number.NaN,
        blendMode: args[4],
        colors,
        colorData: colors?.map((c) => Array.from(c)),
        sampling: args[6],
      });
    },
    drawImageRect(_image: unknown, _src: unknown, _dst: unknown, paint: PaintLike) {
      rects.push({ kind: 'drawImageRect', alpha: alphaOf.get(paint) ?? Number.NaN });
    },
    drawRect(_rect: unknown, paint: PaintLike) {
      rects.push({ kind: 'drawRect', alpha: alphaOf.get(paint) ?? Number.NaN });
    },
  };

  const runtimeEffect: RuntimeEffectLike = {
    makeShader: () => ({}),
    getUniformCount: () => 0,
    getUniformFloatCount: () => 0,
    getUniformName: () => '',
    getUniform: (index: number) => ({ columns: 1, rows: 1, slot: index }),
  };

  const module: FrameRendererModule = {
    XYWHRect(x, y, w, h) {
      factoryCalls.rect++;
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
    RSXform(scos, ssin, tx, ty) {
      factoryCalls.xform++;
      const xf = {
        scos,
        ssin,
        tx,
        ty,
        set(a: number, b: number, c: number, d: number) {
          xf.scos = a;
          xf.ssin = b;
          xf.tx = c;
          xf.ty = d;
        },
      };
      return xf;
    },
    Paint() {
      factoryCalls.paint++;
      return makePaint();
    },
    PictureRecorder() {
      return {
        beginRecording: () => canvas,
        finishRecordingAsPicture: () => ({}),
      };
    },
    ColorFilter: {
      MakeBlend() {
        factoryCalls.blend++;
        return {};
      },
      MakeMatrix: () => ({}),
    },
    RuntimeEffect: { Make: () => runtimeEffect },
  };

  return { module, atlas, rects, factoryCalls };
}

function makeRun(n: number, overrides: Partial<SpriteDrawCommand> = {}): SpriteDrawCommand[] {
  const run: SpriteDrawCommand[] = [];
  for (let i = 0; i < n; i++) {
    run.push({
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 8,
      srcH: 8,
      dstX: i * 8,
      dstY: 0,
      dstW: 8,
      dstH: 8,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
      ...overrides,
    });
  }
  return run;
}

describe('FrameRenderer.drawAtlas colours', () => {
  it('an uncoloured run is still the four-argument surface call', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(mockImage(), makeRun(3, { alpha: 0.5 }));

    expect(h.atlas).toHaveLength(1);
    expect(h.atlas[0]?.args).toHaveLength(4);
    expect(h.atlas[0]?.alpha).toBe(0.5);
  });

  it('a coloured run passes Modulate and one [r, g, b, a] colour per sprite', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(
      mockImage(),
      makeRun(3),
      new Uint32Array([0xffff0000, 0x8000ff00, 0x403366cc]),
    );

    expect(h.atlas).toHaveLength(1);
    const call = h.atlas[0];
    expect(call?.args).toHaveLength(6);
    expect(call?.blendMode).toBe(MODULATE);
    expect(call?.colors).toHaveLength(3);
    for (const c of call?.colors ?? []) expect(c).toBeInstanceOf(Float32Array);
    const bytes = call?.colorData?.map((c) => c.map((v) => Math.round(v * 255)));
    expect(bytes).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 128],
      [0x33, 0x66, 0xcc, 64],
    ]);
  });

  it('reads only the first commands.length colours of a longer buffer', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    const colors = new Uint32Array(64).fill(0xffffffff);
    renderer.drawAtlas(mockImage(), makeRun(2), colors);

    expect(h.atlas[0]?.colors).toHaveLength(2);
  });

  it("opacity comes from the colours: the paint stays opaque and the commands' alpha is not read", () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(
      mockImage(),
      makeRun(2, { alpha: 0.25 }),
      new Uint32Array([0x80ffffff, 0xffffffff]),
    );

    expect(h.atlas[0]?.alpha).toBe(1);
  });

  it('an image with a sampling setting gets the seven-argument call, colours included', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const image = mockImage();
    renderer.setImageSampling(image, 'nearest');
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(image, makeRun(1), new Uint32Array([0xffff0000]));
    renderer.drawAtlas(image, makeRun(1));

    expect(h.atlas[0]?.args).toHaveLength(7);
    expect(h.atlas[0]?.blendMode).toBe(MODULATE);
    expect(h.atlas[0]?.colors).toHaveLength(1);
    expect(h.atlas[0]?.sampling).toEqual({ filter: 0 });
    // Uncoloured + sampled keeps its existing placeholders.
    expect(h.atlas[1]?.args).toHaveLength(7);
    expect(h.atlas[1]?.blendMode).toBeUndefined();
    expect(h.atlas[1]?.colors).toBeUndefined();
  });

  it('every byte survives the 0-1 float hop under both truncation and rounding', () => {
    // RN-Skia native casts `float * 255` to uint8 (truncation); CanvasKit's
    // ColorAsInt rounds. A colour byte must come back unchanged from both.
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    const colors = new Uint32Array(256);
    for (let k = 0; k < 256; k++) colors[k] = ((k << 24) | (k << 16) | (k << 8) | k) >>> 0;
    renderer.drawAtlas(mockImage(), makeRun(256), colors);

    const out = h.atlas[0]?.colors ?? [];
    expect(out).toHaveLength(256);
    for (let k = 0; k < 256; k++) {
      const c = out[k] as Float32Array;
      for (let ch = 0; ch < 4; ch++) {
        const v = c[ch] as number;
        expect(Math.trunc(Math.fround(v * 255))).toBe(k);
        expect(Math.round(v * 255)).toBe(k);
      }
    }
  });

  it('a steady-state coloured frame reuses every colour object and calls no Skia factory', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const batch = new SpriteBatch();
    const stats = new Renderer();
    const image = mockImage();
    const N = 300;

    function frame(t: number): void {
      renderer.beginFrame(64, 64);
      for (let i = 0; i < N; i++) {
        const fade = ((i * 13 + t * 7) % 256) / 255;
        drawColoured(batch, image, i, fade, (0xff000000 | ((i * 2654435761 + t) & 0xffffff)) >>> 0);
      }
      batch.flush(renderer.drawAtlas, stats);
      renderer.endFrame();
    }

    frame(0);
    frame(1);
    const warm = h.atlas[1];
    const warmElements = [...(warm?.colors ?? [])];
    const factories = { ...h.factoryCalls };
    const allocs = batch.allocCount;
    h.atlas.length = 0;

    for (let t = 2; t < 12; t++) frame(t);

    expect(h.atlas).toHaveLength(10);
    for (const call of h.atlas) {
      expect(call.colors).toBe(warm?.colors as Float32Array[]);
      expect(call.colors).toHaveLength(N);
      for (let i = 0; i < N; i++) expect(call.colors?.[i]).toBe(warmElements[i] as Float32Array);
    }
    expect(h.factoryCalls).toEqual(factories);
    expect(batch.allocCount).toBe(allocs);
    // The frames differ: the pooled colours are rewritten in place, not frozen.
    expect(h.atlas[0]?.colorData).not.toEqual(h.atlas[1]?.colorData);
  });

  it('runs of two lengths each keep their own colour array, sharing the pooled colours', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const image = mockImage();
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(image, makeRun(3), new Uint32Array([1, 2, 3]));
    renderer.drawAtlas(image, makeRun(5), new Uint32Array([4, 5, 6, 7, 8]));
    renderer.drawAtlas(image, makeRun(3), new Uint32Array([9, 10, 11]));

    const [a, b, c] = h.atlas;
    expect(a?.colors).toHaveLength(3);
    expect(b?.colors).toHaveLength(5);
    expect(c?.colors).toBe(a?.colors as Float32Array[]);
    expect(b?.colors?.[0]).toBe(a?.colors?.[0] as Float32Array);
  });

  it('a run longer than the per-length cache still gets exactly one colour per sprite', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const image = mockImage();
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(image, makeRun(300), new Uint32Array(300).fill(0xffffffff));
    renderer.drawAtlas(image, makeRun(301), new Uint32Array(301).fill(0xffffffff));
    renderer.drawAtlas(image, makeRun(301), new Uint32Array(301).fill(0xffffffff));

    expect(h.atlas.map((c) => c.colors?.length)).toEqual([300, 301, 301]);
    expect(h.atlas[2]?.colors).toBe(h.atlas[1]?.colors as Float32Array[]);
  });

  it('an effect keeps its paint and the colours ride along', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const fx = tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(mockImage(), makeRun(2), new Uint32Array([0xffffffff, 0x80ffffff]));
    renderer.drawAtlas(
      mockImage(),
      makeRun(2, { effect: fx }),
      new Uint32Array([0xffffffff, 0x80ffffff]),
    );

    expect(h.atlas[1]?.paint).not.toBe(h.atlas[0]?.paint as PaintLike);
    expect(h.atlas[1]?.blendMode).toBe(MODULATE);
    expect(h.atlas[1]?.colors).toHaveLength(2);
    expect(h.factoryCalls.blend).toBe(1);
  });

  it('an outlined coloured run passes the colours to the silhouette passes and the main pass', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const fx = outline({ r: 0, g: 0, b: 0, a: 1 }, 1);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(
      mockImage(),
      makeRun(2, { effect: fx }),
      new Uint32Array([0xffff0000, 0x80ff0000]),
    );

    expect(h.atlas).toHaveLength(9);
    for (const call of h.atlas) {
      expect(call.blendMode).toBe(MODULATE);
      expect(call.colors).toHaveLength(2);
      expect(call.alpha).toBe(1);
    }
  });

  it("the stretch path draws each sprite at its own colour's alpha", () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(
      mockImage(),
      makeRun(3, { stretch: true }),
      new Uint32Array([0xffff0000, 0x80ff0000, 0x00ff0000]),
    );

    expect(h.atlas).toHaveLength(0);
    expect(h.rects.map((r) => r.kind)).toEqual(['drawImageRect', 'drawImageRect', 'drawImageRect']);
    expect(h.rects[0]?.alpha).toBe(1);
    expect(h.rects[1]?.alpha).toBeCloseTo(128 / 255, 6);
    expect(h.rects[2]?.alpha).toBe(0);
  });

  it("the zone-background path draws each rect at its own colour's alpha", () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    renderer.beginFrame(64, 64);
    renderer.drawAtlas(
      mockImage(),
      makeRun(2, {
        effect: roofsCity({
          skyColor: { r: 0, g: 0, b: 1, a: 1 },
          roofColor: { r: 0, g: 0, b: 0, a: 1 },
        }),
      }),
      new Uint32Array([0xffffffff, 0x40ffffff]),
    );

    expect(h.atlas).toHaveLength(0);
    expect(h.rects.map((r) => r.kind)).toEqual(['drawRect', 'drawRect']);
    expect(h.rects[0]?.alpha).toBe(1);
    expect(h.rects[1]?.alpha).toBeCloseTo(64 / 255, 6);
  });

  it('SpriteBatch.flush(renderer.drawAtlas) carries colours end to end in one surface call', () => {
    const h = makeHarness();
    const renderer = createFrameRenderer(h.module);
    const stats = new Renderer();
    const batch = new SpriteBatch();
    const image = mockImage();
    renderer.beginFrame(64, 64);
    drawColoured(batch, image, 0, 1, 0xffff0000);
    drawColoured(batch, image, 8, 0.5, 0xff0000ff);
    batch.flush(renderer.drawAtlas, stats);

    expect(stats.stats.drawCalls).toBe(1);
    expect(h.atlas).toHaveLength(1);
    const bytes = h.atlas[0]?.colorData?.map((c) => c.map((v) => Math.round(v * 255)));
    expect(bytes).toEqual([
      [255, 0, 0, 255],
      [0, 0, 255, 128],
    ]);
  });
});
