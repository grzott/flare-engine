import { describe, expect, it } from 'bun:test';
import { EffectChain, createBloom } from '@flare-engine/postfx';
import type { Canvas as CKCanvas, Image as CKImage, CanvasKit, Surface } from 'canvaskit-wasm';
import { createPostFxSurface } from '../src/postfx-surface.js';

// Minimal CanvasKit mock that supports in-memory CPU-like surface operations.
function makeMockSurface(calls: { method: string; args?: unknown[] }[]): Surface {
  const canvas: CKCanvas = {
    save: () => 0,
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    clear: (c) => calls.push({ method: 'clear', args: [c] }),
    drawImage: (img, x, y) => calls.push({ method: 'drawImage', args: [img, x, y] }),
    drawRect: (r, p) => calls.push({ method: 'drawRect', args: [r, p] }),
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

function makeMockKit(): CanvasKit {
  const onscreenCalls: { method: string; args?: unknown[] }[] = [];
  const surface = makeMockSurface(onscreenCalls);

  return {
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
}

describe('createPostFxSurface', () => {
  it('returns null when MakeWebGLCanvasSurface fails', () => {
    const kit = { MakeWebGLCanvasSurface: () => null } as unknown as CanvasKit;
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const result = createPostFxSurface(kit, canvas, new EffectChain());
    expect(result).toBeNull();
  });

  it('exposes correct initial width and height', () => {
    const kit = makeMockKit();
    const canvas = { width: 320, height: 240 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface).not.toBeNull();
    expect(surface!.width).toBe(320);
    expect(surface!.height).toBe(240);
  });

  it('updates width and height on resize', () => {
    const kit = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    surface!.resize(800, 600);
    expect(surface!.width).toBe(800);
    expect(surface!.height).toBe(600);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('composite with empty chain draws image directly (pass-through)', () => {
    const kit = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const chain = new EffectChain();
    const surface = createPostFxSurface(kit, canvas, chain);
    expect(surface).not.toBeNull();
    // composite should not throw on pass-through (RuntimeEffect.Make returns null → unsupported)
    expect(() => surface!.composite(1)).not.toThrow();
  });

  it('dispose does not throw', () => {
    const kit = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(() => surface!.dispose()).not.toThrow();
  });

  it('chain is parameterized — different chains produce different surface instances', () => {
    const kit = makeMockKit();
    const canvas1 = { width: 100, height: 100 } as HTMLCanvasElement;
    const canvas2 = { width: 100, height: 100 } as HTMLCanvasElement;
    const chain1 = new EffectChain();
    const chain2 = new EffectChain();
    chain2.add(createBloom('bloom', { threshold: 0.5, intensity: 0.9 }));
    const s1 = createPostFxSurface(kit, canvas1, chain1);
    const s2 = createPostFxSurface(kit, canvas2, chain2);
    expect(s1).not.toBe(s2);
  });

  it('sceneCanvas returns a canvas before dispose', () => {
    const kit = makeMockKit();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const surface = createPostFxSurface(kit, canvas, new EffectChain());
    expect(surface!.sceneCanvas()).not.toBeNull();
  });
});
