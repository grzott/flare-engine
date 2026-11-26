/**
 * Real-pixel test for the shader sprite effects (`custom`, `fog`, `fire`,
 * `water`) through the react-native-skia calling convention.
 *
 * Skia ignores a paint's shader when the draw is a colour image, so these
 * effects have to be drawn as a shader-filled rect. This drives RN Skia's own
 * JavaScript backend — `JsiSkApi` over a real CanvasKit CPU surface, as
 * `sprite-colour-pixels.test.ts` does — and reads the rasterized bytes back.
 * It proves the output for RN Skia's API, not the JSI C++ implementation.
 */
import { beforeAll, describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';
import type { SkImageLike } from '@flare-engine/assets';
import {
  type AnySpriteEffect,
  custom,
  fire,
  fog,
  Renderer,
  SpriteBatch,
  water,
} from '@flare-engine/render';
import { ColorType } from '@shopify/react-native-skia/lib/commonjs/skia/types/Image/ColorType';
import { AlphaType } from '@shopify/react-native-skia/lib/commonjs/skia/types/Image/ImageFactory';
import type { Skia as SkiaApi } from '@shopify/react-native-skia/lib/commonjs/skia/types/Skia';
import { JsiSkApi } from '@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia';
import { createSkiaFrameRenderer } from '../src/skia-bridge.js';

type SkiaCanvasKit = Parameters<typeof JsiSkApi>[0];

const requireFromSkia = createRequire(
  import.meta.resolve('@shopify/react-native-skia/package.json'),
);

let Skia: SkiaApi;

beforeAll(async () => {
  const initCK = requireFromSkia('canvaskit-wasm/bin/full/canvaskit.js') as (opts: {
    locateFile: (file: string) => string;
    wasmBinary: Uint8Array;
  }) => Promise<SkiaCanvasKit>;
  const wasmPath = requireFromSkia.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
  const wasmBinary = new Uint8Array(await Bun.file(wasmPath).arrayBuffer());
  Skia = JsiSkApi(await initCK({ locateFile: () => wasmPath, wasmBinary }));
}, 30_000);

const W = 32;
const H = 16;
const ATLAS = 8;

/** Red rises left to right and green top to bottom, in steps of 1/8 per sprite-local px. */
const GRADIENT_SKSL = `
uniform float2 size;
uniform float blue;
half4 main(float2 xy) {
  return half4(xy.x / size.x, xy.y / size.y, blue, 1.0);
}
`;

interface Sprite {
  effect: AnySpriteEffect;
  x: number;
  y: number;
  w: number;
  h: number;
  alpha?: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
  stretch?: boolean;
  blend?: 'normal' | 'additive';
  flipX?: boolean;
  flipY?: boolean;
}

interface Rendered {
  /** Unpremul RGBA, `W` × `H`. */
  pixels: Uint8Array;
}

interface RenderOptions {
  /** Opaque colour the target is cleared to; transparent when absent. */
  background?: string;
  /** Uniform scale applied through the frame renderer's canvas, as a camera does. */
  cameraScale?: number;
}

/**
 * Draws the sprites onto a `W` × `H` target. The atlas frame every sprite
 * carries is an opaque (255, 0, 255) 8×8 — a colour no shader here produces.
 */
function render(sprites: readonly Sprite[], options: RenderOptions = {}): Rendered | null {
  const atlasSurface = Skia.Surface.Make(ATLAS, ATLAS);
  expect(atlasSurface).not.toBeNull();
  if (!atlasSurface) return null;
  atlasSurface.getCanvas().clear(Skia.Color('rgb(255, 0, 255)'));
  atlasSurface.flush();
  const atlasImage: SkImageLike = atlasSurface.makeImageSnapshot();

  const frameRenderer = createSkiaFrameRenderer(Skia);
  const stats = new Renderer();
  const batch = new SpriteBatch();

  frameRenderer.beginFrame(W, H, 0, 1);
  const scale = options.cameraScale ?? 1;
  frameRenderer.canvas.save();
  frameRenderer.canvas.scale(scale, scale);
  for (const s of sprites) {
    batch.drawRaw(
      atlasImage,
      0,
      0,
      ATLAS,
      ATLAS,
      s.x,
      s.y,
      s.w,
      s.h,
      s.effect,
      s.anchorX ?? 0,
      s.anchorY ?? 0,
      s.alpha ?? 1,
      s.rotation ?? 0,
      s.stretch ?? false,
      s.blend ?? 'normal',
      s.flipX ?? false,
      s.flipY ?? false,
    );
  }
  batch.flush(frameRenderer.drawAtlas, stats);
  frameRenderer.canvas.restore();
  const pic = frameRenderer.endFrame();
  expect(pic).not.toBeNull();
  if (!pic) return null;

  const rasterSurface = Skia.Surface.Make(W, H);
  expect(rasterSurface).not.toBeNull();
  if (!rasterSurface) return null;
  const rc = rasterSurface.getCanvas();
  rc.clear(Skia.Color(options.background ?? 'transparent'));
  rc.drawPicture(pic as Parameters<typeof rc.drawPicture>[0]);
  rasterSurface.flush();

  const pixels = rasterSurface.makeImageSnapshot().readPixels(0, 0, {
    width: W,
    height: H,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  expect(pixels).toBeInstanceOf(Uint8Array);
  if (!(pixels instanceof Uint8Array)) return null;
  return { pixels };
}

function at(r: Rendered, x: number, y: number): number[] {
  const i = (y * W + x) * 4;
  return [r.pixels[i]!, r.pixels[i + 1]!, r.pixels[i + 2]!, r.pixels[i + 3]!];
}

function expectNear(actual: number[], expected: number[], tolerance: number): void {
  for (let ch = 0; ch < 4; ch++) {
    expect(Math.abs(actual[ch]! - expected[ch]!)).toBeLessThanOrEqual(tolerance);
  }
}

/** The gradient's colour at the centre of sprite-local pixel (`lx`, `ly`) of a `w` × `h` sprite. */
function gradient(lx: number, ly: number, w = 8, h = 8, blue = 0): number[] {
  return [((lx + 0.5) / w) * 255, ((ly + 0.5) / h) * 255, blue * 255, 255];
}

function gradientEffect(w = 8, h = 8, blue = 0): AnySpriteEffect {
  const compiled = Skia.RuntimeEffect.Make(GRADIENT_SKSL);
  if (compiled === null) throw new Error('GRADIENT_SKSL failed to compile');
  return custom(compiled, { size: [w, h], blue });
}

describe('shader sprite effect pixels (react-native-skia API over a CanvasKit CPU surface)', () => {
  it("custom(): the shader's output is drawn, in sprite-local coordinates", () => {
    // Away from the canvas origin, so canvas-space coordinates would give other colours.
    const r = render([{ effect: gradientEffect(), x: 12, y: 4, w: 8, h: 8 }]);
    expect(r).not.toBeNull();
    if (!r) return;

    expectNear(at(r, 12, 4), gradient(0, 0), 2);
    expectNear(at(r, 19, 4), gradient(7, 0), 2);
    expectNear(at(r, 12, 11), gradient(0, 7), 2);
    expectNear(at(r, 19, 11), gradient(7, 7), 2);
    expectNear(at(r, 15, 7), gradient(3, 3), 2);
  });

  it('custom(): covers the destination rect and nothing outside it', () => {
    const r = render([{ effect: gradientEffect(), x: 12, y: 4, w: 8, h: 8 }]);
    expect(r).not.toBeNull();
    if (!r) return;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inside = x >= 12 && x < 20 && y >= 4 && y < 12;
        expect(at(r, x, y)[3]).toBe(inside ? 255 : 0);
      }
    }
  });

  it('custom(): the anchor offsets the destination, as it does for a plain sprite', () => {
    const r = render([
      { effect: gradientEffect(), x: 16, y: 8, w: 8, h: 8, anchorX: 0.5, anchorY: 0.5 },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    expectNear(at(r, 12, 4), gradient(0, 0), 2);
    expectNear(at(r, 19, 11), gradient(7, 7), 2);
    expect(at(r, 11, 4)[3]).toBe(0);
    expect(at(r, 20, 11)[3]).toBe(0);
  });

  it('custom(): coordinates are in design px, so a camera scale stretches the pattern', () => {
    const r = render([{ effect: gradientEffect(), x: 4, y: 0, w: 8, h: 8 }], { cameraScale: 2 });
    expect(r).not.toBeNull();
    if (!r) return;

    // Device (8..24, 0..16); device px (dx, dy) is local ((dx + 0.5) / 2 - 4, (dy + 0.5) / 2).
    expectNear(at(r, 8, 0), [(0.25 / 8) * 255, (0.25 / 8) * 255, 0, 255], 2);
    expectNear(at(r, 23, 15), [(7.75 / 8) * 255, (7.75 / 8) * 255, 0, 255], 2);
    expect(at(r, 7, 0)[3]).toBe(0);
    expect(at(r, 24, 0)[3]).toBe(0);
  });

  it('custom(): alpha scales coverage', () => {
    const r = render([{ effect: gradientEffect(), x: 12, y: 4, w: 8, h: 8, alpha: 0.5 }]);
    expect(r).not.toBeNull();
    if (!r) return;

    const px = at(r, 15, 7);
    expect(Math.abs(px[3]! - 128)).toBeLessThanOrEqual(2);
    expectNear([px[0]!, px[1]!, px[2]!, 255], gradient(3, 3), 4);
  });

  it('custom(): additive blend adds the shader to what is beneath', () => {
    const r = render(
      [{ effect: gradientEffect(8, 8, 0), x: 12, y: 4, w: 8, h: 8, blend: 'additive' }],
      { background: 'rgb(0, 0, 100)' },
    );
    expect(r).not.toBeNull();
    if (!r) return;

    const g = gradient(3, 3);
    expectNear(at(r, 15, 7), [g[0]!, g[1]!, 100, 255], 2);
    expectNear(at(r, 2, 2), [0, 0, 100, 255], 1);
  });

  it('custom(): flipX and flipY mirror the pattern inside the same rect', () => {
    const r = render([
      { effect: gradientEffect(), x: 2, y: 4, w: 8, h: 8, flipX: true },
      { effect: gradientEffect(), x: 20, y: 4, w: 8, h: 8, flipY: true },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    expectNear(at(r, 2, 4), gradient(7, 0), 2);
    expectNear(at(r, 9, 11), gradient(0, 7), 2);
    expectNear(at(r, 20, 4), gradient(0, 7), 2);
    expectNear(at(r, 27, 11), gradient(7, 0), 2);
    expect(at(r, 1, 4)[3]).toBe(0);
    expect(at(r, 10, 4)[3]).toBe(0);
  });

  it('custom(): rotation turns the rect and its coordinates about the anchor', () => {
    // A quarter turn clockwise about the centre: local (lx, ly) lands at (7 - ly, lx) of the rect.
    const r = render([
      {
        effect: gradientEffect(),
        x: 16,
        y: 8,
        w: 8,
        h: 8,
        anchorX: 0.5,
        anchorY: 0.5,
        rotation: Math.PI / 2,
      },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    expectNear(at(r, 19, 4), gradient(0, 0), 2);
    expectNear(at(r, 19, 11), gradient(7, 0), 2);
    expectNear(at(r, 12, 4), gradient(0, 7), 2);
    expectNear(at(r, 12, 11), gradient(7, 7), 2);
  });

  it('custom(): a stretch draw gives the same pixels as a plain one', () => {
    const plain = render([{ effect: gradientEffect(), x: 12, y: 4, w: 8, h: 8 }]);
    const stretched = render([
      { effect: gradientEffect(), x: 12, y: 4, w: 8, h: 8, stretch: true },
    ]);
    expect(plain).not.toBeNull();
    expect(stretched).not.toBeNull();
    if (!plain || !stretched) return;
    expect(Array.from(stretched.pixels)).toEqual(Array.from(plain.pixels));
  });

  it('custom(): sprites sharing one effect in a run each get their own local origin', () => {
    const effect = gradientEffect();
    const r = render([
      { effect, x: 2, y: 4, w: 8, h: 8 },
      { effect, x: 20, y: 4, w: 8, h: 8 },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    for (const ox of [2, 20]) {
      expectNear(at(r, ox, 4), gradient(0, 0), 2);
      expectNear(at(r, ox + 7, 11), gradient(7, 7), 2);
    }
  });

  it('water(): fills the rect with the water and foam colours, opaque', () => {
    const r = render([
      {
        effect: water({ r: 0, g: 0, b: 1, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 1, 0.05),
        x: 8,
        y: 0,
        w: 16,
        h: 16,
      },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    let nonBlue = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 8; x < 24; x++) {
        const px = at(r, x, y);
        expect(px[3]).toBe(255);
        // Every pixel is a mix of blue and white: blue stays full, red equals green.
        expect(px[2]!).toBeGreaterThanOrEqual(253);
        expect(Math.abs(px[0]! - px[1]!)).toBeLessThanOrEqual(1);
        if (px[0]! > 0) nonBlue++;
      }
    }
    // Foam crests are there, and they are not the whole surface.
    expect(nonBlue).toBeGreaterThan(0);
    expect(nonBlue).toBeLessThan(16 * 16);
    expect(at(r, 7, 8)[3]).toBe(0);
    expect(at(r, 24, 8)[3]).toBe(0);
  });

  it('fog(): draws its colour at a noise-varying alpha, never the carrier frame', () => {
    const r = render([
      { effect: fog({ r: 0, g: 1, b: 0, a: 1 }, 1, 0.3, 4), x: 8, y: 0, w: 16, h: 16 },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    let minA = 255;
    let maxA = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 8; x < 24; x++) {
        const px = at(r, x, y);
        minA = Math.min(minA, px[3]!);
        maxA = Math.max(maxA, px[3]!);
        if (px[3]! >= 32) {
          expect(px[0]!).toBeLessThanOrEqual(8);
          expect(px[1]!).toBeGreaterThanOrEqual(247);
          expect(px[2]!).toBeLessThanOrEqual(8);
        }
      }
    }
    expect(maxA).toBeGreaterThan(32);
    expect(maxA - minA).toBeGreaterThan(16);
  });

  it('fire(): runs from the base colour at the top row toward the tip colour at the bottom row', () => {
    const r = render([
      {
        effect: fire({
          color: { r: 1, g: 0, b: 0, a: 1 },
          tipColor: { r: 0, g: 0, b: 1, a: 1 },
          intensity: 0.05,
        }),
        x: 8,
        y: 0,
        w: 16,
        h: 16,
      },
    ]);
    expect(r).not.toBeNull();
    if (!r) return;

    // The shader mixes color → tipColor by uv.y and fades the mask out as uv.y reaches 1.
    let topRed = 0;
    let topCount = 0;
    let midBlue = 0;
    let midCount = 0;
    for (let x = 8; x < 24; x++) {
      const top = at(r, x, 0);
      if (top[3]! >= 64) {
        topRed += top[0]!;
        topCount++;
        expect(top[1]!).toBeLessThanOrEqual(8);
      }
      const mid = at(r, x, 8);
      if (mid[3]! >= 64) {
        midBlue += mid[2]!;
        midCount++;
      }
    }
    expect(topCount).toBeGreaterThan(0);
    expect(midCount).toBeGreaterThan(0);
    expect(topRed / topCount).toBeGreaterThan(230);
    expect(midBlue / midCount).toBeGreaterThan(110);
    expect(midBlue / midCount).toBeLessThan(160);
  });
});
