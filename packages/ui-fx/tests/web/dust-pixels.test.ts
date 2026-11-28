/**
 * Real-pixel test for the dust shader: `DUST_SKSL` is compiled by a real CanvasKit, drawn on a
 * CPU surface the way the web effect draws it, and the rasterized bytes are read back.
 *
 * The mock-kit tests in `dust.test.ts` pin what the effect calls. This pins that the SkSL
 * compiles, that `packDustUniformsInto` matches the layout the compiler gives the uniforms, and
 * what the shader then draws.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import type { CanvasKit, Image as CKImage, RuntimeEffect } from 'canvaskit-wasm';
import { type DustPreset, dust } from '../../src/core/presets';
import {
  DUST_SKSL,
  DUST_UNIFORM_FLOATS,
  DUST_UNIFORMS,
  packDustUniformsInto,
} from '../../src/core/sksl';

const WASM_PATH = resolve(
  import.meta.dir,
  '../../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

const W = 100;
const H = 40;
const PADDING = 8;
const PIXEL_RATIO = 2;

let kit: CanvasKit;
let effect: RuntimeEffect;
let compileError = '';
/** An opaque red element, captured at 2x with 8 clear layout pixels around it. */
let capture: CKImage;

beforeAll(async () => {
  const { default: initCK } = await import('canvaskit-wasm/bin/full/canvaskit.js');
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  kit = await initCK({ locateFile: () => WASM_PATH, wasmBinary });

  const made = kit.RuntimeEffect.Make(DUST_SKSL, (message) => {
    compileError = message;
  });
  if (made === null) throw new Error(`DUST_SKSL did not compile: ${compileError}`);
  effect = made;

  const surface = kit.MakeSurface((W + 2 * PADDING) * PIXEL_RATIO, (H + 2 * PADDING) * PIXEL_RATIO);
  if (surface === null) throw new Error('no CPU surface');
  surface.getCanvas().clear(kit.TRANSPARENT);
  const red = new kit.Paint();
  red.setColor(kit.Color4f(1, 0, 0, 1));
  surface
    .getCanvas()
    .drawRect(
      kit.LTRBRect(
        PADDING * PIXEL_RATIO,
        PADDING * PIXEL_RATIO,
        (PADDING + W) * PIXEL_RATIO,
        (PADDING + H) * PIXEL_RATIO,
      ),
      red,
    );
  capture = surface.makeImageSnapshot();
}, 30_000);

interface Drawn {
  width: number;
  /** RGBA bytes, unpremultiplied, of the rect grown by `spread`. */
  pixels: Uint8Array;
  spread: number;
}

/** Draws the enlarged rect of `preset` at `progress`, as the web effect does. */
function draw(preset: DustPreset, progress: number): Drawn {
  const { spread } = preset;
  const width = W + 2 * spread;
  const height = H + 2 * spread;
  const surface = kit.MakeSurface(width, height);
  if (surface === null) throw new Error('no CPU surface');
  const child = capture.makeShaderOptions(
    kit.TileMode.Decal,
    kit.TileMode.Decal,
    kit.FilterMode.Linear,
    kit.MipmapMode.None,
    [1 / PIXEL_RATIO, 0, -PADDING, 0, 1 / PIXEL_RATIO, -PADDING, 0, 0, 1],
  );
  const uniforms = packDustUniformsInto(
    preset,
    progress,
    W,
    H,
    new Float32Array(DUST_UNIFORM_FLOATS),
  );
  const shader = effect.makeShaderWithChildren(uniforms, [child]);
  const paint = new kit.Paint();
  paint.setShader(shader);
  const canvas = surface.getCanvas();
  canvas.clear(kit.TRANSPARENT);
  canvas.drawRect(kit.LTRBRect(0, 0, width, height), paint);
  surface.flush();
  const pixels = canvas.readPixels(0, 0, {
    width,
    height,
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Unpremul,
    colorSpace: kit.ColorSpace.SRGB,
  });
  if (!(pixels instanceof Uint8Array)) throw new Error('the pixels could not be read');
  shader.delete();
  child.delete();
  paint.delete();
  surface.delete();
  return { width, pixels, spread };
}

/** The alpha at (`x`, `y`), layout pixels from the element's corner. */
const alphaAt = (d: Drawn, x: number, y: number): number =>
  d.pixels[((y + d.spread) * d.width + x + d.spread) * 4 + 3]!;

/** The alpha summed over the columns `from` up to `to` of the element's own box. */
const alphaOver = (d: Drawn, from: number, to: number): number => {
  let sum = 0;
  for (let y = 0; y < H; y++) for (let x = from; x < to; x++) sum += alphaAt(d, x, y);
  return sum;
};

/** The alpha summed over everything outside the element's own box. */
const alphaOutside = (d: Drawn): number => {
  let sum = 0;
  for (let y = -d.spread; y < H + d.spread; y++) {
    for (let x = -d.spread; x < W + d.spread; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) sum += alphaAt(d, x, y);
    }
  }
  return sum;
};

const WHOLE = W * H * 255;

describe('DUST_SKSL under a real CanvasKit', () => {
  test('compiles without an error', () => {
    expect(effect).not.toBeNull();
    expect(compileError).toBe('');
  });

  test('declares its uniforms in the DUST_UNIFORMS order, DUST_UNIFORM_FLOATS floats in all', () => {
    const names: string[] = [];
    for (let i = 0; i < effect.getUniformCount(); i++) names.push(effect.getUniformName(i));
    expect(names).toEqual([...DUST_UNIFORMS]);
    expect(effect.getUniformFloatCount()).toBe(DUST_UNIFORM_FLOATS);
  });

  test('at progress 0 the element is whole, and nothing is drawn around it', () => {
    const drawn = draw(dust(), 0);
    expect(alphaOver(drawn, 0, W)).toBe(WHOLE);
    expect(alphaOutside(drawn)).toBe(0);
    // The capture's own colour, with no rim on it.
    const o = ((20 + drawn.spread) * drawn.width + 50 + drawn.spread) * 4;
    expect([...drawn.pixels.subarray(o, o + 4)]).toEqual([255, 0, 0, 255]);
  });

  test('at progress 1 nothing is left', () => {
    const drawn = draw(dust(), 1);
    expect(alphaOver(drawn, 0, W)).toBe(0);
    expect(alphaOutside(drawn)).toBe(0);
  });

  test('a diagonal sweep starts whole and leaves nothing either', () => {
    for (const sweepAngle of [45, 135, 225, 315]) {
      const preset = dust({ sweepAngle });
      const whole = draw(preset, 0);
      expect(alphaOver(whole, 0, W)).toBe(WHOLE);
      expect(alphaOutside(whole)).toBe(0);
      const gone = draw(preset, 1);
      expect(alphaOver(gone, 0, W)).toBe(0);
      expect(alphaOutside(gone)).toBe(0);
    }
  });

  test('less of the element is left as progress grows', () => {
    const preset = dust();
    let last = WHOLE + 1;
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const left = alphaOver(draw(preset, progress), 0, W);
      expect(left).toBeLessThan(last);
      last = left;
    }
  });

  test('the front travels along sweepAngle: at 90 the left goes first, at 270 the right', () => {
    const toRight = draw(dust({ sweepAngle: 90, noiseAmount: 0 }), 0.5);
    expect(alphaOver(toRight, 0, 30)).toBe(0);
    expect(alphaOver(toRight, 70, W)).toBe(30 * H * 255);

    const toLeft = draw(dust({ sweepAngle: 270, noiseAmount: 0 }), 0.5);
    expect(alphaOver(toLeft, 0, 30)).toBe(30 * H * 255);
    expect(alphaOver(toLeft, 70, W)).toBe(0);
  });

  test('the rim is edgeColor, at the front', () => {
    const drawn = draw(
      dust({ noiseAmount: 0, softness: 0.2, edgeWidth: 0.2, edgeColor: '#00ff00' }),
      0.5,
    );
    let rim = 0;
    for (let x = 0; x < W; x++) {
      const o = ((20 + drawn.spread) * drawn.width + x + drawn.spread) * 4;
      if (drawn.pixels[o + 3]! > 0 && drawn.pixels[o + 1]! > 128) rim++;
    }
    expect(rim).toBeGreaterThan(0);
    expect(rim).toBeLessThan(W / 2);
  });

  test('a softness and an edgeWidth of 0 still draw a clean cut', () => {
    const preset = dust({ softness: 0, edgeWidth: 0, noiseAmount: 0 });
    expect(alphaOver(draw(preset, 0), 0, W)).toBe(WHOLE);
    expect(alphaOver(draw(preset, 1), 0, W)).toBe(0);
    const half = draw(preset, 0.5);
    expect(alphaOver(half, 0, 45)).toBe(0);
    expect(alphaOver(half, 55, W)).toBe(45 * H * 255);
  });

  test('the largest seed still gives noise, not a flat field', () => {
    const drawn = draw(dust({ seed: 0xffffffff, noiseAmount: 1, softness: 0 }), 0.5);
    const left = alphaOver(drawn, 0, W);
    // With a noise that kept its precision about half the element is past the front.
    expect(left).toBeGreaterThan(WHOLE * 0.25);
    expect(left).toBeLessThan(WHOLE * 0.75);
  });
});
