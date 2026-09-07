import { beforeAll, describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import type { SkImageLike } from '@flare-engine/postfx';
import {
  COLOR_GRADING_LUT_SKSL,
  COMPOSITE_SKSL,
  createBloom,
  createColorGradingLut,
  createGrayscaleFlash,
  createPostFxComposite,
  createPostFxController,
  createPostFxRuntime,
  createVignette,
  EffectChain,
  GRAYSCALE_FLASH_SKSL,
  VIGNETTE_SKSL,
} from '@flare-engine/postfx';
import type { CanvasKit } from 'canvaskit-wasm';
import { createPostFxSurface } from '../src/postfx-surface.js';
import { makeMockKit } from './support/mock-kit.js';

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
  it('returns null when the WebGL context cannot be acquired', () => {
    const kit = { GetWebGLContext: () => 0 } as unknown as CanvasKit;
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    expect(createPostFxSurface(kit, canvas, new EffectChain())).toBeNull();
  });

  it('exposes correct initial width and height', () => {
    const { kit } = makeMockKit();
    const canvas = makeEventfulCanvas(320, 240);
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface).not.toBeNull();
    expect(surface!.width).toBe(320);
    expect(surface!.height).toBe(240);
  });

  it('updates width and height on resize', () => {
    const { kit } = makeMockKit();
    const canvas = makeEventfulCanvas();
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
    const canvas1 = makeEventfulCanvas();
    const canvas2 = makeEventfulCanvas();
    const chain1 = new EffectChain();
    const chain2 = new EffectChain();
    chain2.add(createBloom('bloom', { threshold: 0.5, intensity: 0.9 }));
    const s1 = createPostFxSurface(kit1, canvas1, chain1);
    const s2 = createPostFxSurface(kit2, canvas2, chain2);
    expect(s1).not.toBe(s2);
  });

  it('sceneCanvas returns a canvas before dispose', () => {
    const { kit } = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface!.sceneCanvas()).not.toBeNull();
  });

  it('resize recreates the onscreen surface and deletes the previous one', () => {
    const { kit, onscreenCount, deletedSurfaces } = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(kit, canvas, new EffectChain())!;
    expect(surface).not.toBeNull();
    expect(onscreenCount()).toBe(1);

    surface.resize(200, 150);

    // resize() must call MakeOnScreenGLSurface a second time (once per resize),
    // rebuilding surfaces from the retained GrDirectContext.
    expect(onscreenCount()).toBe(2);
    // The previous onscreen surface must be deleted so its backing store is freed
    expect(deletedSurfaces.includes(1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Composite / dispose behavioral assertions (mock-based, empty chain = passthrough)
// ---------------------------------------------------------------------------

describe('composite / dispose behavior (mock, empty chain)', () => {
  it('composite with empty chain draws image directly then flushes onscreen', () => {
    // RuntimeEffect.Make returns null → runtime.supported = false → pass-through branch
    const { kit, calls } = makeMockKit();
    const canvas = makeEventfulCanvas();
    const chain = new EffectChain();
    const surface = createPostFxSurface(kit, canvas, chain)!;
    expect(surface).not.toBeNull();

    surface.composite(1);

    const drawImageCall = calls.find((c) => c.method === 'drawImage');
    expect(drawImageCall).not.toBeUndefined();
    // drawImage(img, 0, 0)
    expect(drawImageCall!.args?.[1]).toBe(0);
    expect(drawImageCall!.args?.[2]).toBe(0);
  });

  it('dispose deletes scene, pong, fade, fx; does not throw', () => {
    const { kit } = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface).not.toBeNull();
    // Should not throw
    expect(() => surface!.dispose()).not.toThrow();
  });

  it('dispose calls delete on both offscreen surfaces', () => {
    const { kit, deletedSurfaces, deletedPaints } = makeMockKit();
    const canvas = makeEventfulCanvas();
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
  it('single-pass: shader and srcShader are deleted after composite', () => {
    const { kit, deletedShaders, deletedSrcShaders } = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas(64, 64);
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
    const { kit, deletedShaders, deletedSrcShaders, deletedSnapshots } = makeMockKit({
      runtimeSupported: true,
    });
    const canvas = makeEventfulCanvas(64, 64);
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
    const { kit } = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas(64, 64);
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    const surface = createPostFxSurface(kit, canvas, chain)!;
    surface.composite(1);
    expect(() => surface.dispose()).not.toThrow();
  });

  it('color-grading-lut pass binds the LUT as a second child and frees it', () => {
    const { kit, childrenCounts } = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas(64, 64);
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
    const { kit, childrenCounts } = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas(64, 64);
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

// ---------------------------------------------------------------------------
// Explicit WebGL context lifecycle (leak fix)
// ---------------------------------------------------------------------------

describe('explicit WebGL context lifecycle', () => {
  it('dispose frees the GrDirectContext and the WebGL context handle', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(surface).not.toBeNull();
    expect(m.deletedContexts).toEqual([]);

    surface.dispose();

    expect(m.deletedGrContexts.length).toBe(1);
    expect(m.deletedContexts.length).toBe(1);
  });

  it('does not leak a context per surface across create/dispose cycles', () => {
    const m = makeMockKit();
    for (let i = 0; i < 8; i++) {
      const canvas = makeEventfulCanvas(64, 64);
      createPostFxSurface(m.kit, canvas, new EffectChain())!.dispose();
    }
    // Identity, not just count — the mock hands out increasing ids, so this also
    // proves each cycle frees its OWN handle rather than one stale handle 8 times.
    expect(m.deletedContexts).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(m.deletedGrContexts).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns null and leaks nothing when the GPU cannot build', () => {
    const m = makeMockKit();
    m.failNextBuild(true);
    const canvas = makeEventfulCanvas();
    expect(createPostFxSurface(m.kit, canvas, new EffectChain())).toBeNull();
    expect(m.deletedContexts.length).toBe(0);
  });

  it('frees the WebGL context when GrDirectContext creation fails', () => {
    const m = makeMockKit();
    m.failAt('grcontext');
    const canvas = makeEventfulCanvas();
    expect(createPostFxSurface(m.kit, canvas, new EffectChain())).toBeNull();
    expect(m.deletedContexts.length).toBe(1);
    expect(m.deletedGrContexts.length).toBe(0);
  });

  it('frees context and GrDirectContext when surface allocation fails', () => {
    const m = makeMockKit();
    m.failAt('surface');
    const canvas = makeEventfulCanvas();
    expect(createPostFxSurface(m.kit, canvas, new EffectChain())).toBeNull();
    expect(m.deletedContexts.length).toBe(1);
    expect(m.deletedGrContexts.length).toBe(1);
  });

  it('reports isLost false on a healthy surface', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(surface.isLost()).toBe(false);
    expect(surface.onscreenCanvas()).not.toBeNull();
  });

  it('resize rebuilds the on-screen surface from the retained GrDirectContext', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(m.onscreenCount()).toBe(1);

    surface.resize(200, 150);

    expect(m.onscreenCount()).toBe(2);
    expect(surface.width).toBe(200);
    expect(surface.height).toBe(150);
    // The context is retained across resize — only surfaces are rebuilt.
    expect(m.deletedContexts.length).toBe(0);
  });

  it('clamps non-finite and non-positive dimensions to 1', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas(Number.NaN, 0);
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(surface.width).toBe(1);
    expect(surface.height).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// WebGL context loss and restore self-heal
// ---------------------------------------------------------------------------

function makeEventfulCanvas(
  width = 100,
  height = 100,
): HTMLCanvasElement & {
  fire: (type: string) => Event;
  listenerCount: () => number;
} {
  const listeners = new Map<string, Set<EventListener>>();
  const canvas = {
    width,
    height,
    addEventListener(type: string, fn: EventListener) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: EventListener) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string) {
      let defaultPrevented = false;
      const ev = {
        type,
        preventDefault: () => {
          defaultPrevented = true;
        },
        get defaultPrevented() {
          return defaultPrevented;
        },
      } as unknown as Event;
      for (const fn of listeners.get(type) ?? []) fn(ev);
      return ev;
    },
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
  return canvas as unknown as HTMLCanvasElement & {
    fire: (type: string) => Event;
    listenerCount: () => number;
  };
}

describe('WebGL context loss and restore', () => {
  it('calls preventDefault on loss so the context stays restorable', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    createPostFxSurface(m.kit, canvas, new EffectChain())!;
    const ev = canvas.fire('webglcontextlost');
    expect(ev.defaultPrevented).toBe(true);
  });

  it('reports lost and nulls both canvases while lost', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    expect(surface.isLost()).toBe(true);
    expect(surface.sceneCanvas()).toBeNull();
    expect(surface.onscreenCanvas()).toBeNull();
  });

  it('no-ops draw operations while lost instead of throwing', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    expect(() => {
      surface.clear([0, 0, 0]);
      surface.fadeTrail([0, 0, 0], 0.5);
      surface.composite(1);
      surface.flush();
    }).not.toThrow();
  });

  it('issues NO GPU calls at all while lost', () => {
    // `not.toThrow()` above is necessary but not sufficient: the mock canvas never throws, so a
    // broken implementation that happily drew into a dead context would still satisfy it. This
    // asserts the calls genuinely did not reach the GPU.
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    const before = m.calls.length;

    surface.clear([0, 0, 0]);
    surface.fadeTrail([0, 0, 0], 0.5);
    surface.composite(1);
    surface.flush();

    expect(m.calls.length).toBe(before);
  });

  it('replays a clear issued while lost once the context is restored', () => {
    // A clear that arrives during a loss must still be recorded, so the restore repaints the
    // background the host last asked for — not the one from before the loss.
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    surface.clear([1, 0, 0]);
    canvas.fire('webglcontextlost');
    surface.clear([0, 0, 1]); // arrives while lost — no GPU call, but must be remembered
    canvas.fire('webglcontextrestored');

    const lastClear = m.calls.filter((c) => c.method === 'clear').at(-1);
    expect(Array.from(lastClear!.args![0] as Float32Array)).toEqual([0, 0, 1, 1]);
  });

  it('rebuilds GPU objects on restore and clears to the last background', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    surface.clear([0.25, 0.5, 0.75]);
    const clearsBefore = m.calls.filter((c) => c.method === 'clear').length;

    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');

    expect(surface.isLost()).toBe(false);
    expect(surface.sceneCanvas()).not.toBeNull();
    // The restore re-cleared to the retained background rather than to black.
    const clearsAfter = m.calls.filter((c) => c.method === 'clear').length;
    expect(clearsAfter).toBe(clearsBefore + 1);
    const lastClear = m.calls.filter((c) => c.method === 'clear').at(-1);
    expect(Array.from(lastClear!.args![0] as Float32Array)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('stays lost when the GPU still cannot build on restore', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    canvas.fire('webglcontextlost');
    m.failNextBuild(true);
    canvas.fire('webglcontextrestored');
    expect(surface.isLost()).toBe(true);
  });

  it('frees the old GPU objects on restore rather than leaking them', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(m.deletedContexts.length).toBe(0);
    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');
    // The pre-loss context must have been released before the rebuild.
    expect(m.deletedContexts.length).toBe(1);
    expect(m.deletedGrContexts.length).toBe(1);
  });

  it('removes both listeners on dispose', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    expect(canvas.listenerCount()).toBe(2);
    surface.dispose();
    expect(canvas.listenerCount()).toBe(0);
  });

  it('rebuilds at the resized dimensions when a resize happened while lost', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;

    canvas.fire('webglcontextlost');
    surface.resize(800, 600);
    canvas.fire('webglcontextrestored');

    expect(surface.isLost()).toBe(false);
    expect(surface.width).toBe(800);
    expect(surface.height).toBe(600);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// Composite blit blend mode (Src replace, not SrcOver composite)
// ---------------------------------------------------------------------------

describe('composite blit blend mode', () => {
  it('sets Src on the fx paint at construction', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    createPostFxSurface(m.kit, canvas, new EffectChain())!;
    // Constructed, never drawn — so the only blend mode set so far is the fx paint's.
    // fadeTrail() sets SrcOver on the OTHER paint, but only when called.
    expect(m.blendModes).toEqual([{ name: 'Src' }]);
  });

  it('does not re-blend the fx paint during composite', () => {
    const m = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas();
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    const surface = createPostFxSurface(m.kit, canvas, chain)!;
    const atConstruction = m.blendModes.length;
    surface.composite(1);
    expect(m.blendModes.slice(atConstruction)).toEqual([]);
  });

  it('fadeTrail still uses SrcOver on the fade paint', () => {
    const m = makeMockKit();
    const canvas = makeEventfulCanvas();
    const surface = createPostFxSurface(m.kit, canvas, new EffectChain())!;
    const atConstruction = m.blendModes.length;
    surface.fadeTrail([0, 0, 0], 0.5);
    // The trail fade is a genuine alpha-over and must NOT become Src.
    expect(m.blendModes.slice(atConstruction)).toEqual([{ name: 'SrcOver' }]);
  });
});

// ---------------------------------------------------------------------------
// composite(): the chain's global intensity has one owner
// ---------------------------------------------------------------------------

describe('composite() and the chain global intensity', () => {
  it('keeps an a11y-set motion scale across composite() when the argument is omitted', () => {
    const m = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas(64, 64);
    const pfx = createPostFxController({
      effects: [createVignette('v', { intensity: 0.5, radius: 0.7 })],
    });
    const surface = createPostFxSurface(m.kit, canvas, pfx.chain)!;

    // What createA11yBridge().attachPostfx(pfx) does under reduced motion.
    pfx.setMotionScale(0);
    surface.composite();

    expect(pfx.chain.globalIntensity).toBe(0);
    // Vignette packs [w, h, intensity, radius, r, g, b]; the pass must see the scaled intensity.
    expect(m.uniformsSeen).toHaveLength(1);
    expect(m.uniformsSeen[0]![2]).toBe(0);
  });

  it('an explicit argument still writes the chain global intensity', () => {
    const m = makeMockKit({ runtimeSupported: true });
    const canvas = makeEventfulCanvas(64, 64);
    const chain = new EffectChain();
    chain.add(createVignette('v', { intensity: 0.5, radius: 0.7 }));
    const surface = createPostFxSurface(m.kit, canvas, chain)!;

    surface.composite(0.25);

    expect(chain.globalIntensity).toBe(0.25);
    expect(m.uniformsSeen[0]![2]).toBeCloseTo(0.125, 6);
  });
});

// ---------------------------------------------------------------------------
// real CanvasKit CPU: composite clouds honour weatherDirection
// ---------------------------------------------------------------------------

describe('real CanvasKit CPU: composite weather clouds', () => {
  const W = 32;
  const H = 32;

  // Pack through the real runtime so the test pins the shipped layout, not a hand copy of it.
  const cloudsUniforms = (direction: number): Float32Array =>
    createPostFxRuntime(null).packUniforms(
      createPostFxComposite('c', {
        weatherKind: 4,
        weatherIntensity: 1,
        weatherDirection: direction,
        weatherScrollX: 40,
      }),
      W,
      H,
    );

  // Flat mid-grey source through COMPOSITE_SKSL → RGBA bytes. Null when RuntimeEffect is absent.
  function renderComposite(uniforms: Float32Array): Uint8Array | null {
    if (!ck?.MakeSurface || !ck.RuntimeEffect) return null;
    const src = ck.MakeSurface(W, H);
    if (!src) return null;
    src.getCanvas().clear(ck.Color4f(0.5, 0.5, 0.5, 1));
    const srcImg = src.makeImageSnapshot();
    const effect = ck.RuntimeEffect.Make(COMPOSITE_SKSL);
    expect(effect).not.toBeNull();
    const dst = ck.MakeSurface(W, H);
    let pixels: Uint8Array | null = null;
    if (effect && dst) {
      const srcShader = srcImg.makeShaderOptions(
        ck.TileMode.Clamp,
        ck.TileMode.Clamp,
        ck.FilterMode.Linear,
        ck.MipmapMode.None,
      );
      const shader = effect.makeShaderWithChildren(uniforms, [srcShader]);
      expect(shader).not.toBeNull();
      if (shader) {
        const paint = new ck.Paint();
        paint.setShader(shader as Parameters<typeof paint.setShader>[0]);
        dst.getCanvas().drawRect(ck.LTRBRect(0, 0, W, H), paint);
        dst.flush();
        paint.delete();
        (shader as { delete?(): void }).delete?.();
        const snap = dst.makeImageSnapshot();
        const out = snap.readPixels(0, 0, {
          width: W,
          height: H,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        }) as Uint8Array | null;
        pixels = out ? Uint8Array.from(out) : null;
        snap.delete();
      }
      srcShader.delete();
    }
    dst?.delete();
    effect?.delete();
    srcImg.delete();
    src.delete();
    return pixels;
  }

  it('weatherDirection changes the rendered clouds, as it does in WEATHER_CLOUDS_SKSL', () => {
    const along = renderComposite(cloudsUniforms(0));
    if (!along) return; // headless runner without RuntimeEffect — skip like the sibling tests
    const across = renderComposite(cloudsUniforms(90));
    expect(across).not.toBeNull();
    // Clouds must actually modulate the flat source, or the comparison below is vacuous.
    const reds = new Set<number>();
    for (let i = 0; i < along.length; i += 4) reds.add(along[i]!);
    expect(reds.size).toBeGreaterThan(1);
    expect(across).not.toEqual(along);
  });
});
