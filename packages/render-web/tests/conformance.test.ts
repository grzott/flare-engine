/**
 * Headless conformance test: verifies that `createWebSkiaModule` + `createFrameRenderer`
 * produce correct output when driven via a real CanvasKit CPU surface.
 *
 * Uses `CanvasKit.MakeSurface(w, h)` (no WebGL required) so the test runs
 * in Node/Bun without a browser.
 *
 * The wasm binary is read from the installed `canvaskit-wasm` package via
 * the Node fs fallback in `loadCanvasKit`.
 */
import { beforeAll, describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { createFrameRenderer } from '@flare-engine/render';
import type { SpriteDrawCommand } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from '../src/web-skia-module.js';

// Path to the CanvasKit wasm binary (full build, no WebGL required).
const WASM_PATH = resolve(
  import.meta.dir,
  '../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

// Dynamically load the CanvasKit JS bundle. The module is CommonJS (Emscripten).
async function loadCK(): Promise<CanvasKit> {
  const mod = (await import('../../../node_modules/canvaskit-wasm/bin/full/canvaskit.js')) as {
    default: (opts: {
      locateFile: (f: string) => string;
      wasmBinary: Uint8Array;
    }) => Promise<CanvasKit>;
  };
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  return mod.default({ locateFile: () => WASM_PATH, wasmBinary });
}

let kit: CanvasKit;

beforeAll(async () => {
  kit = await loadCK();
}, 30_000);

describe('createWebSkiaModule conformance (CPU surface)', () => {
  it('CanvasKit loads and MakeSurface returns a surface', () => {
    const surface = kit.MakeSurface(4, 4);
    expect(surface).not.toBeNull();
    surface?.delete();
  });

  it('createWebSkiaModule returns a FrameRendererModule', () => {
    const mod = createWebSkiaModule(kit);
    expect(typeof mod.XYWHRect).toBe('function');
    expect(typeof mod.RSXform).toBe('function');
    expect(typeof mod.Paint).toBe('function');
    expect(typeof mod.PictureRecorder).toBe('function');
    expect(mod.ColorFilter).toBeTruthy();
    expect(mod.RuntimeEffect).toBeTruthy();
    expect(mod.ImageFilter).toBeTruthy();
  });

  it('XYWHRect produces a RectLike with correct fields', () => {
    const mod = createWebSkiaModule(kit);
    const r = mod.XYWHRect(10, 20, 100, 50);
    expect(r.x).toBe(10);
    expect(r.y).toBe(20);
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
  });

  it('XYWHRect.setXYWH mutates in place', () => {
    const mod = createWebSkiaModule(kit);
    const r = mod.XYWHRect(0, 0, 1, 1);
    r.setXYWH(5, 6, 7, 8);
    expect(r.x).toBe(5);
    expect(r.y).toBe(6);
    expect(r.width).toBe(7);
    expect(r.height).toBe(8);
  });

  it('RSXform carries readable scos/ssin/tx/ty fields', () => {
    const mod = createWebSkiaModule(kit);
    const xf = mod.RSXform(1, 0, 10, 20);
    expect(xf.scos).toBe(1);
    expect(xf.ssin).toBe(0);
    expect(xf.tx).toBe(10);
    expect(xf.ty).toBe(20);
  });

  it('RSXform.set mutates in place', () => {
    const mod = createWebSkiaModule(kit);
    const xf = mod.RSXform(0, 0, 0, 0);
    xf.set(2, 3, 4, 5);
    expect(xf.scos).toBe(2);
    expect(xf.ssin).toBe(3);
    expect(xf.tx).toBe(4);
    expect(xf.ty).toBe(5);
  });

  it('PictureRecorder records and finishes without error', () => {
    const mod = createWebSkiaModule(kit);
    const rec = mod.PictureRecorder();
    const bounds = mod.XYWHRect(0, 0, 100, 100);
    const canvas = rec.beginRecording(bounds);
    expect(typeof canvas.save).toBe('function');
    const pic = rec.finishRecordingAsPicture();
    expect(pic).toBeTruthy();
    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
  });

  it('createFrameRenderer.beginFrame + endFrame with web module produces a picture', () => {
    const mod = createWebSkiaModule(kit);
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(64, 64, 0, 1);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
  });

  /**
   * Real-pixel conformance: draws a 4×4 solid-red atlas sprite scaled to 8×8
   * at position (0,0) on a 32×32 black canvas, then rasterizes the picture and
   * reads back pixels to verify color and position.
   *
   * RSXform math for rotation=0, scale=dstW/srcW=2, anchorX=anchorY=0:
   *   xform = (scos=2, ssin=0, tx=0, ty=0)
   *   src point (px, py) → (2*px, 2*py)
   *   4×4 src → covers pixels [0..8) × [0..8) on the 32×32 canvas
   *
   * Assertions:
   *   pixel (2, 2)   — inside sprite  → R≈255, G≈0, B≈0 (red)
   *   pixel (30, 30) — outside sprite → R≈0,   G≈0, B≈0 (black background)
   *
   * RGBA_8888 Unpremul byte layout: index = (row * width + col) * 4
   */
  it('drawAtlas rasterizes pixels at the correct position and color', () => {
    const FRAME_W = 32;
    const FRAME_H = 32;

    const mod = createWebSkiaModule(kit);
    const renderer = createFrameRenderer(mod);

    // 4×4 solid-red atlas via CPU surface.
    const atlasSurface = kit.MakeSurface(4, 4);
    expect(atlasSurface).not.toBeNull();
    if (!atlasSurface) return;
    atlasSurface.getCanvas().clear(kit.Color4f(1, 0, 0, 1));
    const atlasImage = atlasSurface.makeImageSnapshot();

    // Record: black background, one 4×4→8×8 red sprite at (0,0).
    renderer.beginFrame(FRAME_W, FRAME_H, 0, 1);

    const cmd: SpriteDrawCommand = {
      image: atlasImage,
      srcX: 0,
      srcY: 0,
      srcW: 4,
      srcH: 4,
      dstX: 0,
      dstY: 0,
      dstW: 8,
      dstH: 8,
      rotation: 0,
      alpha: 1,
      anchorX: 0,
      anchorY: 0,
      effect: undefined,
      stretch: false,
    };

    renderer.drawAtlas(atlasImage, [cmd]);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    // Rasterize: draw the picture onto a fresh CPU surface with a black background.
    const rasterSurface = kit.MakeSurface(FRAME_W, FRAME_H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 1));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    // Read pixels: RGBA_8888, Unpremul.
    const imageInfo = {
      width: FRAME_W,
      height: FRAME_H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;
    expect(pixels).not.toBeNull();

    // Pixel at (col=2, row=2) — inside the 8×8 red sprite.
    const insideIdx = (2 * FRAME_W + 2) * 4;
    const insideR = pixels[insideIdx]!;
    const insideG = pixels[insideIdx + 1]!;
    const insideB = pixels[insideIdx + 2]!;
    expect(insideR).toBeGreaterThan(200); // red channel high
    expect(insideG).toBeLessThan(50); // green channel low
    expect(insideB).toBeLessThan(50); // blue channel low

    // Pixel at (col=30, row=30) — outside the sprite, black background.
    const outsideIdx = (30 * FRAME_W + 30) * 4;
    const outsideR = pixels[outsideIdx]!;
    const outsideG = pixels[outsideIdx + 1]!;
    const outsideB = pixels[outsideIdx + 2]!;
    expect(outsideR).toBeLessThan(10);
    expect(outsideG).toBeLessThan(10);
    expect(outsideB).toBeLessThan(10);

    // Cleanup.
    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
    atlasImage.delete();
    atlasSurface.delete();
    rasterSurface.delete();
  });
});
