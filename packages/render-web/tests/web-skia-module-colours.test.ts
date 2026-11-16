import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { DrawSurfaceLike, PaintLike, RectLike, RSXformLike } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from '../src/web-skia-module.js';

/** Skia `BlendMode.Modulate`, as the frame renderer passes it. */
const MODULATE = 13;

interface AtlasCall {
  argCount: number;
  blendMode: unknown;
  /** The object handed to CanvasKit, for identity checks. */
  colors: unknown;
  /** Its contents at call time; the scratch buffer is overwritten by later runs. */
  colorData: number[] | null;
  sampling: unknown;
}

const CK_MODULATE = { name: 'Modulate' };
const CK_NEAREST = { name: 'Nearest' };

function setup(): {
  surface: DrawSurfaceLike;
  paint: PaintLike;
  calls: AtlasCall[];
  run(n: number): { srcs: RectLike[]; xforms: RSXformLike[] };
} {
  const calls: AtlasCall[] = [];
  const canvas = {
    drawAtlas(...args: unknown[]) {
      const colors = args[5];
      calls.push({
        argCount: args.length,
        blendMode: args[4],
        colors,
        colorData: colors instanceof Uint32Array ? Array.from(colors) : null,
        sampling: args[6],
      });
    },
  };
  const kit = {
    FilterMode: { Nearest: CK_NEAREST, Linear: { name: 'Linear' } },
    MipmapMode: { None: { name: 'None' }, Nearest: {}, Linear: {} },
    BlendMode: { SrcOver: {}, SrcIn: {}, SrcATop: {}, Plus: {}, Modulate: CK_MODULATE },
    XYWHRect: (x: number, y: number, w: number, h: number) =>
      new Float32Array([x, y, x + w, y + h]),
    Paint: class {
      setAlphaf() {}
      setColorFilter() {}
      setShader() {}
      setImageFilter() {}
      setBlendMode() {}
    },
    PictureRecorder: class {
      beginRecording() {
        return canvas;
      }
      finishRecordingAsPicture() {
        return {};
      }
    },
  } as unknown as CanvasKit;

  const mod = createWebSkiaModule(kit);
  const surface = mod.PictureRecorder().beginRecording(mod.XYWHRect(0, 0, 64, 64));
  return {
    surface,
    paint: mod.Paint(),
    calls,
    run(n) {
      const srcs: RectLike[] = [];
      const xforms: RSXformLike[] = [];
      for (let i = 0; i < n; i++) {
        srcs.push(mod.XYWHRect(i, 0, 8, 8));
        xforms.push(mod.RSXform(1, 0, i * 8, 0));
      }
      return { srcs, xforms };
    },
  };
}

const IMAGE = {} as SkImageLike;

/** `[r, g, b, a]` floats for a packed ARGB, as the frame renderer builds them. */
function unpack(argb: number): Float32Array {
  return new Float32Array([
    ((argb >>> 16) & 0xff) / 255,
    ((argb >>> 8) & 0xff) / 255,
    (argb & 0xff) / 255,
    (argb >>> 24) / 255,
  ]);
}

describe('createWebSkiaModule drawAtlas colours', () => {
  it('an uncoloured run still passes null for the blend mode and the colours', () => {
    const { surface, paint, calls, run } = setup();
    const { srcs, xforms } = run(2);
    surface.drawAtlas(IMAGE, srcs, xforms, paint);

    expect(calls[0]?.argCount).toBe(6);
    expect(calls[0]?.blendMode).toBeNull();
    expect(calls[0]?.colors).toBeNull();
  });

  it('a coloured run passes CanvasKit Modulate and one packed ARGB per sprite', () => {
    const { surface, paint, calls, run } = setup();
    const { srcs, xforms } = run(3);
    const packed = [0xffff0000, 0x8000ff00, 0x403366cc];
    surface.drawAtlas(IMAGE, srcs, xforms, paint, MODULATE, packed.map(unpack));

    expect(calls[0]?.blendMode).toBe(CK_MODULATE);
    expect(calls[0]?.colors).toBeInstanceOf(Uint32Array);
    expect(calls[0]?.colorData).toEqual(packed);
  });

  it('every byte value survives the float hop', () => {
    const { surface, paint, calls, run } = setup();
    const { srcs, xforms } = run(256);
    const packed: number[] = [];
    for (let k = 0; k < 256; k++) packed.push(((k << 24) | (k << 16) | (k << 8) | k) >>> 0);
    surface.drawAtlas(IMAGE, srcs, xforms, paint, MODULATE, packed.map(unpack));

    expect(calls[0]?.colorData).toEqual(packed);
  });

  it('keeps the sampling argument after the colours', () => {
    const { surface, paint, calls, run } = setup();
    const { srcs, xforms } = run(1);
    surface.drawAtlas(IMAGE, srcs, xforms, paint, MODULATE, [unpack(0xffffffff)], { filter: 0 });

    expect(calls[0]?.argCount).toBe(7);
    expect(calls[0]?.blendMode).toBe(CK_MODULATE);
    expect(calls[0]?.colorData).toEqual([0xffffffff]);
    expect(calls[0]?.sampling).toEqual({ filter: CK_NEAREST, mipmap: { name: 'None' } });
  });

  it('hands CanvasKit the same colour view for two runs of the same length', () => {
    const { surface, paint, calls, run } = setup();
    const { srcs, xforms } = run(3);
    surface.drawAtlas(IMAGE, srcs, xforms, paint, MODULATE, [1, 2, 3].map(unpack));
    surface.drawAtlas(IMAGE, srcs, xforms, paint, MODULATE, [4, 5, 6].map(unpack));

    expect(calls[1]?.colors).toBe(calls[0]?.colors);
    expect(calls[0]?.colorData).toEqual([1, 2, 3]);
    expect(calls[1]?.colorData).toEqual([4, 5, 6]);
  });

  it('gives a run of another length its own view, and keeps the first', () => {
    const { surface, paint, calls, run } = setup();
    const three = run(3);
    const five = run(5);
    surface.drawAtlas(IMAGE, three.srcs, three.xforms, paint, MODULATE, [1, 2, 3].map(unpack));
    surface.drawAtlas(IMAGE, five.srcs, five.xforms, paint, MODULATE, [1, 2, 3, 4, 5].map(unpack));
    surface.drawAtlas(IMAGE, three.srcs, three.xforms, paint, MODULATE, [7, 8, 9].map(unpack));

    expect(calls[1]?.colorData).toHaveLength(5);
    expect(calls[1]?.colors).not.toBe(calls[0]?.colors);
    expect(calls[2]?.colors).toBe(calls[0]?.colors);
    expect(calls[2]?.colorData).toEqual([7, 8, 9]);
  });

  it('cuts a fresh view over the grown buffer once a run outgrows the scratch space', () => {
    const { surface, paint, calls, run } = setup();
    const small = run(4);
    // The scratch buffers start at 32 sprites; 40 forces a reallocation.
    const big = run(40);
    const colours = (n: number): Float32Array[] =>
      Array.from({ length: n }, (_, i) => unpack((0xff000000 | i) >>> 0));

    surface.drawAtlas(IMAGE, small.srcs, small.xforms, paint, MODULATE, colours(4));
    surface.drawAtlas(IMAGE, big.srcs, big.xforms, paint, MODULATE, colours(40));
    surface.drawAtlas(IMAGE, small.srcs, small.xforms, paint, MODULATE, colours(4));
    surface.drawAtlas(IMAGE, small.srcs, small.xforms, paint, MODULATE, colours(4));

    const [a, b, c, d] = calls.map((call) => call.colors as Uint32Array);
    expect(b?.length).toBe(40);
    expect(calls[1]?.colorData?.[39]).toBe(0xff000027);
    expect(b?.buffer).not.toBe(a?.buffer as ArrayBufferLike);
    expect(c).not.toBe(a as Uint32Array);
    expect(c?.buffer).toBe(b?.buffer as ArrayBufferLike);
    expect(d).toBe(c as Uint32Array);
  });
});
