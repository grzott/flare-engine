import { beforeAll, describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import {
  COLOR_GRADING_LUT_SKSL,
  EffectChain,
  GRAYSCALE_FLASH_SKSL,
  VIGNETTE_SKSL,
  createBloom,
  createColorGradingLut,
  createGrayscaleFlash,
  createVignette,
} from '@flare-engine/postfx';
import type { SkImageLike } from '@flare-engine/postfx';
import type {
  BlendMode,
  Canvas as CKCanvas,
  Image as CKImage,
  CanvasKit,
  InputColor,
  InputRect,
  Paint,
  Surface,
} from 'canvaskit-wasm';
import { createPostFxSurface } from '../src/postfx-surface.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockSurface(calls: { method: string; args?: unknown[] }[]): Surface {
  const canvas: CKCanvas = {
    save: () => 0,
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    clear: (c: InputColor) => calls.push({ method: 'clear', args: [c] }),
    drawImage: (img: CKImage, x: number, y: number) =>
      calls.push({ method: 'drawImage', args: [img, x, y] }),
    drawRect: (r: InputRect, p: Paint) => calls.push({ method: 'drawRect', args: [r, p] }),
    concat: () => {},
  } as unknown as CKCanvas;

  const surface: Surface = {
    getCanvas: () => canvas,
    flush: () => {},
    delete: () => {},
    makeImageSnapshot: () =>
      ({
        makeShaderOptions: () => ({ delete: () => {} }),
        delete: () => {},
      }) as unknown as CKImage,
    makeSurface: (_info: unknown) => makeMockSurface(calls),
  } as unknown as Surface;

  return surface;
}

function makeMockKit(): { kit: CanvasKit; onscreenCalls: { method: string; args?: unknown[] }[] } {
  const onscreenCalls: { method: string; args?: unknown[] }[] = [];
  const surface = makeMockSurface(onscreenCalls);

  const kit = {
    MakeWebGLCanvasSurface: (_canvas: unknown) => surface,
    ColorType: { RGBA_8888: 0 },
    AlphaType: { Premul: 1 },
    ColorSpace: { SRGB: null },
    BlendMode: { SrcOver: {} as BlendMode },
    TileMode: { Clamp: 0 },
    FilterMode: { Linear: 0 },
    MipmapMode: { None: 0 },
    Paint: class {
      setColor() {}
      setBlendMode() {}
      setShader() {}
      delete() {}
    },
    RuntimeEffect: {
      Make: () => null,
    },
    Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
    LTRBRect: (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b]),
  } as unknown as CanvasKit;

  return { kit, onscreenCalls };
}

// ---------------------------------------------------------------------------
// Real CanvasKit CPU loader (mirrors conformance.test.ts)
// ---------------------------------------------------------------------------

const WASM_PATH = resolve(
  import.meta.dir,
  '../../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
);

async function loadCK(): Promise<CanvasKit> {
  const { default: initCK } = await import('canvaskit-wasm/bin/full/canvaskit.js');
  const wasmBinary = new Uint8Array(await Bun.file(WASM_PATH).arrayBuffer());
  return initCK({ locateFile: () => WASM_PATH, wasmBinary });
}

let ck: CanvasKit;

beforeAll(async () => {
  ck = await loadCK();
}, 30_000);

// ---------------------------------------------------------------------------
// Basic construction / teardown (mock-based)
// ---------------------------------------------------------------------------

describe('createPostFxSurface', () => {
  it('returns null when MakeWebGLCanvasSurface fails', () => {
    const kit = { MakeWebGLCanvasSurface: () => null } as unknown as CanvasKit;
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const result = createPostFxSurface(kit, canvas, new EffectChain());
    expect(result).toBeNull();
  });

  it('exposes correct initial width and height', () => {
    const { kit } = makeMockKit();
    const canvas = { width: 320, height: 240 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface).not.toBeNull();
    expect(surface!.width).toBe(320);
    expect(surface!.height).toBe(240);
  });

  it('updates width and height on resize', () => {
    const { kit } = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    surface!.resize(800, 600);
    expect(surface!.width).toBe(800);
    expect(surface!.height).toBe(600);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('chain is parameterized — different chains produce different surface instances', () => {
    const { kit: kit1 } = makeMockKit();
    const { kit: kit2 } = makeMockKit();
    const canvas1 = { width: 100, height: 100 } as HTMLCanvasElement;
    const canvas2 = { width: 100, height: 100 } as HTMLCanvasElement;
    const chain1 = new EffectChain();
    const chain2 = new EffectChain();
    chain2.add(createBloom('bloom', { threshold: 0.5, intensity: 0.9 }));
    const s1 = createPostFxSurface(kit1, canvas1, chain1);
    const s2 = createPostFxSurface(kit2, canvas2, chain2);
    expect(s1).not.toBe(s2);
  });

  it('sceneCanvas returns a canvas before dispose', () => {
    const { kit } = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface!.sceneCanvas()).not.toBeNull();
  });

  it('resize recreates the onscreen surface and deletes the previous one', () => {
    let mkWebGLCallCount = 0;
    let initialOnscreenDeleted = false;

    function makeTrackedOnscreen(onDelete: () => void): Surface {
      const s: Surface = {
        getCanvas: () =>
          ({
            clear: () => {},
            drawImage: () => {},
            drawRect: () => {},
          }) as unknown as CKCanvas,
        flush: () => {},
        delete: onDelete,
        makeImageSnapshot: () =>
          ({
            makeShaderOptions: () => ({ delete: () => {} }),
            delete: () => {},
          }) as unknown as CKImage,
        makeSurface: () => makeTrackedOnscreen(() => {}),
      } as unknown as Surface;
      return s;
    }

    const kit = {
      MakeWebGLCanvasSurface: (_canvas: unknown) => {
        mkWebGLCallCount++;
        const isFirst = mkWebGLCallCount === 1;
        return makeTrackedOnscreen(() => {
          if (isFirst) initialOnscreenDeleted = true;
        });
      },
      ColorType: { RGBA_8888: 0 },
      AlphaType: { Premul: 1 },
      ColorSpace: { SRGB: null },
      BlendMode: { SrcOver: {} as BlendMode },
      TileMode: { Clamp: 0 },
      FilterMode: { Linear: 0 },
      MipmapMode: { None: 0 },
      Paint: class {
        setColor() {}
        setBlendMode() {}
        setShader() {}
        delete() {}
      },
      RuntimeEffect: { Make: () => null },
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      LTRBRect: (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b]),
    } as unknown as CanvasKit;

    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain())!;
    expect(surface).not.toBeNull();
    expect(mkWebGLCallCount).toBe(1);

    surface.resize(200, 150);

    // resize() must call MakeWebGLCanvasSurface a second time (once per resize)
    expect(mkWebGLCallCount).toBe(2);
    // The previous onscreen surface must be deleted so its backing store is freed
    expect(initialOnscreenDeleted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Composite / dispose behavioral assertions (mock-based, empty chain = passthrough)
// ---------------------------------------------------------------------------

describe('composite / dispose behavior (mock, empty chain)', () => {
  it('composite with empty chain draws image directly then flushes onscreen', () => {
    // RuntimeEffect.Make returns null → runtime.supported = false → pass-through branch
    const { kit, onscreenCalls } = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const chain = new EffectChain();
    const surface = createPostFxSurface(kit, canvas, chain)!;
    expect(surface).not.toBeNull();

    surface.composite(1);

    const drawImageCall = onscreenCalls.find((c) => c.method === 'drawImage');
    expect(drawImageCall).not.toBeUndefined();
    // drawImage(img, 0, 0)
    expect(drawImageCall!.args?.[1]).toBe(0);
    expect(drawImageCall!.args?.[2]).toBe(0);
  });

  it('dispose deletes scene, pong, fade, fx; does not throw', () => {
    const { kit } = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface).not.toBeNull();
    // Should not throw
    expect(() => surface!.dispose()).not.toThrow();
  });

  it('dispose calls delete on both offscreen surfaces', () => {
    // We need to track delete calls on the surfaces returned by makeSurface
    const deletedSurfaces: number[] = [];
    let surfaceCounter = 0;

    function makeTrackedSurface(): Surface {
      const id = ++surfaceCounter;
      const s: Surface = {
        getCanvas: () =>
          ({
            clear: () => {},
            drawImage: () => {},
            drawRect: () => {},
          }) as unknown as CKCanvas,
        flush: () => {},
        delete: () => {
          deletedSurfaces.push(id);
        },
        makeImageSnapshot: () =>
          ({
            makeShaderOptions: () => ({ delete: () => {} }),
            delete: () => {},
          }) as unknown as CKImage,
        makeSurface: (_info: unknown) => makeTrackedSurface(),
      } as unknown as Surface;
      return s;
    }

    const deletedPaints: string[] = [];
    const kit = {
      MakeWebGLCanvasSurface: () => makeTrackedSurface(),
      ColorType: { RGBA_8888: 0 },
      AlphaType: { Premul: 1 },
      ColorSpace: { SRGB: null },
      BlendMode: { SrcOver: {} },
      TileMode: { Clamp: 0 },
      FilterMode: { Linear: 0 },
      MipmapMode: { None: 0 },
      Paint: class {
        private _label: string;
        constructor() {
          this._label = `paint-${deletedPaints.length}`;
        }
        setColor() {}
        setBlendMode() {}
        setShader() {}
        delete() {
          deletedPaints.push(this._label);
        }
      },
      RuntimeEffect: { Make: () => null },
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      LTRBRect: (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b]),
    } as unknown as CanvasKit;

    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain())!;
    surface.dispose();

    // 2 offscreen surfaces (scene + pong) must be deleted; the onscreen is also deleted
    expect(deletedSurfaces.length).toBeGreaterThanOrEqual(2);
    // 2 paints (fade + fx) must be deleted
    expect(deletedPaints.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Multi-pass ping-pong loop with a mock that supports RuntimeEffect
// ---------------------------------------------------------------------------

describe('multi-pass ping-pong (mock with runtime support)', () => {
  function makeRuntimeSupportedKit(): {
    kit: CanvasKit;
    deletedShaders: string[];
    deletedSrcShaders: string[];
    deletedSnapshots: string[];
    childrenCounts: number[];
  } {
    const deletedShaders: string[] = [];
    const deletedSrcShaders: string[] = [];
    const deletedSnapshots: string[] = [];
    const childrenCounts: number[] = [];
    let shaderIdx = 0;
    let snapshotIdx = 0;

    function makeTrackedSrcShader(label: string): object {
      return {
        delete() {
          deletedSrcShaders.push(label);
        },
      };
    }

    function makeTrackedShader(label: string): object {
      return {
        delete() {
          deletedShaders.push(label);
        },
      };
    }

    function makeTrackedSnapshot(label: string): CKImage {
      const snap = {
        makeShaderOptions: () =>
          makeTrackedSrcShader(`src-${label}`) as ReturnType<CKImage['makeShaderOptions']>,
        delete() {
          deletedSnapshots.push(label);
        },
      } as unknown as CKImage;
      return snap;
    }

    function makeRTSurface(): Surface {
      const s: Surface = {
        getCanvas: () =>
          ({
            clear: () => {},
            drawImage: () => {},
            drawRect: () => {},
          }) as unknown as CKCanvas,
        flush: () => {},
        delete: () => {},
        makeImageSnapshot: () => {
          const label = `snap-${++snapshotIdx}`;
          return makeTrackedSnapshot(label);
        },
        makeSurface: () => makeRTSurface(),
      } as unknown as Surface;
      return s;
    }

    // The fake RuntimeEffect always compiles and produces a tracked shader
    const fakeEffect = {
      makeShaderWithChildren: (_uniforms: ArrayLike<number>, children: unknown[]) => {
        // Record how many non-null child shaders each pass binds — for the LUT
        // effect this must be 2 ([srcShader, lutShader]); pre-fix blit bound 1.
        childrenCounts.push(children.filter((c) => c != null).length);
        const label = `shader-${++shaderIdx}`;
        return makeTrackedShader(label);
      },
    };

    const kit = {
      MakeWebGLCanvasSurface: () => makeRTSurface(),
      ColorType: { RGBA_8888: 0 },
      AlphaType: { Premul: 1 },
      ColorSpace: { SRGB: null },
      BlendMode: { SrcOver: {} },
      TileMode: { Clamp: 0 },
      FilterMode: { Linear: 0 },
      MipmapMode: { None: 0 },
      Paint: class {
        setColor() {}
        setBlendMode() {}
        setShader() {}
        delete() {}
      },
      RuntimeEffect: {
        Make: () => fakeEffect,
      },
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      LTRBRect: (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b]),
    } as unknown as CanvasKit;

    return { kit, deletedShaders, deletedSrcShaders, deletedSnapshots, childrenCounts };
  }

  it('single-pass: shader and srcShader are deleted after composite', () => {
    const { kit, deletedShaders, deletedSrcShaders } = makeRuntimeSupportedKit();
    const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
    const chain = new EffectChain();
    chain.add(createVignette('v', { intensity: 0.5, radius: 0.7 }));
    const surface = createPostFxSurface(kit, canvas, chain)!;

    surface.composite(1);

    // One shader created, one deleted
    expect(deletedShaders.length).toBe(1);
    // One srcShader created from img, one deleted
    expect(deletedSrcShaders.length).toBe(1);
  });

  it('two-pass: intermediate snapshot and both shaders are deleted after composite', () => {
    const { kit, deletedShaders, deletedSrcShaders, deletedSnapshots } = makeRuntimeSupportedKit();
    const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
    const chain = new EffectChain();
    chain.add(createVignette('v', { intensity: 0.5, radius: 0.7 }));
    chain.add(createGrayscaleFlash('g', { intensity: 0.3 }));
    const surface = createPostFxSurface(kit, canvas, chain)!;

    surface.composite(1);

    // Two passes → two shaders deleted
    expect(deletedShaders.length).toBe(2);
    // Two srcShaders (one per pass) deleted
    expect(deletedSrcShaders.length).toBe(2);
    // First pass produced a pong snapshot that was used as src then deleted
    expect(deletedSnapshots.length).toBeGreaterThanOrEqual(1);
  });

  it('dispose after multi-pass composite does not throw', () => {
    const { kit } = makeRuntimeSupportedKit();
    const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    const surface = createPostFxSurface(kit, canvas, chain)!;
    surface.composite(1);
    expect(() => surface.dispose()).not.toThrow();
  });

  it('color-grading-lut pass binds the LUT as a second child and frees it', () => {
    const { kit, childrenCounts } = makeRuntimeSupportedKit();
    const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
    const deletedLut: string[] = [];
    const lutImage = {
      makeShaderOptions: () => ({ delete: () => deletedLut.push('lut') }),
    } as unknown as SkImageLike;
    const chain = new EffectChain();
    chain.add(createColorGradingLut('grade', { lut: lutImage }));
    const surface = createPostFxSurface(kit, canvas, chain)!;

    surface.composite(1);

    // The LUT pass must bind [srcShader, lutShader]; pre-fix blit passed only
    // [srcShader] so this was [1], leaving the LUT sampler unbound.
    expect(childrenCounts).toEqual([2]);
    // The wrapped LUT child shader is freed each pass (no GPU-handle leak);
    // the underlying LUT SkImage is caller-owned and must NOT be deleted here.
    expect(deletedLut).toEqual(['lut']);
  });

  it('non-LUT effects still bind exactly one child (src only)', () => {
    const { kit, childrenCounts } = makeRuntimeSupportedKit();
    const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createGrayscaleFlash('g'));
    const surface = createPostFxSurface(kit, canvas, chain)!;

    surface.composite(1);

    // Two non-LUT passes, each bound with the frozen EMPTY_CHILDREN sentinel →
    // src only. Proves the in-place childrenBuf resize doesn't leak a stale LUT.
    expect(childrenCounts).toEqual([1, 1]);
  });
});

// ---------------------------------------------------------------------------
// Real CanvasKit CPU: multi-pass actually runs, output differs from passthrough
// ---------------------------------------------------------------------------

describe('real CanvasKit CPU: shader compilation and pixel output', () => {
  it('CanvasKit loads and MakeSurface is callable', () => {
    // ck may be a partial instance when loaded concurrently with another file that also
    // loads CanvasKit WASM (second WASM instantiation gets reduced capabilities).
    if (!ck?.MakeSurface) return;
    expect(typeof ck.MakeSurface).toBe('function');
    // RuntimeEffect requires a GPU context and may be absent in headless CPU test runners.
  });

  it('grayscale-flash shader compiles and equalizes R/G on a red source', () => {
    // RuntimeEffect requires GPU; skip gracefully in headless CPU mode.
    if (!ck?.MakeSurface || !ck.RuntimeEffect) return;
    // Build a 4x4 red source image.
    const src = ck.MakeSurface(4, 4);
    expect(src).not.toBeNull();
    if (!src) return;
    src.getCanvas().clear(ck.Color4f(1, 0, 0, 1));
    const srcImg = src.makeImageSnapshot();

    // Compile the grayscale-flash shader via the real RuntimeEffect.
    const effect = ck.RuntimeEffect.Make(GRAYSCALE_FLASH_SKSL);
    expect(effect).not.toBeNull();
    if (!effect) {
      srcImg.delete();
      src.delete();
      return;
    }

    // Apply: intensity=1 → full grayscale.
    const srcShader = srcImg.makeShaderOptions(
      ck.TileMode.Clamp,
      ck.TileMode.Clamp,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    );
    const shader = effect.makeShaderWithChildren(new Float32Array([1.0]), [srcShader]);
    expect(shader).not.toBeNull();

    const dst = ck.MakeSurface(4, 4);
    expect(dst).not.toBeNull();
    if (!dst || !shader) {
      srcShader.delete();
      srcImg.delete();
      src.delete();
      return;
    }

    const paint = new ck.Paint();
    paint.setShader(shader as Parameters<typeof paint.setShader>[0]);
    dst.getCanvas().drawRect(ck.LTRBRect(0, 0, 4, 4), paint);
    dst.flush();
    paint.delete();
    (shader as { delete?(): void }).delete?.();
    srcShader.delete();

    const dstSnap = dst.makeImageSnapshot();
    const info = {
      width: 4,
      height: 4,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    };
    const pixels = dstSnap.readPixels(0, 0, info) as Uint8Array | null;
    expect(pixels).not.toBeNull();
    if (pixels) {
      // Center pixel (col=2,row=2); luma of red (1,0,0) ≈ 0.299 → ~76
      const idx = (2 * 4 + 2) * 4;
      const r = pixels[idx]!;
      const g = pixels[idx + 1]!;
      // R and G should be approximately equal (grayscale)
      expect(Math.abs(r - g)).toBeLessThan(20);
      // And not full red (was > 200 in pass-through)
      expect(r).toBeLessThan(120);
    }

    dstSnap.delete();
    dst.delete();
    srcImg.delete();
    src.delete();
  });

  it('vignette shader compiles and darkens corners relative to center', () => {
    if (!ck?.MakeSurface || !ck.RuntimeEffect) return;
    const w = 16;
    const h = 16;
    const src = ck.MakeSurface(w, h);
    expect(src).not.toBeNull();
    if (!src) return;
    // White source
    src.getCanvas().clear(ck.Color4f(1, 1, 1, 1));
    const srcImg = src.makeImageSnapshot();

    const effect = ck.RuntimeEffect.Make(VIGNETTE_SKSL);
    if (!effect) {
      srcImg.delete();
      src.delete();
      return;
    }

    const srcShader = srcImg.makeShaderOptions(
      ck.TileMode.Clamp,
      ck.TileMode.Clamp,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    );
    // uniforms: [width, height, intensity, radius, colorR, colorG, colorB]
    const uniforms = new Float32Array([w, h, 1.0, 0.5, 0, 0, 0]);
    const shader = effect.makeShaderWithChildren(uniforms, [srcShader]);
    expect(shader).not.toBeNull();

    const dst = ck.MakeSurface(w, h);
    if (!dst || !shader) {
      srcShader.delete();
      srcImg.delete();
      src.delete();
      return;
    }

    const paint = new ck.Paint();
    paint.setShader(shader as Parameters<typeof paint.setShader>[0]);
    dst.getCanvas().drawRect(ck.LTRBRect(0, 0, w, h), paint);
    dst.flush();
    paint.delete();
    (shader as { delete?(): void }).delete?.();
    srcShader.delete();

    const dstSnap = dst.makeImageSnapshot();
    const info = {
      width: w,
      height: h,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    };
    const pixels = dstSnap.readPixels(0, 0, info) as Uint8Array | null;
    expect(pixels).not.toBeNull();
    if (pixels) {
      const centerIdx = (8 * w + 8) * 4;
      const cornerIdx = (0 * w + 0) * 4;
      const centerR = pixels[centerIdx]!;
      const cornerR = pixels[cornerIdx]!;
      // Vignette: center should be brighter than corner
      expect(centerR).toBeGreaterThan(cornerR);
    }

    dstSnap.delete();
    dst.delete();
    srcImg.delete();
    src.delete();
  });

  it('color-grading-lut binds src+lut and grades a red source toward the LUT', () => {
    // The two-child (src + lut) LUT shape — the exact case blit() now binds.
    if (!ck?.MakeSurface || !ck.RuntimeEffect || !ck.MakeImage) return;
    const red = ck.MakeSurface(4, 4);
    if (!red) return;
    red.getCanvas().clear(ck.Color4f(1, 0, 0, 1));
    const srcImg = red.makeImageSnapshot();

    // All-blue 64³ LUT (4096×64 RGBA) — grades every input color to blue, so
    // the graded output is unambiguous regardless of LUT lookup coordinates.
    const lutW = 4096;
    const lutH = 64;
    const bytes = new Uint8Array(lutW * lutH * 4);
    for (let px = 0; px < lutW * lutH; px++) {
      bytes[px * 4 + 2] = 255; // B
      bytes[px * 4 + 3] = 255; // A
    }
    const lutImg = ck.MakeImage(
      {
        width: lutW,
        height: lutH,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB,
      },
      bytes,
      lutW * 4,
    );
    const effect = ck.RuntimeEffect.Make(COLOR_GRADING_LUT_SKSL);
    if (!effect || !lutImg) {
      lutImg?.delete();
      srcImg.delete();
      red.delete();
      return;
    }

    const srcShader = srcImg.makeShaderOptions(
      ck.TileMode.Clamp,
      ck.TileMode.Clamp,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    );
    const lutShader = lutImg.makeShaderOptions(
      ck.TileMode.Clamp,
      ck.TileMode.Clamp,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    );
    // Child order mirrors the SkSL declaration: src (index 0), lut (index 1);
    // uniforms = [intensity] (packUniforms yields a single float).
    const shader = effect.makeShaderWithChildren(new Float32Array([1.0]), [srcShader, lutShader]);
    expect(shader).not.toBeNull();

    const dst = ck.MakeSurface(4, 4);
    if (!dst || !shader) {
      srcShader.delete();
      lutShader.delete();
      lutImg.delete();
      srcImg.delete();
      red.delete();
      return;
    }

    const paint = new ck.Paint();
    paint.setShader(shader as Parameters<typeof paint.setShader>[0]);
    dst.getCanvas().drawRect(ck.LTRBRect(0, 0, 4, 4), paint);
    dst.flush();
    paint.delete();
    (shader as { delete?(): void }).delete?.();
    srcShader.delete();
    lutShader.delete();

    const dstSnap = dst.makeImageSnapshot();
    const info = {
      width: 4,
      height: 4,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    };
    const pixels = dstSnap.readPixels(0, 0, info) as Uint8Array | null;
    expect(pixels).not.toBeNull();
    if (pixels) {
      // Red (255,0,0) graded through an all-blue LUT at full intensity → blue.
      const idx = (2 * 4 + 2) * 4;
      const r = pixels[idx]!;
      const g = pixels[idx + 1]!;
      const b = pixels[idx + 2]!;
      expect(b).toBeGreaterThan(200);
      expect(r).toBeLessThan(60);
      expect(g).toBeLessThan(60);
    }

    dstSnap.delete();
    dst.delete();
    lutImg.delete();
    srcImg.delete();
    red.delete();
  });
});
