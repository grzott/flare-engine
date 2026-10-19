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
import type { SkImageLike } from '@flare-engine/assets';
import type { AnySpriteEffect, CanvasLike, SpriteDrawCommand } from '@flare-engine/render';
import { createFrameRenderer, Renderer, water } from '@flare-engine/render';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebFrameRenderer } from '../src/web-frame-renderer.js';
import { createWebSkiaModule } from '../src/web-skia-module.js';

// Path to the CanvasKit wasm binary (full build, no WebGL required).
const WASM_PATH = resolve(
  import.meta.dir,
  '../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

// Dynamically load the CanvasKit JS bundle. The module is CommonJS (Emscripten).
async function loadCK(): Promise<CanvasKit> {
  const { default: initCK } = await import('canvaskit-wasm/bin/full/canvaskit.js');
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  return initCK({ locateFile: () => WASM_PATH, wasmBinary });
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
    const atlasImage: SkImageLike = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

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
      blend: 'normal',
      flipX: false,
      flipY: false,
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
    if (typeof (atlasImage as unknown as { delete?: () => void }).delete === 'function') {
      (atlasImage as unknown as { delete: () => void }).delete();
    }
    atlasSurface.delete();
    rasterSurface.delete();
  });

  /**
   * Factory smoke test: drives a full frame through `createWebFrameRenderer(kit)`
   * directly (NOT via the manual createFrameRenderer(createWebSkiaModule(...)) path)
   * to confirm the factory is correctly wired end-to-end.
   *
   * A 4×4 solid-red atlas sprite is scaled 2× to 8×8 at position (0,0) on a
   * 32×32 black canvas. After rasterizing the picture via readPixels:
   *   pixel (2, 2)   — inside sprite  → R≈255, G≈0, B≈0
   *   pixel (30, 30) — outside sprite → R≈0,   G≈0, B≈0
   */
  it('createWebFrameRenderer produces correct pixels end-to-end', () => {
    const FRAME_W = 32;
    const FRAME_H = 32;

    const atlasSurface = kit.MakeSurface(4, 4);
    expect(atlasSurface).not.toBeNull();
    if (!atlasSurface) return;
    atlasSurface.getCanvas().clear(kit.Color4f(1, 0, 0, 1));
    const atlasImage: SkImageLike = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

    const renderer = createWebFrameRenderer(kit);
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
      blend: 'normal',
      flipX: false,
      flipY: false,
    };

    renderer.drawAtlas(atlasImage, [cmd]);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    const rasterSurface = kit.MakeSurface(FRAME_W, FRAME_H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 1));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    const imageInfo = {
      width: FRAME_W,
      height: FRAME_H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;
    expect(pixels).not.toBeNull();

    const insideIdx = (2 * FRAME_W + 2) * 4;
    expect(pixels[insideIdx]!).toBeGreaterThan(200);
    expect(pixels[insideIdx + 1]!).toBeLessThan(50);
    expect(pixels[insideIdx + 2]!).toBeLessThan(50);

    const outsideIdx = (30 * FRAME_W + 30) * 4;
    expect(pixels[outsideIdx]!).toBeLessThan(10);
    expect(pixels[outsideIdx + 1]!).toBeLessThan(10);
    expect(pixels[outsideIdx + 2]!).toBeLessThan(10);

    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
    if (typeof (atlasImage as unknown as { delete?: () => void }).delete === 'function') {
      (atlasImage as unknown as { delete: () => void }).delete();
    }
    atlasSurface.delete();
    rasterSurface.delete();
  });

  /**
   * Camera-rotation contract (degrees). Drives Renderer.applyCamera over a CPU
   * CanvasKit surface wrapped as a CanvasLike, rotates the camera 90° (π/2), draws
   * a red bar along camera +x, and reads back pixels. A correct radians→degrees
   * conversion lands the bar a full 90° away from +x; the old radians-as-degrees
   * bug (~-1.57°) would leave it near +x.
   */
  it('camera rotation renders into the rotated quadrant (degrees contract)', () => {
    const W = 32;
    const H = 32;
    const surface = kit.MakeSurface(W, H);
    expect(surface).not.toBeNull();
    if (!surface) return;
    const ck = surface.getCanvas();
    ck.clear(kit.Color4f(0, 0, 0, 1)); // black background

    // Wrap the CPU canvas as a CanvasLike (same forwarding as createWebSurface).
    const canvas: CanvasLike = {
      save: () => ck.save(),
      restore: () => ck.restore(),
      translate: (x, y) => ck.translate(x, y),
      scale: (sx, sy) => ck.scale(sx, sy),
      rotate: (deg, cx, cy) => ck.rotate(deg, cx, cy),
      clear: () => {}, // pre-cleared above
    };

    // Rotate the camera 90° about the viewport center, zoom 1, camera at origin.
    const renderer = new Renderer();
    renderer.setCanvas(canvas);
    renderer.applyCamera(0, 0, 1, Math.PI / 2, W, H);

    // Red bar along camera-space +x (local x∈[6,14], y∈[-2,2]).
    const paint = new kit.Paint();
    paint.setColor(kit.Color4f(1, 0, 0, 1));
    ck.drawRect(kit.XYWHRect(6, -2, 8, 4), paint);
    surface.flush();

    const imageInfo = {
      width: W,
      height: H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = surface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;
    const at = (col: number, row: number) => {
      const i = (row * W + col) * 4;
      return { r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! };
    };

    // The un-rotated +x location must be black — it is red only if the rotation
    // were ~0° (the pre-fix radians-as-degrees behavior). Sign-independent.
    expect(at(26, 16).r).toBeLessThan(60);

    // Rotated a full 90°: the bar lands off the +x axis, at (col≈16, row≈6).
    const rotated = at(16, 6);
    expect(rotated.r).toBeGreaterThan(200);
    expect(rotated.g).toBeLessThan(60);
    expect(rotated.b).toBeLessThan(60);

    paint.delete();
    surface.delete();
  });

  /**
   * Pipeline smoke test: a WaterEffect command drives the full
   * createWebSkiaModule → createFrameRenderer → drawAtlas → endFrame chain
   * without throwing, and the resulting picture rasterizes at least one
   * non-zero RGB pixel onto a CPU surface.
   *
   * NOTE: CanvasKit CPU drawAtlas does NOT execute the RuntimeEffect shader
   * through the software rasterizer — the atlas image is drawn directly.  The
   * RGB assertion confirms only that the atlas sprite (blue pre-fill) came
   * through; it does NOT verify the water SkSL ran. Resolution-uniform
   * correctness is proven by the makeShader uniform spy below and by
   * render/tests/water-effect.test.ts.
   */
  it('water effect draws end-to-end on real CanvasKit without throwing', () => {
    const W = 32;
    const H = 32;

    const atlasSurface = kit.MakeSurface(W, H);
    expect(atlasSurface).not.toBeNull();
    if (!atlasSurface) return;
    atlasSurface.getCanvas().clear(kit.Color4f(0.1, 0.4, 0.9, 1));
    const atlasImage = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

    const mod = createWebSkiaModule(kit);
    const renderer = createFrameRenderer(mod);

    renderer.beginFrame(W, H, 0, 1);
    const cmd: SpriteDrawCommand = {
      image: atlasImage,
      srcX: 0,
      srcY: 0,
      srcW: W,
      srcH: H,
      dstX: 0,
      dstY: 0,
      dstW: W,
      dstH: H,
      effect: water({ r: 0.1, g: 0.4, b: 0.9, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 1.0, 0.1),
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas(cmd.image, [cmd]);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    const rasterSurface = kit.MakeSurface(W, H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 1));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    const imageInfo = {
      width: W,
      height: H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;
    expect(pixels).not.toBeNull();

    // Scan RGB only (skip alpha byte at i%4===3) — confirms the atlas sprite
    // drew through; does NOT prove the RuntimeEffect shader ran on CPU.
    let maxRgb = 0;
    for (let i = 0; i < pixels.length; i++) {
      if (i % 4 !== 3) {
        const v = pixels[i]!;
        if (v > maxRgb) maxRgb = v;
      }
    }
    expect(maxRgb).toBeGreaterThan(0);

    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
    rasterSurface.delete();
    atlasSurface.delete();
  });

  /**
   * Water shader animation: distinct `beginFrame(time)` values produce distinct
   * `time` uniforms in consecutive CanvasKit makeShader calls.
   *
   * CanvasKit's CPU drawAtlas fast-path does not rasterize RuntimeEffect shaders
   * through the software renderer, so pixel-readback diffing is not achievable
   * without a GPU context. Instead, we spy on the WASM `RuntimeEffect.Make`
   * call to intercept `makeShader(uniforms)` invocations and assert that the
   * time slot (index 10 for WATER_SKSL) changes across frames.
   *
   * This approach exercises the full web-skia-module → createFrameRenderer
   * pipeline with real CanvasKit WASM compilation, while verifying the uniform
   * forwarding path that pixel readback cannot confirm on CPU.
   */
  it('water shader time uniform (slot 10) differs across two beginFrame calls', () => {
    const W = 32;
    const H = 32;

    const atlasSurf = kit.MakeSurface(W, H);
    expect(atlasSurf).not.toBeNull();
    if (!atlasSurf) return;
    atlasSurf.getCanvas().clear(kit.Color4f(0.1, 0.4, 0.9, 1));
    const atlasImg = atlasSurf.makeImageSnapshot() as unknown as SkImageLike;

    // Spy kit: intercepts RuntimeEffect.Make to capture makeShader uniforms.
    const capturedUniforms: number[][] = [];
    const spyKit: CanvasKit = {
      ...kit,
      RuntimeEffect: {
        ...kit.RuntimeEffect,
        Make: (sksl: string) => {
          const real = kit.RuntimeEffect.Make(sksl);
          if (!real) return real;
          const orig = real.makeShader.bind(real) as typeof real.makeShader;
          real.makeShader = (uniforms: Parameters<typeof orig>[0]) => {
            const arr = Array.isArray(uniforms)
              ? [...uniforms]
              : [...(uniforms as unknown as number[])];
            capturedUniforms.push(arr);
            return orig(uniforms);
          };
          return real;
        },
      },
    };

    const mod = createWebSkiaModule(spyKit);
    const renderer = createFrameRenderer(mod);

    const baseCmd = (): SpriteDrawCommand => ({
      image: atlasImg,
      srcX: 0,
      srcY: 0,
      srcW: W,
      srcH: H,
      dstX: 0,
      dstY: 0,
      dstW: W,
      dstH: H,
      effect: water({ r: 0.1, g: 0.4, b: 0.9, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 2.0, 0.15),
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    });

    renderer.beginFrame(W, H, 1.0, 1);
    renderer.drawAtlas(atlasImg, [baseCmd()]);
    renderer.endFrame();

    renderer.beginFrame(W, H, 3.5, 1);
    renderer.drawAtlas(atlasImg, [baseCmd()]);
    renderer.endFrame();

    // Water SKSL has 11 uniforms; time is slot 10.
    const waterCalls = capturedUniforms.filter((u) => u.length === 11);
    expect(waterCalls.length).toBeGreaterThanOrEqual(2);
    const time0 = waterCalls[0]![10];
    const time1 = waterCalls[waterCalls.length - 1]![10];
    expect(time0).toBeCloseTo(1.0);
    expect(time1).toBeCloseTo(3.5);
    expect(time0).not.toBe(time1);

    atlasSurf.delete();
  });

  /**
   * Additive blend parity: draws a solid-blue full-frame sprite with normal blend,
   * then a solid-red full-frame sprite with additive blend on the same frame.
   *
   * With additive (Plus): dst=(0,0,255) + src=(255,0,0) → pixel ≈ (255,0,255) — both
   * R and B channels are high (magenta).
   * With SrcOver (the bug): dst is replaced → pixel ≈ (255,0,0) — B channel is low.
   *
   * The blue channel surviving distinguishes additive from the SrcOver fallback.
   */
  it('additive blend pixel is brighter than SrcOver (blue channel survives red additive)', () => {
    const W = 32;
    const H = 32;

    const blueSurface = kit.MakeSurface(W, H);
    expect(blueSurface).not.toBeNull();
    if (!blueSurface) return;
    blueSurface.getCanvas().clear(kit.Color4f(0, 0, 1, 1));
    const blueImage = blueSurface.makeImageSnapshot() as unknown as SkImageLike;

    const redSurface = kit.MakeSurface(W, H);
    expect(redSurface).not.toBeNull();
    if (!redSurface) return;
    redSurface.getCanvas().clear(kit.Color4f(1, 0, 0, 1));
    const redImage = redSurface.makeImageSnapshot() as unknown as SkImageLike;

    const mod = createWebSkiaModule(kit);
    const renderer = createFrameRenderer(mod);

    renderer.beginFrame(W, H, 0, 1);
    const blueCmd: SpriteDrawCommand = {
      image: blueImage,
      srcX: 0,
      srcY: 0,
      srcW: W,
      srcH: W,
      dstX: 0,
      dstY: 0,
      dstW: W,
      dstH: H,
      rotation: 0,
      alpha: 1,
      anchorX: 0,
      anchorY: 0,
      effect: undefined,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    };
    const redCmd: SpriteDrawCommand = {
      image: redImage,
      srcX: 0,
      srcY: 0,
      srcW: W,
      srcH: H,
      dstX: 0,
      dstY: 0,
      dstW: W,
      dstH: H,
      rotation: 0,
      alpha: 1,
      anchorX: 0,
      anchorY: 0,
      effect: undefined,
      stretch: false,
      blend: 'additive',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas(blueImage, [blueCmd]);
    renderer.drawAtlas(redImage, [redCmd]);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    const rasterSurface = kit.MakeSurface(W, H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 1));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    const imageInfo = {
      width: W,
      height: H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;
    expect(pixels).not.toBeNull();

    // Centre pixel must be ~magenta: R high (red additive applied), B high (blue survived).
    const idx = (16 * W + 16) * 4;
    const r = pixels[idx]!;
    const b = pixels[idx + 2]!;
    expect(r).toBeGreaterThan(200); // red from the additive sprite
    expect(b).toBeGreaterThan(200); // blue from the base sprite survived (additive, not SrcOver)

    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
    blueSurface.delete();
    redSurface.delete();
    rasterSurface.delete();
  });

  /**
   * Renders one padded sprite — an 8×8 atlas, transparent except an opaque red
   * 4×4 at (2,2) — through `createFrameRenderer` with `effect`, onto a target
   * cleared to transparent, and returns the Unpremul RGBA bytes.
   *
   * Shared by the tint/flash tests below (ADR-0009): a colour filter runs on
   * every pixel of the quad, so the padding is where SrcOver (paints the
   * constant) and SrcATop (keeps the art's alpha) differ.
   */
  function renderPaddedSpriteWithEffect(effect: AnySpriteEffect): Uint8Array | null {
    const W = 8;
    const H = 8;

    const atlasSurface = kit.MakeSurface(W, H);
    expect(atlasSurface).not.toBeNull();
    if (!atlasSurface) return null;
    const ac = atlasSurface.getCanvas();
    ac.clear(kit.Color4f(0, 0, 0, 0));
    const redPaint = new kit.Paint();
    redPaint.setColor(kit.Color4f(1, 0, 0, 1));
    ac.drawRect(kit.XYWHRect(2, 2, 4, 4), redPaint);
    atlasSurface.flush();
    const atlasImage = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

    const mod = createWebSkiaModule(kit);
    const renderer = createFrameRenderer(mod);

    renderer.beginFrame(W, H, 0, 1);
    const cmd: SpriteDrawCommand = {
      image: atlasImage,
      srcX: 0,
      srcY: 0,
      srcW: W,
      srcH: H,
      dstX: 0,
      dstY: 0,
      dstW: W,
      dstH: H,
      rotation: 0,
      alpha: 1,
      anchorX: 0,
      anchorY: 0,
      effect,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas(atlasImage, [cmd]);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return null;

    const rasterSurface = kit.MakeSurface(W, H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return null;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 0));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    const imageInfo = {
      width: W,
      height: H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;

    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
    redPaint.delete();
    atlasSurface.delete();
    rasterSurface.delete();
    return pixels;
  }

  /** RGBA of pixel (col,row) in an 8-wide Unpremul readback. */
  function rgba8(pixels: Uint8Array, col: number, row: number): [number, number, number, number] {
    const i = (row * 8 + col) * 4;
    return [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, pixels[i + 3]!];
  }

  it('flash keeps transparent padding transparent and lerps opaque pixels toward the flash colour', () => {
    const pixels = renderPaddedSpriteWithEffect({
      type: 'flash',
      color: { r: 1, g: 1, b: 1, a: 1 },
      duration: 1,
      elapsed: 0.5,
    });
    expect(pixels).not.toBeNull();
    if (!pixels) return;

    // Padding: outside the quad's art (0,0) and inside the quad but outside
    // the art (1,1). SrcOver would paint both white at alpha 128.
    expect(rgba8(pixels, 0, 0)[3]).toBe(0);
    expect(rgba8(pixels, 1, 1)[3]).toBe(0);

    // Opaque centre: red lerped halfway to white, alpha untouched.
    const [r, g, b, a] = rgba8(pixels, 3, 3);
    expect(Math.abs(r - 255)).toBeLessThanOrEqual(2);
    expect(Math.abs(g - 128)).toBeLessThanOrEqual(2);
    expect(Math.abs(b - 128)).toBeLessThanOrEqual(2);
    expect(a).toBe(255);
  });

  it('tint keeps transparent padding transparent and lerps opaque pixels toward the tint colour', () => {
    const pixels = renderPaddedSpriteWithEffect({
      type: 'tint',
      color: { r: 0, g: 0, b: 1, a: 1 },
      amount: 0.5,
    });
    expect(pixels).not.toBeNull();
    if (!pixels) return;

    expect(rgba8(pixels, 0, 0)[3]).toBe(0);
    expect(rgba8(pixels, 1, 1)[3]).toBe(0);

    // Opaque centre: red lerped halfway to blue, alpha untouched.
    const [r, g, b, a] = rgba8(pixels, 3, 3);
    expect(Math.abs(r - 128)).toBeLessThanOrEqual(2);
    expect(g).toBeLessThanOrEqual(2);
    expect(Math.abs(b - 128)).toBeLessThanOrEqual(2);
    expect(a).toBe(255);
  });

  /**
   * flipX parity: a 4×4 atlas where the left half is red and right half is green.
   * Drawing with flipX=true must swap which half appears red in the destination.
   *
   * Destination pixel (col=0, row=2) — leftmost column:
   *   flipX correct → green (was right half in source)
   *   flipX ignored → red   (was left half in source — the bug)
   *
   * Destination pixel (col=3, row=2) — rightmost column:
   *   flipX correct → red   (was left half in source)
   *   flipX ignored → green (was right half — the bug)
   */
  it('flipX swaps which half of the atlas reads as red vs green', () => {
    const W = 4;
    const H = 4;

    // Build a 4×4 atlas: left 2 columns red, right 2 columns green.
    const atlasSurface = kit.MakeSurface(W, H);
    expect(atlasSurface).not.toBeNull();
    if (!atlasSurface) return;
    const ac = atlasSurface.getCanvas();
    ac.clear(kit.Color4f(0, 0, 0, 1));
    const redPaint = new kit.Paint();
    redPaint.setColor(kit.Color4f(1, 0, 0, 1));
    ac.drawRect(kit.XYWHRect(0, 0, 2, H), redPaint);
    const greenPaint = new kit.Paint();
    greenPaint.setColor(kit.Color4f(0, 1, 0, 1));
    ac.drawRect(kit.XYWHRect(2, 0, 2, H), greenPaint);
    atlasSurface.flush();
    const atlasImage = atlasSurface.makeImageSnapshot() as unknown as SkImageLike;

    const mod = createWebSkiaModule(kit);
    const renderer = createFrameRenderer(mod);

    renderer.beginFrame(W, H, 0, 1);
    const flipCmd: SpriteDrawCommand = {
      image: atlasImage,
      srcX: 0,
      srcY: 0,
      srcW: W,
      srcH: H,
      dstX: 0,
      dstY: 0,
      dstW: W,
      dstH: H,
      rotation: 0,
      alpha: 1,
      anchorX: 0,
      anchorY: 0,
      effect: undefined,
      stretch: true,
      blend: 'normal',
      flipX: true,
      flipY: false,
    };
    renderer.drawAtlas(atlasImage, [flipCmd]);
    const pic = renderer.endFrame();
    expect(pic).not.toBeNull();
    if (!pic) return;

    const rasterSurface = kit.MakeSurface(W, H);
    expect(rasterSurface).not.toBeNull();
    if (!rasterSurface) return;
    const rc = rasterSurface.getCanvas();
    rc.clear(kit.Color4f(0, 0, 0, 1));
    rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
    rasterSurface.flush();

    const imageInfo = {
      width: W,
      height: H,
      colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul,
      colorSpace: kit.ColorSpace.SRGB,
    };
    const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, imageInfo) as Uint8Array;
    expect(pixels).not.toBeNull();

    const at = (col: number, row: number) => {
      const i = (row * W + col) * 4;
      return { r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! };
    };

    // Left column (col=0): after flipX, this was the right (green) half of the source.
    const left = at(0, 2);
    expect(left.g).toBeGreaterThan(200); // green — flipX moved the green half to the left
    expect(left.r).toBeLessThan(50); // not red

    // Right column (col=3): after flipX, this was the left (red) half of the source.
    const right = at(3, 2);
    expect(right.r).toBeGreaterThan(200); // red — flipX moved the red half to the right
    expect(right.g).toBeLessThan(50); // not green

    if (typeof (pic as { delete?: () => void }).delete === 'function') {
      (pic as { delete: () => void }).delete();
    }
    redPaint.delete();
    greenPaint.delete();
    atlasSurface.delete();
    rasterSurface.delete();
  });
});
