/**
 * Real-pixel test for per-sprite colour on the CanvasKit backend: coloured
 * sprites go through `SpriteBatch` → `createFrameRenderer` → `createWebSkiaModule`
 * → a real CanvasKit CPU surface, and the rasterized bytes are read back.
 *
 * It pins the blend: each texel is MULTIPLIED by its sprite's colour (Modulate).
 * The transparent padding around the art is where the backends' own defaults
 * would show — SrcOver or DstOver paint the colour across the whole quad.
 */
import { beforeAll, describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import type { SkImageLike } from '@flare-engine/assets';
import { createFrameRenderer, Renderer, SpriteBatch } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from '../src/web-skia-module.js';

const WASM_PATH = resolve(
  import.meta.dir,
  '../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

async function loadCK(): Promise<CanvasKit> {
  const { default: initCK } = await import('canvaskit-wasm/bin/full/canvaskit.js');
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  return initCK({ locateFile: () => WASM_PATH, wasmBinary });
}

let kit: CanvasKit;

beforeAll(async () => {
  kit = await loadCK();
}, 30_000);

const CELL = 8;

interface Sprite {
  alpha: number;
  /** Packed ARGB, or `undefined` for an uncoloured draw. */
  color: number | undefined;
}

interface Rendered {
  /** Unpremul RGBA, `sprites.length * CELL` wide and `CELL` tall. */
  pixels: Uint8Array;
  width: number;
  drawCalls: number;
}

/**
 * Draws each sprite in its own 8×8 cell, left to right, onto a transparent
 * target. The atlas is 8×8: transparent, with an opaque (255, 128, 64) 4×4 at
 * (2,2). Sprites are drawn at scale 1, so texels map to pixels one to one.
 */
function render(sprites: readonly Sprite[]): Rendered | null {
  const width = sprites.length * CELL;

  const atlasSurface = kit.MakeSurface(CELL, CELL);
  expect(atlasSurface).not.toBeNull();
  if (!atlasSurface) return null;
  const ac = atlasSurface.getCanvas();
  ac.clear(kit.Color4f(0, 0, 0, 0));
  const artPaint = new kit.Paint();
  artPaint.setColor(kit.Color(255, 128, 64, 1));
  ac.drawRect(kit.XYWHRect(2, 2, 4, 4), artPaint);
  atlasSurface.flush();
  const atlasImage = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

  const frameRenderer = createFrameRenderer(createWebSkiaModule(kit));
  const stats = new Renderer();
  const batch = new SpriteBatch();

  frameRenderer.beginFrame(width, CELL, 0, 1);
  sprites.forEach((sprite, i) => {
    batch.drawRaw(
      atlasImage,
      0,
      0,
      CELL,
      CELL,
      i * CELL,
      0,
      CELL,
      CELL,
      undefined,
      0,
      0,
      sprite.alpha,
      0,
      false,
      'normal',
      false,
      false,
      sprite.color,
    );
  });
  batch.flush(frameRenderer.drawAtlas, stats);
  const pic = frameRenderer.endFrame();
  expect(pic).not.toBeNull();
  if (!pic) return null;

  const rasterSurface = kit.MakeSurface(width, CELL);
  expect(rasterSurface).not.toBeNull();
  if (!rasterSurface) return null;
  const rc = rasterSurface.getCanvas();
  rc.clear(kit.Color4f(0, 0, 0, 0));
  rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
  rasterSurface.flush();

  const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, {
    width,
    height: CELL,
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Unpremul,
    colorSpace: kit.ColorSpace.SRGB,
  }) as Uint8Array;

  (pic as { delete?: () => void }).delete?.();
  artPaint.delete();
  atlasSurface.delete();
  rasterSurface.delete();
  return { pixels, width, drawCalls: stats.stats.drawCalls };
}

/** RGBA of the pixel at (`col`, `row`) of cell `cell`. */
function at(r: Rendered, cell: number, col: number, row: number): number[] {
  const i = (row * r.width + cell * CELL + col) * 4;
  return [r.pixels[i]!, r.pixels[i + 1]!, r.pixels[i + 2]!, r.pixels[i + 3]!];
}

function expectNear(actual: number[], expected: number[], tolerance: number): void {
  for (let ch = 0; ch < 4; ch++) {
    expect(Math.abs(actual[ch]! - expected[ch]!)).toBeLessThanOrEqual(tolerance);
  }
}

describe('per-sprite colour pixels (CanvasKit CPU surface)', () => {
  it('multiplies each sprite by its own colour and alpha, in one draw call', () => {
    const r = render([
      { alpha: 1, color: 0xffffffff },
      { alpha: 1, color: 0xff8040ff },
      { alpha: 0.5, color: 0xffffffff },
      { alpha: 0.5, color: 0x80ff0000 },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    expect(r.drawCalls).toBe(1);

    // White at full alpha leaves the art as it is.
    expectNear(at(r, 0, 3, 3), [255, 128, 64, 255], 1);
    // (255, 128, 64) × (0x80, 0x40, 0xff)/255.
    expectNear(at(r, 1, 3, 3), [128, 32, 64, 255], 2);
    // White at half alpha: same colour, half the coverage.
    expectNear(at(r, 2, 3, 3), [255, 128, 64, 128], 2);
    // alpha 0.5 folds into the colour's own 0x80: a quarter coverage, red only.
    const quarter = at(r, 3, 3, 3);
    expect(Math.abs(quarter[3]! - 64)).toBeLessThanOrEqual(2);
    expect(quarter[0]!).toBeGreaterThanOrEqual(250);
    expect(quarter[1]!).toBeLessThanOrEqual(4);
    expect(quarter[2]!).toBeLessThanOrEqual(4);
  });

  it('leaves the transparent padding transparent, which only Modulate does', () => {
    const r = render([
      { alpha: 1, color: 0xffff0000 },
      { alpha: 0.5, color: 0xff00ff00 },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    for (const cell of [0, 1]) {
      expect(at(r, cell, 0, 0)[3]).toBe(0);
      expect(at(r, cell, 1, 1)[3]).toBe(0);
      expect(at(r, cell, 7, 7)[3]).toBe(0);
    }
    // And the art is the product, not the colour painted over it.
    expectNear(at(r, 0, 3, 3), [255, 0, 0, 255], 1);
  });

  it('a white colour draws the same pixels as no colour at all', () => {
    const coloured = render([
      { alpha: 1, color: 0xffffffff },
      { alpha: 0.5, color: 0xffffffff },
    ]);
    const plainOpaque = render([{ alpha: 1, color: undefined }]);
    const plainHalf = render([{ alpha: 0.5, color: undefined }]);
    expect(coloured).not.toBeNull();
    expect(plainOpaque).not.toBeNull();
    expect(plainHalf).not.toBeNull();
    if (!coloured || !plainOpaque || !plainHalf) return;

    for (let row = 0; row < CELL; row++) {
      for (let col = 0; col < CELL; col++) {
        expectNear(at(coloured, 0, col, row), at(plainOpaque, 0, col, row), 1);
        expectNear(at(coloured, 1, col, row), at(plainHalf, 0, col, row), 2);
      }
    }
  });
});
