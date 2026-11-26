/**
 * Real-pixel test for a `custom()` shader sprite effect on the CanvasKit
 * backend: `SpriteBatch` → `createFrameRenderer` → `createWebSkiaModule` → a
 * real CanvasKit CPU surface, and the rasterized bytes are read back.
 *
 * It pins that the shader's output reaches the pixels, in sprite-local
 * coordinates. `packages/react/tests/sprite-shader-effect-pixels.test.ts`
 * covers the transform, alpha and blend cases, and the built-in effects.
 */
import { beforeAll, describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import type { SkImageLike } from '@flare-engine/assets';
import { createFrameRenderer, custom, Renderer, SpriteBatch } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from '../src/web-skia-module.js';

const WASM_PATH = resolve(
  import.meta.dir,
  '../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

let kit: CanvasKit;

beforeAll(async () => {
  const { default: initCK } = await import('canvaskit-wasm/bin/full/canvaskit.js');
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  kit = await initCK({ locateFile: () => WASM_PATH, wasmBinary });
}, 30_000);

const W = 32;
const H = 16;
const SIZE = 8;

/** Red rises left to right and green top to bottom, in steps of 1/8 per sprite-local px. */
const GRADIENT_SKSL = `
uniform float2 size;
half4 main(float2 xy) {
  return half4(xy.x / size.x, xy.y / size.y, 0.0, 1.0);
}
`;

describe('custom() shader sprite effect pixels (CanvasKit CPU surface)', () => {
  it("draws the shader's output over the destination rect, in sprite-local coordinates", () => {
    // The atlas frame the sprite carries is an opaque (255, 0, 255), which the shader never produces.
    const atlasSurface = kit.MakeSurface(SIZE, SIZE);
    expect(atlasSurface).not.toBeNull();
    if (!atlasSurface) return;
    atlasSurface.getCanvas().clear(kit.Color4f(1, 0, 1, 1));
    atlasSurface.flush();
    const atlasImage = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

    const skia = createWebSkiaModule(kit);
    const shader = skia.RuntimeEffect?.Make(GRADIENT_SKSL) ?? null;
    expect(shader).not.toBeNull();
    if (shader === null) return;

    const frameRenderer = createFrameRenderer(skia);
    const stats = new Renderer();
    const batch = new SpriteBatch();

    // Away from the canvas origin, so canvas-space coordinates would give other colours.
    const ox = 12;
    const oy = 4;
    frameRenderer.beginFrame(W, H, 0, 1);
    batch.drawRaw(
      atlasImage,
      0,
      0,
      SIZE,
      SIZE,
      ox,
      oy,
      SIZE,
      SIZE,
      custom(shader, { size: [SIZE, SIZE] }),
    );
    batch.flush(frameRenderer.drawAtlas, stats);
    const pic = frameRenderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    const rasterSurface = kit.MakeSurface(W, H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 0));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, {
      width: W,
      height: H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    }) as Uint8Array;

    (pic as { delete?: () => void }).delete?.();
    atlasSurface.delete();
    rasterSurface.delete();

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lx = x - ox;
        const ly = y - oy;
        if (lx < 0 || lx >= SIZE || ly < 0 || ly >= SIZE) {
          expect(pixels[i + 3]).toBe(0);
          continue;
        }
        expect(Math.abs(pixels[i]! - ((lx + 0.5) / SIZE) * 255)).toBeLessThanOrEqual(2);
        expect(Math.abs(pixels[i + 1]! - ((ly + 0.5) / SIZE) * 255)).toBeLessThanOrEqual(2);
        expect(pixels[i + 2]).toBe(0);
        expect(pixels[i + 3]).toBe(255);
      }
    }
  });
});
