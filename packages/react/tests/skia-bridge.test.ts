import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type {
  CustomShaderEffect,
  DropShadowEffect,
  FireEffect,
  FlashEffect,
  FogEffect,
  GrayscaleEffect,
  OutlineEffect,
  SpriteDrawCommand,
  TintEffect,
  WaterEffect,
} from '@flare-engine/render';

// Restore the real createFrameRenderer after other test files may have mocked
// @flare-engine/render with a stub. Last-writer-wins; skia-bridge.test.ts is
// alphabetically last among tests that mock render, so this wins.
const realRender = await import('../../render/src/frame-renderer.js');
mock.module('@flare-engine/render', () => ({
  ...realRender,
}));

import { createSkiaFrameRenderer, type SkiaModuleLike } from '../src/skia-bridge.js';

/** Minimal mock Skia objects that record calls so tests can assert call shape. */

interface MockRect {
  x: number;
  y: number;
  width: number;
  height: number;
  setXYWH(x: number, y: number, w: number, h: number): void;
}

interface MockXform {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
  set(scos: number, ssin: number, tx: number, ty: number): void;
}

interface MockColorFilter {
  readonly kind: 'blend' | 'matrix';
  readonly color?: Float32Array;
  readonly mode?: number;
  readonly matrix?: readonly number[];
}

interface MockShader {
  readonly uniforms: readonly number[];
}

interface MockImageFilter {
  readonly kind: 'drop-shadow';
  readonly dx: number;
  readonly dy: number;
  readonly sigmaX: number;
  readonly sigmaY: number;
  readonly color: Float32Array;
}

interface MockPaint {
  readonly id: number;
  colorFilter: MockColorFilter | null;
  shader: MockShader | null;
  imageFilter: MockImageFilter | null;
  alphaf: number;
  setColorFilter(filter: MockColorFilter | null): void;
  setShader(shader: MockShader | null): void;
  setImageFilter(filter: MockImageFilter | null): void;
  setAlphaf(alpha: number): void;
}

interface MockRuntimeEffect {
  uniformCount: number;
  uniformFloatCount: number;
  uniformNames: readonly string[];
  uniformSlots: readonly {
    columns: number;
    rows: number;
    slot: number;
    isInteger: boolean;
  }[];
  makeShaderCalls: Array<readonly number[]>;
  getUniformCount(): number;
  getUniformFloatCount(): number;
  getUniformName(index: number): string;
  getUniform(index: number): {
    columns: number;
    rows: number;
    slot: number;
    isInteger: boolean;
  };
  makeShader(uniforms: number[]): MockShader;
}

interface MockCanvas {
  drawAtlasCalls: Array<{
    image: unknown;
    srcs: readonly unknown[];
    dsts: readonly unknown[];
    paint: MockPaint;
    /** Snapshot of paint.alphaf at the moment drawAtlas was called. */
    paintAlphaf: number;
  }>;
  drawImageRectCalls: Array<{
    image: unknown;
    src: MockRect;
    dst: MockRect;
    paint: MockPaint;
    paintAlphaf: number;
  }>;
  clearCalls: Float32Array[];
  scaleCalls: Array<{ sx: number; sy: number }>;
}

let xywhCount = 0;
let rsxformCount = 0;
let paintCount = 0;
let recorderCount = 0;
let colorFilterBlendCalls: Array<{ color: Float32Array; mode: number }> = [];
let colorFilterMatrixCalls: Array<readonly number[]> = [];
let currentMockCanvas: MockCanvas | null = null;
let finishCalls = 0;
let beginRecordingBoundsArgs: Array<{ x: number; y: number; width: number; height: number }> = [];

function createMockCanvas(): MockCanvas {
  return { drawAtlasCalls: [], drawImageRectCalls: [], clearCalls: [], scaleCalls: [] };
}

function makeMockSkia(): SkiaModuleLike {
  return {
    XYWHRect: (x, y, width, height) => {
      xywhCount++;
      const r: MockRect = {
        x,
        y,
        width,
        height,
        setXYWH(nx, ny, nw, nh) {
          this.x = nx;
          this.y = ny;
          this.width = nw;
          this.height = nh;
        },
      };
      return r as unknown as ReturnType<SkiaModuleLike['XYWHRect']>;
    },
    RSXform: (scos, ssin, tx, ty) => {
      rsxformCount++;
      const x: MockXform = {
        scos,
        ssin,
        tx,
        ty,
        set(s, si, nx, ny) {
          this.scos = s;
          this.ssin = si;
          this.tx = nx;
          this.ty = ny;
        },
      };
      return x as unknown as ReturnType<SkiaModuleLike['RSXform']>;
    },
    Paint: () => {
      paintCount++;
      const p: MockPaint = {
        id: paintCount,
        colorFilter: null,
        shader: null,
        imageFilter: null,
        alphaf: 1,
        setColorFilter(filter) {
          this.colorFilter = filter;
        },
        setShader(shader) {
          this.shader = shader;
        },
        setImageFilter(filter) {
          this.imageFilter = filter;
        },
        setAlphaf(alpha) {
          this.alphaf = alpha;
        },
      };
      return p as unknown as ReturnType<SkiaModuleLike['Paint']>;
    },
    PictureRecorder: () => {
      recorderCount++;
      const recorder = {
        beginRecording(bounds?: MockRect): unknown {
          if (bounds !== undefined) {
            beginRecordingBoundsArgs.push({
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            });
          }
          const canvas: MockCanvas & {
            save(): number;
            restore(): void;
            translate(x: number, y: number): void;
            scale(sx: number, sy: number): void;
            rotate(r: number, cx: number, cy: number): void;
            clear(color: Float32Array): void;
            drawPicture(picture: unknown): void;
            drawAtlas(
              image: unknown,
              srcs: readonly unknown[],
              dsts: readonly unknown[],
              paint: MockPaint,
            ): void;
            drawImageRect(image: unknown, src: unknown, dst: unknown, paint: MockPaint): void;
          } = {
            ...createMockCanvas(),
            save: () => 0,
            restore: () => {},
            translate: () => {},
            scale(sx, sy) {
              this.scaleCalls.push({ sx, sy });
            },
            rotate: () => {},
            clear(color) {
              this.clearCalls.push(new Float32Array(color));
            },
            drawPicture: () => {},
            drawAtlas(image, srcs, dsts, paint) {
              const srcSnap: MockRect[] = [];
              for (const s of srcs) {
                const r = s as MockRect;
                srcSnap.push({
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                  setXYWH: () => {},
                });
              }
              const dstSnap: MockXform[] = [];
              for (const d of dsts) {
                const x = d as MockXform;
                dstSnap.push({
                  scos: x.scos,
                  ssin: x.ssin,
                  tx: x.tx,
                  ty: x.ty,
                  set: () => {},
                });
              }
              this.drawAtlasCalls.push({
                image,
                srcs: srcSnap,
                dsts: dstSnap,
                paint,
                paintAlphaf: (paint as MockPaint).alphaf,
              });
            },
            drawImageRect(image, src, dst, paint) {
              const s = src as MockRect;
              const d = dst as MockRect;
              this.drawImageRectCalls.push({
                image,
                src: { x: s.x, y: s.y, width: s.width, height: s.height, setXYWH: () => {} },
                dst: { x: d.x, y: d.y, width: d.width, height: d.height, setXYWH: () => {} },
                paint,
                paintAlphaf: (paint as MockPaint).alphaf,
              });
            },
          };
          currentMockCanvas = canvas;
          return canvas;
        },
        finishRecordingAsPicture(): unknown {
          finishCalls++;
          return { __picture: true };
        },
      };
      return recorder as unknown as ReturnType<SkiaModuleLike['PictureRecorder']>;
    },
    ColorFilter: {
      MakeBlend(color: Float32Array, mode: number) {
        const snapshot = new Float32Array(color);
        colorFilterBlendCalls.push({ color: snapshot, mode });
        const f: MockColorFilter = { kind: 'blend', color: snapshot, mode };
        return f as unknown as ReturnType<SkiaModuleLike['ColorFilter']['MakeBlend']>;
      },
      MakeMatrix(matrix: readonly number[]) {
        const snapshot = matrix.slice();
        colorFilterMatrixCalls.push(snapshot);
        const f: MockColorFilter = { kind: 'matrix', matrix: snapshot };
        return f as unknown as ReturnType<SkiaModuleLike['ColorFilter']['MakeMatrix']>;
      },
      MakeCompose: () => {
        throw new Error('not mocked');
      },
      MakeLerp: () => {
        throw new Error('not mocked');
      },
      MakeLinearToSRGBGamma: () => {
        throw new Error('not mocked');
      },
      MakeSRGBToLinearGamma: () => {
        throw new Error('not mocked');
      },
      MakeLumaColorFilter: () => {
        throw new Error('not mocked');
      },
    } as unknown as SkiaModuleLike['ColorFilter'],
  };
}

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64, readPixels: () => null };
}

function makeMockRuntimeEffect(
  uniforms: ReadonlyArray<{ name: string; size: number }>,
): MockRuntimeEffect {
  const slots: {
    columns: number;
    rows: number;
    slot: number;
    isInteger: boolean;
  }[] = [];
  let slot = 0;
  for (const u of uniforms) {
    slots.push({ columns: u.size, rows: 1, slot, isInteger: false });
    slot += u.size;
  }
  const floatCount = slot;
  const effect: MockRuntimeEffect = {
    uniformCount: uniforms.length,
    uniformFloatCount: floatCount,
    uniformNames: uniforms.map((u) => u.name),
    uniformSlots: slots,
    makeShaderCalls: [],
    getUniformCount: () => uniforms.length,
    getUniformFloatCount: () => floatCount,
    getUniformName: (i) => uniforms[i]?.name ?? '',
    getUniform: (i) => slots[i] ?? { columns: 0, rows: 0, slot: 0, isInteger: false },
    makeShader(u) {
      this.makeShaderCalls.push([...u]);
      return { uniforms: [...u] };
    },
  };
  return effect;
}

interface MockWaterRuntimeEffect {
  makeShaderCalls: Array<readonly number[]>;
  makeCount: number;
  makeShader(uniforms: number[]): MockShader;
}

interface MockFireRuntimeEffect {
  makeShaderCalls: Array<readonly number[]>;
  makeCount: number;
  makeShader(uniforms: number[]): MockShader;
}

let runtimeEffectMakeCalls = 0;
let currentMockWaterEffect: MockWaterRuntimeEffect | null = null;
let currentMockFireEffect: MockFireRuntimeEffect | null = null;

function makeMockWaterRuntimeEffect(): MockWaterRuntimeEffect {
  const effect: MockWaterRuntimeEffect = {
    makeShaderCalls: [],
    makeCount: 0,
    makeShader(u) {
      this.makeShaderCalls.push([...u]);
      return { uniforms: [...u] };
    },
  };
  return effect;
}

function makeMockSkiaWithRuntimeEffect(): SkiaModuleLike {
  const base = makeMockSkia();
  currentMockWaterEffect = makeMockWaterRuntimeEffect();
  const waterRef = currentMockWaterEffect;
  return {
    ...base,
    RuntimeEffect: {
      Make(_sksl: string): MockWaterRuntimeEffect {
        runtimeEffectMakeCalls++;
        waterRef.makeCount++;
        return waterRef;
      },
    } as unknown as NonNullable<SkiaModuleLike['RuntimeEffect']>,
  };
}

function cmd(partial: Partial<SpriteDrawCommand>): SpriteDrawCommand {
  return {
    image: mockImage(),
    srcX: 0,
    srcY: 0,
    srcW: 32,
    srcH: 32,
    dstX: 0,
    dstY: 0,
    dstW: 32,
    dstH: 32,
    effect: undefined,
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
    blend: 'normal',
    flipX: false,
    flipY: false,
    ...partial,
  };
}

beforeEach(() => {
  xywhCount = 0;
  rsxformCount = 0;
  paintCount = 0;
  recorderCount = 0;
  finishCalls = 0;
  colorFilterBlendCalls = [];
  colorFilterMatrixCalls = [];
  currentMockCanvas = null;
  beginRecordingBoundsArgs = [];
  runtimeEffectMakeCalls = 0;
  currentMockWaterEffect = null;
  currentMockFogEffect = null;
  currentMockFireEffect = null;
});

describe('createSkiaFrameRenderer', () => {
  it('allocates a single Paint, PictureRecorder, and pre-allocated rects up front', () => {
    createSkiaFrameRenderer(makeMockSkia());
    expect(paintCount).toBe(1);
    expect(recorderCount).toBe(1);
    // One XYWHRect pre-allocated: recording bounds.
    expect(xywhCount).toBe(1);
    expect(rsxformCount).toBe(0);
  });

  it('drawAtlas is a no-op before beginFrame()', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.drawAtlas(mockImage(), [cmd({})]);
    expect(currentMockCanvas).toBeNull();
  });

  it('endFrame returns null when beginFrame was not called', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    expect(bridge.endFrame()).toBeNull();
    expect(finishCalls).toBe(0);
  });

  it('fills srcRect and RSXform from SpriteDrawCommand fields', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcX: 10,
        srcY: 20,
        srcW: 32,
        srcH: 48,
        dstX: 100,
        dstY: 200,
        dstW: 64,
        dstH: 96,
      }),
    ]);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call).toBeDefined();
    const rect = call?.srcs[0] as MockRect;
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(32);
    expect(rect.height).toBe(48);
    const xform = call?.dsts[0] as MockXform;
    expect(xform.scos).toBe(2); // dstW/srcW = 64/32
    expect(xform.ssin).toBe(0);
    expect(xform.tx).toBe(100);
    expect(xform.ty).toBe(200);
  });

  it('invokes drawAtlas once per batch with pooled arrays', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    const img = mockImage();
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(img, [cmd({ dstX: 0 }), cmd({ dstX: 10 }), cmd({ dstX: 20 })]);
    const calls = currentMockCanvas?.drawAtlasCalls;
    expect(calls).toHaveLength(1);
    expect(calls?.[0]?.srcs).toHaveLength(3);
    expect(calls?.[0]?.dsts).toHaveLength(3);
  });

  it('pool grows once then is stable on repeated same-size calls', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    const xywhAfterFirst = xywhCount;
    const rsxformAfterFirst = rsxformCount;
    // 1 pre-allocated rect (bounds) + 3 pool entries
    expect(xywhAfterFirst).toBe(4);
    expect(rsxformAfterFirst).toBe(3);

    // Second call with same size — pool is reused, no new allocations.
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    expect(xywhCount).toBe(xywhAfterFirst);
    expect(rsxformCount).toBe(rsxformAfterFirst);
  });

  it('pool grows to max-seen when a later call is larger', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({})]);
    // 1 pre-allocated rect (bounds) + 1 pool entry
    expect(xywhCount).toBe(2);
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    // 1 pre-allocated rect + 3 pool entries
    expect(xywhCount).toBe(4);
    expect(rsxformCount).toBe(3);
  });

  it('endFrame returns the finished picture and clears state', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const picture = bridge.endFrame();
    expect(picture).toBeDefined();
    expect(finishCalls).toBe(1);
    // A subsequent endFrame without a beginFrame yields null.
    expect(bridge.endFrame()).toBeNull();
  });

  it('canvas adapter clears with unpacked ARGB components', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    // 0xFF204060 → a=1.0, r=32/255, g=64/255, b=96/255
    bridge.canvas.clear(0xff204060);
    const clearCall = currentMockCanvas?.clearCalls[0];
    expect(clearCall).toBeDefined();
    expect(clearCall?.[0]).toBeCloseTo(32 / 255);
    expect(clearCall?.[1]).toBeCloseTo(64 / 255);
    expect(clearCall?.[2]).toBeCloseTo(96 / 255);
    expect(clearCall?.[3]).toBeCloseTo(1);
  });

  it('canvas adapter is a no-op before beginFrame', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    expect(() => bridge.canvas.save()).not.toThrow();
    expect(() => bridge.canvas.restore()).not.toThrow();
    expect(() => bridge.canvas.translate(10, 20)).not.toThrow();
    expect(() => bridge.canvas.scale(2, 2)).not.toThrow();
    expect(() => bridge.canvas.rotate(0.5, 0, 0)).not.toThrow();
    expect(() => bridge.canvas.clear(0xff000000)).not.toThrow();
  });

  it('beginFrame passes non-empty bounds rect to beginRecording when viewport > 0', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    expect(beginRecordingBoundsArgs).toHaveLength(1);
    expect(beginRecordingBoundsArgs[0]).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(currentMockCanvas).not.toBeNull();
  });

  it('beginFrame skips recording when viewport width or height is 0', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(0, 600);
    expect(beginRecordingBoundsArgs).toHaveLength(0);
    expect(currentMockCanvas).toBeNull();
    expect(bridge.endFrame()).toBeNull();

    bridge.beginFrame(800, 0);
    expect(beginRecordingBoundsArgs).toHaveLength(0);
    expect(currentMockCanvas).toBeNull();
    expect(bridge.endFrame()).toBeNull();
  });

  it('beginFrame with pixelDensity=2 sets physical bounds (800×1200) and emits scale(2,2)', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(400, 600, 0, 2);
    expect(beginRecordingBoundsArgs).toHaveLength(1);
    expect(beginRecordingBoundsArgs[0]).toEqual({ x: 0, y: 0, width: 800, height: 1200 });
    expect(currentMockCanvas?.scaleCalls).toHaveLength(1);
    expect(currentMockCanvas?.scaleCalls[0]).toEqual({ sx: 2, sy: 2 });
  });

  it('beginFrame without pixelDensity keeps logical bounds and emits no scale call', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(400, 600);
    expect(beginRecordingBoundsArgs).toHaveLength(1);
    expect(beginRecordingBoundsArgs[0]).toEqual({ x: 0, y: 0, width: 400, height: 600 });
    expect(currentMockCanvas?.scaleCalls).toHaveLength(0);
  });

  it('beginFrame with pixelDensity=1 keeps logical bounds and emits no scale call', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(400, 600, 0, 1);
    expect(beginRecordingBoundsArgs).toHaveLength(1);
    expect(beginRecordingBoundsArgs[0]).toEqual({ x: 0, y: 0, width: 400, height: 600 });
    expect(currentMockCanvas?.scaleCalls).toHaveLength(0);
  });
});

describe('createSkiaFrameRenderer — sprite effects', () => {
  it('batches with no effect use the default shared paint', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({})]);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.id).toBe(1);
    expect(call?.paint.colorFilter).toBeNull();
    expect(call?.paint.shader).toBeNull();
  });

  it('tint effect assigns a MakeBlend color filter with amount-scaled alpha', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const effect: TintEffect = {
      type: 'tint',
      color: { r: 1, g: 0.5, b: 0.25, a: 1 },
      amount: 0.4,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect }), cmd({ effect })]);
    expect(colorFilterBlendCalls).toHaveLength(1);
    const [blend] = colorFilterBlendCalls;
    expect(blend?.color[0]).toBeCloseTo(1);
    expect(blend?.color[1]).toBeCloseTo(0.5);
    expect(blend?.color[2]).toBeCloseTo(0.25);
    expect(blend?.color[3]).toBeCloseTo(0.4);
    expect(blend?.mode).toBe(3); // BlendMode.SrcOver

    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.colorFilter?.kind).toBe('blend');
    expect(call?.paint.id).not.toBe(1); // effect paint, not default
  });

  it('flash effect scales alpha by flashIntensity (1 at start, 0.5 halfway)', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const halfway: FlashEffect = {
      type: 'flash',
      color: { r: 1, g: 1, b: 1, a: 1 },
      duration: 1,
      elapsed: 0.5,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect: halfway })]);
    const [blend] = colorFilterBlendCalls;
    expect(blend?.color[3]).toBeCloseTo(0.5);
    expect(blend?.mode).toBe(3);
  });

  it('grayscale effect assigns a MakeMatrix color filter interpolated by amount', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const full: GrayscaleEffect = { type: 'grayscale', amount: 1 };
    bridge.drawAtlas(mockImage(), [cmd({ effect: full })]);
    expect(colorFilterMatrixCalls).toHaveLength(1);
    const matrix = colorFilterMatrixCalls[0]!;
    expect(matrix).toHaveLength(20);
    // At amount=1 row 0 is [0.299, 0.587, 0.114, 0, 0]
    expect(matrix[0]).toBeCloseTo(0.299);
    expect(matrix[1]).toBeCloseTo(0.587);
    expect(matrix[2]).toBeCloseTo(0.114);
    // Alpha row unchanged
    expect(matrix[18]).toBe(1);
  });

  it('grayscale effect at amount=0 produces identity rgb rows', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const none: GrayscaleEffect = { type: 'grayscale', amount: 0 };
    bridge.drawAtlas(mockImage(), [cmd({ effect: none })]);
    const matrix = colorFilterMatrixCalls[0]!;
    expect(matrix[0]).toBeCloseTo(1);
    expect(matrix[6]).toBeCloseTo(1);
    expect(matrix[12]).toBeCloseTo(1);
  });

  it('outline effect issues 9 drawAtlas passes (8 offsets + main) with SrcIn filter', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const effect: OutlineEffect = {
      type: 'outline',
      color: { r: 0, g: 1, b: 0, a: 1 },
      width: 2,
    };
    bridge.drawAtlas(mockImage(), [cmd({ dstX: 50, dstY: 50, effect })]);
    const calls = currentMockCanvas?.drawAtlasCalls ?? [];
    expect(calls).toHaveLength(9);
    // First 8 passes use the outline paint with SrcIn blend.
    for (let i = 0; i < 8; i++) {
      const call = calls[i]!;
      expect(call.paint.colorFilter?.kind).toBe('blend');
      expect((call.paint.colorFilter as MockColorFilter).mode).toBe(5); // BlendMode.SrcIn
    }
    // Final pass uses the unfiltered default paint.
    const mainCall = calls[8]!;
    expect(mainCall.paint.id).toBe(1);
    expect(mainCall.paint.colorFilter).toBeNull();
    // Main pass restores the original xform position.
    const mainXform = mainCall.dsts[0] as MockXform;
    expect(mainXform.tx).toBe(50);
    expect(mainXform.ty).toBe(50);
    // One of the cardinal outline passes offsets by (±width, 0) or (0, ±width).
    const offsets = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const xf = calls[i]!.dsts[0] as MockXform;
      offsets.add(`${Math.round((xf.tx - 50) * 10) / 10},${Math.round((xf.ty - 50) * 10) / 10}`);
    }
    expect(offsets.has('2,0')).toBe(true);
    expect(offsets.has('-2,0')).toBe(true);
    expect(offsets.has('0,2')).toBe(true);
    expect(offsets.has('0,-2')).toBe(true);
    // ColorFilter.MakeBlend is only invoked once per flush (paint is reused).
    expect(colorFilterBlendCalls).toHaveLength(1);
    expect(colorFilterBlendCalls[0]?.mode).toBe(5);
  });

  it('custom shader effect calls makeShader with uniforms in declaration order', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const shader = makeMockRuntimeEffect([
      { name: 'u_time', size: 1 },
      { name: 'u_resolution', size: 2 },
    ]);
    const effect: CustomShaderEffect = {
      type: 'custom',
      shader: shader as unknown as CustomShaderEffect['shader'],
      uniforms: { u_time: 1.5, u_resolution: [800, 600] },
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    expect(shader.makeShaderCalls).toHaveLength(1);
    const flat = shader.makeShaderCalls[0]!;
    expect(flat).toEqual([1.5, 800, 600]);

    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.shader).not.toBeNull();
  });

  it('effect paints are allocated lazily on first use, one per type', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    expect(paintCount).toBe(1);

    bridge.beginFrame(800, 600);
    const tintFx: TintEffect = {
      type: 'tint',
      color: { r: 1, g: 0, b: 0, a: 1 },
      amount: 0.5,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect: tintFx })]);
    expect(paintCount).toBe(2); // default + tint

    // Second call with the same effect type does not allocate another paint.
    bridge.drawAtlas(mockImage(), [cmd({ effect: tintFx })]);
    expect(paintCount).toBe(2);

    const grayFx: GrayscaleEffect = { type: 'grayscale', amount: 1 };
    bridge.drawAtlas(mockImage(), [cmd({ effect: grayFx })]);
    expect(paintCount).toBe(3); // + grayscale
  });

  it('effect paints and pools are stable across repeated same-shape frames', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    const tintFx: TintEffect = {
      type: 'tint',
      color: { r: 1, g: 0, b: 0, a: 1 },
      amount: 0.5,
    };

    // Frame 1 — warm up the pools.
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect: tintFx }), cmd({ effect: tintFx })]);
    bridge.endFrame();
    const paintsAfterWarmup = paintCount;
    const xywhAfterWarmup = xywhCount;
    const rsxformAfterWarmup = rsxformCount;

    // Frame 2 — same shape, expect no new paint, rect, or xform allocations.
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect: tintFx }), cmd({ effect: tintFx })]);
    bridge.endFrame();
    expect(paintCount).toBe(paintsAfterWarmup);
    expect(xywhCount).toBe(xywhAfterWarmup);
    expect(rsxformCount).toBe(rsxformAfterWarmup);
  });
});

describe('createSkiaFrameRenderer — water effect', () => {
  it('dispatch hit — drawAtlas with WaterEffect calls makeShader on the compiled water runtime effect', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithRuntimeEffect());
    bridge.beginFrame(800, 600);
    const effect: WaterEffect = {
      type: 'water',
      color: { r: 0.1, g: 0.3, b: 0.8, a: 1 },
      foamColor: { r: 1, g: 1, b: 1, a: 1 },
      waveSpeed: 1.5,
      waveAmplitude: 0.02,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    expect(currentMockWaterEffect?.makeShaderCalls).toHaveLength(1);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.shader).not.toBeNull();
  });

  it('lazy cache reuse — RuntimeEffect.Make called exactly once across two drawAtlas calls', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithRuntimeEffect());
    bridge.beginFrame(800, 600);
    const effect: WaterEffect = {
      type: 'water',
      color: { r: 0.1, g: 0.3, b: 0.8, a: 1 },
      foamColor: { r: 1, g: 1, b: 1, a: 1 },
      waveSpeed: 1.5,
      waveAmplitude: 0.02,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    expect(runtimeEffectMakeCalls).toBe(1);
    expect(currentMockWaterEffect?.makeShaderCalls).toHaveLength(2);
  });

  it('uniform packing — makeShader called with 11-float array matching color, foamColor, waveSpeed, waveAmplitude, time', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithRuntimeEffect());
    bridge.beginFrame(800, 600, 2.5);
    const effect: WaterEffect = {
      type: 'water',
      color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
      foamColor: { r: 0.9, g: 0.95, b: 1.0, a: 1 },
      waveSpeed: 1.2,
      waveAmplitude: 0.03,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const uniforms = currentMockWaterEffect?.makeShaderCalls[0];
    expect(uniforms).toHaveLength(11);
    // slots [2..4] = color.rgb
    expect(uniforms?.[2]).toBeCloseTo(0.2);
    expect(uniforms?.[3]).toBeCloseTo(0.4);
    expect(uniforms?.[4]).toBeCloseTo(0.6);
    // slots [5..7] = foamColor.rgb
    expect(uniforms?.[5]).toBeCloseTo(0.9);
    expect(uniforms?.[6]).toBeCloseTo(0.95);
    expect(uniforms?.[7]).toBeCloseTo(1.0);
    // slot [8] = waveSpeed
    expect(uniforms?.[8]).toBeCloseTo(1.2);
    // slot [9] = waveAmplitude
    expect(uniforms?.[9]).toBeCloseTo(0.03);
    // slot [10] = time
    expect(uniforms?.[10]).toBeCloseTo(2.5);
  });

  it('no-op on missing Skia RuntimeEffect — water returns defaultPaint without throwing', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const effect: WaterEffect = {
      type: 'water',
      color: { r: 0.1, g: 0.3, b: 0.8, a: 1 },
      foamColor: { r: 1, g: 1, b: 1, a: 1 },
      waveSpeed: 1.5,
      waveAmplitude: 0.02,
    };
    expect(() => bridge.drawAtlas(mockImage(), [cmd({ effect })])).not.toThrow();
    const call = currentMockCanvas?.drawAtlasCalls[0];
    // defaultPaint has id=1 (first Paint allocated)
    expect(call?.paint.id).toBe(1);
  });

  it('default time=0 — beginFrame(w, h) without time packs 0 into time uniform slot [10]', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithRuntimeEffect());
    bridge.beginFrame(800, 600);
    const effect: WaterEffect = {
      type: 'water',
      color: { r: 0, g: 0, b: 1, a: 1 },
      foamColor: { r: 1, g: 1, b: 1, a: 1 },
      waveSpeed: 1.0,
      waveAmplitude: 0.01,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const uniforms = currentMockWaterEffect?.makeShaderCalls[0];
    expect(uniforms?.[10]).toBe(0);
  });

  it('beginFrame(w, h, 1.5) packs 1.5 into time uniform slot [10]', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithRuntimeEffect());
    bridge.beginFrame(800, 600, 1.5);
    const effect: WaterEffect = {
      type: 'water',
      color: { r: 0, g: 0, b: 1, a: 1 },
      foamColor: { r: 1, g: 1, b: 1, a: 1 },
      waveSpeed: 1.0,
      waveAmplitude: 0.01,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const uniforms = currentMockWaterEffect?.makeShaderCalls[0];
    expect(uniforms?.[10]).toBeCloseTo(1.5);
  });
});

interface MockFogRuntimeEffect {
  makeShaderCalls: Array<readonly number[]>;
  makeCount: number;
  makeShader(uniforms: number[]): MockShader;
}

let currentMockFogEffect: MockFogRuntimeEffect | null = null;

function makeMockFogRuntimeEffect(): MockFogRuntimeEffect {
  const effect: MockFogRuntimeEffect = {
    makeShaderCalls: [],
    makeCount: 0,
    makeShader(u) {
      this.makeShaderCalls.push([...u]);
      return { uniforms: [...u] };
    },
  };
  return effect;
}

function makeMockSkiaWithFogRuntimeEffect(): SkiaModuleLike {
  const base = makeMockSkia();
  currentMockFogEffect = makeMockFogRuntimeEffect();
  const fogRef = currentMockFogEffect;
  return {
    ...base,
    RuntimeEffect: {
      Make(_sksl: string): MockFogRuntimeEffect {
        runtimeEffectMakeCalls++;
        fogRef.makeCount++;
        return fogRef;
      },
    } as unknown as NonNullable<SkiaModuleLike['RuntimeEffect']>,
  };
}

describe('createSkiaFrameRenderer — fog effect', () => {
  it('dispatch hit — drawAtlas with FogEffect calls makeShader on the compiled fog runtime effect', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFogRuntimeEffect());
    bridge.beginFrame(800, 600);
    const effect: FogEffect = {
      type: 'fog',
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      density: 0.5,
      speed: 0.3,
      scale: 2.0,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    expect(currentMockFogEffect?.makeShaderCalls).toHaveLength(1);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.shader).not.toBeNull();
  });

  it('lazy cache reuse — RuntimeEffect.Make called exactly once across two frames with fog', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFogRuntimeEffect());
    const effect: FogEffect = {
      type: 'fog',
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      density: 0.5,
      speed: 0.3,
      scale: 2.0,
    };
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    bridge.endFrame();
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    bridge.endFrame();
    expect(runtimeEffectMakeCalls).toBe(1);
    expect(currentMockFogEffect?.makeShaderCalls).toHaveLength(2);
  });

  it('uniform packing — 9-float array with color/density/speed/scale/time', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFogRuntimeEffect());
    bridge.beginFrame(800, 600, 3.0);
    const effect: FogEffect = {
      type: 'fog',
      color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
      density: 0.7,
      speed: 1.1,
      scale: 3.5,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const uniforms = currentMockFogEffect?.makeShaderCalls[0];
    expect(uniforms).toHaveLength(9);
    expect(uniforms?.[0]).toBe(32); // resolution.x = dstW
    expect(uniforms?.[1]).toBe(32); // resolution.y = dstH
    expect(uniforms?.[2]).toBeCloseTo(0.2);
    expect(uniforms?.[3]).toBeCloseTo(0.4);
    expect(uniforms?.[4]).toBeCloseTo(0.6);
    expect(uniforms?.[5]).toBeCloseTo(0.7);
    expect(uniforms?.[6]).toBeCloseTo(1.1);
    expect(uniforms?.[7]).toBeCloseTo(3.5);
    expect(uniforms?.[8]).toBeCloseTo(3.0);
  });

  it('no-op on missing Skia RuntimeEffect — fog returns defaultPaint without throwing', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const effect: FogEffect = {
      type: 'fog',
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      density: 0.5,
      speed: 0.3,
      scale: 2.0,
    };
    expect(() => bridge.drawAtlas(mockImage(), [cmd({ effect })])).not.toThrow();
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.id).toBe(1);
  });
});

function makeMockFireRuntimeEffect(): MockFireRuntimeEffect {
  const effect: MockFireRuntimeEffect = {
    makeShaderCalls: [],
    makeCount: 0,
    makeShader(u) {
      this.makeShaderCalls.push([...u]);
      return { uniforms: [...u] };
    },
  };
  return effect;
}

function makeMockSkiaWithFireRuntimeEffect(): SkiaModuleLike {
  const base = makeMockSkia();
  currentMockFireEffect = makeMockFireRuntimeEffect();
  const fireRef = currentMockFireEffect;
  return {
    ...base,
    RuntimeEffect: {
      Make(_sksl: string): MockFireRuntimeEffect {
        runtimeEffectMakeCalls++;
        fireRef.makeCount++;
        return fireRef;
      },
    } as unknown as NonNullable<SkiaModuleLike['RuntimeEffect']>,
  };
}

describe('fire effect', () => {
  it('RuntimeEffect.Make(FIRE_SKSL) called on first fire draw', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFireRuntimeEffect());
    bridge.beginFrame(800, 600);
    const effect: FireEffect = {
      type: 'fire',
      color: { r: 1, g: 0.4, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
      speed: 1.0,
      intensity: 0.8,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    expect(runtimeEffectMakeCalls).toBe(1);
    expect(currentMockFireEffect?.makeShaderCalls).toHaveLength(1);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.shader).not.toBeNull();
  });

  it('RuntimeEffect cached — Make called only once across 2 frames', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFireRuntimeEffect());
    const effect: FireEffect = {
      type: 'fire',
      color: { r: 1, g: 0.4, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
      speed: 1.0,
      intensity: 0.8,
    };
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    bridge.endFrame();
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    bridge.endFrame();
    expect(runtimeEffectMakeCalls).toBe(1);
    expect(currentMockFireEffect?.makeShaderCalls).toHaveLength(2);
  });

  it('uniform layout matches FIRE_SKSL declaration order', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFireRuntimeEffect());
    bridge.beginFrame(800, 600, 3.7);
    const effect: FireEffect = {
      type: 'fire',
      color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
      tipColor: { r: 0.9, g: 0.95, b: 1.0, a: 1 },
      speed: 1.5,
      intensity: 0.6,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const uniforms = currentMockFireEffect?.makeShaderCalls[0];
    expect(uniforms).toHaveLength(11);
    // [0,1] = resolution (dstW/H from drawAtlas — set to 32 by cmd() default)
    expect(uniforms?.[0]).toBe(32);
    expect(uniforms?.[1]).toBe(32);
    // [2..4] = color.rgb
    expect(uniforms?.[2]).toBeCloseTo(0.2);
    expect(uniforms?.[3]).toBeCloseTo(0.4);
    expect(uniforms?.[4]).toBeCloseTo(0.6);
    // [5..7] = tipColor.rgb
    expect(uniforms?.[5]).toBeCloseTo(0.9);
    expect(uniforms?.[6]).toBeCloseTo(0.95);
    expect(uniforms?.[7]).toBeCloseTo(1.0);
    // [8] = speed
    expect(uniforms?.[8]).toBeCloseTo(1.5);
    // [9] = intensity
    expect(uniforms?.[9]).toBeCloseTo(0.6);
    // [10] = time
    expect(uniforms?.[10]).toBeCloseTo(3.7);
  });

  it('fire arm in resolveEffectPaint — drawAtlas called, no fallthrough to default', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithFireRuntimeEffect());
    bridge.beginFrame(800, 600);
    const effect: FireEffect = {
      type: 'fire',
      color: { r: 1, g: 0, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
      speed: 1.0,
      intensity: 0.8,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call).toBeDefined();
    // Fire paint has shader set; default paint (id=1) has shader=null.
    expect(call?.paint.shader).not.toBeNull();
    expect(call?.paint.id).not.toBe(1);
  });
});

let imageFilterMakeCalls = 0;
function makeMockSkiaWithImageFilter(): SkiaModuleLike {
  imageFilterMakeCalls = 0;
  const base = makeMockSkia();
  return {
    ...base,
    ImageFilter: {
      MakeDropShadow(dx: number, dy: number, sigmaX: number, sigmaY: number, color: Float32Array) {
        imageFilterMakeCalls++;
        const f: MockImageFilter = {
          kind: 'drop-shadow',
          dx,
          dy,
          sigmaX,
          sigmaY,
          color: new Float32Array(color),
        };
        return f as unknown as ReturnType<
          NonNullable<SkiaModuleLike['ImageFilter']>['MakeDropShadow']
        >;
      },
    } as unknown as NonNullable<SkiaModuleLike['ImageFilter']>,
  };
}

describe('createSkiaFrameRenderer — drop-shadow effect', () => {
  const shadow = { r: 0, g: 0, b: 0, a: 0.5 } as const;

  it('sets a MakeDropShadow filter carrying offset, blur, and tint+opacity', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithImageFilter());
    bridge.beginFrame(800, 600);
    const effect: DropShadowEffect = {
      type: 'drop-shadow',
      offsetX: 3,
      offsetY: 8,
      blur: 5,
      color: shadow,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    expect(imageFilterMakeCalls).toBe(1);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    const filter = call?.paint.imageFilter as MockImageFilter;
    expect(filter?.kind).toBe('drop-shadow');
    expect(filter.dx).toBe(3);
    expect(filter.dy).toBe(8);
    expect(filter.sigmaX).toBe(5);
    expect(filter.sigmaY).toBe(5);
    expect(filter.color[0]).toBeCloseTo(0);
    expect(filter.color[3]).toBeCloseTo(0.5); // color.a is the shadow opacity
    expect(call?.paint.id).not.toBe(1); // dedicated drop-shadow paint, not the default
  });

  it('renders the sprite + shadow in a single drawAtlas pass per batch', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithImageFilter());
    bridge.beginFrame(800, 600);
    const effect: DropShadowEffect = {
      type: 'drop-shadow',
      offsetX: 0,
      offsetY: 6,
      blur: 4,
      color: shadow,
    };
    bridge.drawAtlas(mockImage(), [cmd({ effect }), cmd({ effect })]);
    expect(currentMockCanvas?.drawAtlasCalls).toHaveLength(1);
  });

  it('reuses one paint across frames; the filter is rebuilt per draw', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkiaWithImageFilter());
    const effect: DropShadowEffect = {
      type: 'drop-shadow',
      offsetX: 0,
      offsetY: 6,
      blur: 4,
      color: shadow,
    };
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    const paintsAfterFirst = paintCount;
    bridge.endFrame();
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ effect })]);
    bridge.endFrame();
    expect(paintCount).toBe(paintsAfterFirst); // no new paint on the second frame
    expect(imageFilterMakeCalls).toBe(2); // filter rebuilt each draw
  });

  it('falls back to the default paint when Skia.ImageFilter is absent', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const effect: DropShadowEffect = {
      type: 'drop-shadow',
      offsetX: 0,
      offsetY: 6,
      blur: 4,
      color: shadow,
    };
    expect(() => bridge.drawAtlas(mockImage(), [cmd({ effect })])).not.toThrow();
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.id).toBe(1); // defaultPaint
    expect(call?.paint.imageFilter).toBeNull();
  });
});

describe('createSkiaFrameRenderer — per-sprite alpha', () => {
  it('alpha=1 (default) — paint setAlphaf is called with 1', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ alpha: 1 })]);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paintAlphaf).toBe(1);
  });

  it('alpha=0.5 — paint setAlphaf is called with 0.5', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ alpha: 0.5 })]);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paintAlphaf).toBe(0.5);
  });

  it('alpha=0 — drawAtlas does not crash and paint alpha is 0', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    expect(() => bridge.drawAtlas(mockImage(), [cmd({ alpha: 0 })])).not.toThrow();
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paintAlphaf).toBe(0);
  });

  it('paint alpha is reset to 1 after draw (no state bleed to next call)', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [cmd({ alpha: 0.3 })]);
    bridge.drawAtlas(mockImage(), [cmd({ alpha: 1 })]);
    const calls = currentMockCanvas?.drawAtlasCalls ?? [];
    // Snapshot at draw time — first call should have 0.3
    expect(calls[0]?.paintAlphaf).toBe(0.3);
    expect(calls[1]?.paintAlphaf).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildPostFxPasses
// ---------------------------------------------------------------------------

import type { CompiledPassLike, PostFxChainLike, PostFxRuntimeLike } from '../src/skia-bridge.js';

function makeMockChain(): PostFxChainLike {
  return { enabled: () => [] };
}

interface MockUniformInfo {
  columns: number;
  rows: number;
  slot: number;
}

function makeBuildPassShader(
  uniformDefs: Array<{ name: string; columns: number; rows: number }>,
): CompiledPassLike['shader'] & {
  getUniformCount(): number;
  getUniformName(i: number): string;
  getUniform(i: number): MockUniformInfo;
} {
  let slot = 0;
  const slots: MockUniformInfo[] = [];
  const names: string[] = [];
  for (const d of uniformDefs) {
    slots.push({ columns: d.columns, rows: d.rows, slot });
    names.push(d.name);
    slot += d.columns * d.rows;
  }
  return {
    getUniformCount: () => uniformDefs.length,
    getUniformName: (i) => names[i] ?? '',
    getUniform: (i) => slots[i] ?? { columns: 1, rows: 1, slot: 0 },
    makeShaderWithChildren: (_u, _c) => ({ _kind: 'shader' }),
  };
}

function makePassWithUniforms(
  id: string,
  uniformDefs: Array<{ name: string; columns: number; rows: number }>,
  values: number[],
): CompiledPassLike {
  return {
    id,
    shader: makeBuildPassShader(uniformDefs),
    uniforms: new Float32Array(values),
    children: [],
  };
}

describe('createSkiaFrameRenderer — buildPostFxPasses', () => {
  it('returns [] when runtime is null', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    expect(bridge.buildPostFxPasses(null, makeMockChain(), 800, 600)).toEqual([]);
  });

  it('returns [] when runtime.supported is false', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: false, buildPass: () => [] };
    expect(bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600)).toEqual([]);
  });

  it('returns [] when runtime.buildPass is undefined (legacy fallback path)', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: true };
    expect(bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600)).toEqual([]);
  });

  it('returns [] when chain is null and no binding set', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [] };
    expect(bridge.buildPostFxPasses(runtime, null, 800, 600)).toEqual([]);
  });

  it('returns [] when buildPass returns empty array', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = {
      supported: true,
      buildPass: () => [],
    };
    expect(bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600)).toEqual([]);
  });

  it('returns a descriptor per CompiledPass with id, source, uniforms record, children', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const pass = makePassWithUniforms(
      'composite',
      [{ name: 'intensity', columns: 1, rows: 1 }],
      [0.5],
    );
    const runtime: PostFxRuntimeLike = {
      supported: true,
      buildPass: () => [pass],
    };
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('composite');
    expect(result[0]?.source).toBe(pass.shader);
    expect(result[0]?.children).toEqual([]);
  });

  it('scalar uniform: named key maps to number value', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const pass = makePassWithUniforms(
      'p',
      [
        { name: 'a', columns: 1, rows: 1 },
        { name: 'b', columns: 1, rows: 1 },
      ],
      [1, 2],
    );
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [pass] };
    const [desc] = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect((desc!.uniforms as Record<string, unknown>).a).toBe(1);
    expect((desc!.uniforms as Record<string, unknown>).b).toBe(2);
  });

  it('vector uniform: named key maps to number[] of correct length', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const pass = makePassWithUniforms(
      'p',
      [{ name: 'color', columns: 3, rows: 1 }],
      [0.1, 0.2, 0.3],
    );
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [pass] };
    const [desc] = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    const color = (desc!.uniforms as Record<string, unknown>).color;
    expect(Array.isArray(color)).toBe(true);
    expect(color).toHaveLength(3);
    expect((color as number[])[0]).toBeCloseTo(0.1);
    expect((color as number[])[1]).toBeCloseTo(0.2);
    expect((color as number[])[2]).toBeCloseTo(0.3);
  });

  it('mixed scalar and vector uniforms pack correctly', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    // composite-like: scalar 'vignetteIntensity', vec3 'vignetteColor'
    const pass = makePassWithUniforms(
      'composite',
      [
        { name: 'vignetteIntensity', columns: 1, rows: 1 },
        { name: 'vignetteColor', columns: 3, rows: 1 },
      ],
      [0.35, 0.0, 0.0, 0.0],
    );
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [pass] };
    const [desc] = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    const u = desc?.uniforms as Record<string, unknown>;
    expect(u.vignetteIntensity).toBeCloseTo(0.35);
    expect(Array.isArray(u.vignetteColor)).toBe(true);
    expect((u.vignetteColor as number[]).length).toBe(3);
  });

  it('uses setPostFxBinding when runtime/chain args are null', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const pass = makePassWithUniforms('p', [{ name: 'x', columns: 1, rows: 1 }], [1]);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [pass] };
    const chain = makeMockChain();
    bridge.setPostFxBinding(runtime, chain);
    const result = bridge.buildPostFxPasses(null, null, 800, 600);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('p');
  });

  it('beginFrame clears the binding so stale passes are not returned next frame', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const pass = makePassWithUniforms('p', [{ name: 'x', columns: 1, rows: 1 }], [1]);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [pass] };
    bridge.setPostFxBinding(runtime, makeMockChain());
    bridge.endFrame();
    // new frame — binding was cleared
    bridge.beginFrame(800, 600);
    const result = bridge.buildPostFxPasses(null, null, 800, 600);
    expect(result).toEqual([]);
  });

  it('pass order is preserved (first descriptor corresponds to first CompiledPass)', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const p1 = makePassWithUniforms('bloom', [{ name: 'i', columns: 1, rows: 1 }], [1]);
    const p2 = makePassWithUniforms('vignette', [{ name: 'i', columns: 1, rows: 1 }], [2]);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [p1, p2] };
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect(result[0]?.id).toBe('bloom');
    expect(result[1]?.id).toBe('vignette');
  });

  it('buildPostFxPasses forwards logical w/h to rt.buildPass regardless of pixelDensity', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    // Frame recorded at pd=2 → physical bounds 800×1200, but w/h args to buildPostFxPasses are logical.
    bridge.beginFrame(400, 600, 0, 2);
    const buildPassArgs: [number, number][] = [];
    const runtime: PostFxRuntimeLike = {
      supported: true,
      buildPass: (_ch, w, h) => {
        buildPassArgs.push([w, h]);
        return [];
      },
    };
    bridge.buildPostFxPasses(runtime, makeMockChain(), 400, 600);
    expect(buildPassArgs).toHaveLength(1);
    expect(buildPassArgs[0]).toEqual([400, 600]);
  });

  it('hasPostFxBinding returns false when nothing has been bound', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    expect(bridge.hasPostFxBinding()).toBe(false);
  });

  it('hasPostFxBinding returns false when runtime is bound but chain is null', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [] };
    bridge.setPostFxBinding(runtime, null);
    expect(bridge.hasPostFxBinding()).toBe(false);
  });

  it('hasPostFxBinding returns false when chain is bound but runtime.supported is false', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: false, buildPass: () => [] };
    bridge.setPostFxBinding(runtime, makeMockChain());
    expect(bridge.hasPostFxBinding()).toBe(false);
  });

  it('hasPostFxBinding returns false when runtime + chain are bound but buildPass is absent', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: true };
    bridge.setPostFxBinding(runtime, makeMockChain());
    expect(bridge.hasPostFxBinding()).toBe(false);
  });

  it('hasPostFxBinding returns true when runtime (supported, with buildPass) and chain are both bound', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [] };
    bridge.setPostFxBinding(runtime, makeMockChain());
    expect(bridge.hasPostFxBinding()).toBe(true);
  });

  it('hasPostFxBinding does not call runtime.buildPass (safe on web — building would throw)', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime: PostFxRuntimeLike = {
      supported: true,
      buildPass: (): never => {
        throw new Error('buildPass must not be called');
      },
    };
    bridge.setPostFxBinding(runtime, makeMockChain());
    expect(() => bridge.hasPostFxBinding()).not.toThrow();
    expect(bridge.hasPostFxBinding()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// per-sprite rotation — fillXforms
// ---------------------------------------------------------------------------

describe('createSkiaFrameRenderer — per-sprite rotation', () => {
  it('θ=0 top-left anchor: RSXform matches current non-rotation path', () => {
    // scale = dstW/srcW = 32/32 = 1; tx = dstX, ty = dstY
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 100,
        dstY: 100,
        dstW: 32,
        dstH: 32,
        rotation: 0,
        anchorX: 0,
        anchorY: 0,
      }),
    ]);
    const xform = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;
    expect(xform.scos).toBeCloseTo(1);
    expect(xform.ssin).toBeCloseTo(0);
    expect(xform.tx).toBeCloseTo(100);
    expect(xform.ty).toBeCloseTo(100);
  });

  it('θ=π center anchor (0.5,0.5): 180° about center — anchor lands at world anchor point', () => {
    // sprite at (84,84) top-left (= world (100,100) - 0.5*32), 32×32, center anchor
    // scale = 1; c=-1, s≈0; scos=-1, ssin=0
    // px = 84 + 0.5*32 = 100, py = 84 + 0.5*32 = 100
    // axSrc=16, aySrc=16
    // tx = 100 - (-1)*16 + 0*16 = 100 + 16 = 116? No — wait.
    // Actually dstX in the command is already anchor-baked: dstX = pos.x - anchorX*dstW = 100 - 16 = 84
    // px = dstX + anchorX*dstW + dx = 84 + 16 + 0 = 100
    // tx = px - scos*axSrc + ssin*aySrc = 100 - (-1)*16 + 0*16 = 116 ← NOT 100
    // Hmm, let me recalculate with the RSXform formula.
    // RSXform(scos, ssin, tx, ty): maps src-local (ax, ay) to world via:
    //   worldX = scos*(x - ax) - ssin*(y - ay) + tx
    //   worldY = ssin*(x - ax) + scos*(y - ay) + ty
    // We want the anchor (axSrc, aySrc) in src space to map to (px, py) in world.
    // tx = px - scos*axSrc + ssin*aySrc = 100 - (-1*16) + 0*16 = 116
    // ty = py - ssin*axSrc - scos*aySrc = 100 - 0*16 - (-1*16) = 116
    // The xform IS correct — the anchor pixel lands at world (100,100):
    //   worldX = scos*(axSrc - axSrc) - ssin*(aySrc - aySrc) + tx = 0 + 116 = 116 ← wrong
    // Actually Skia RSXform(scos,ssin,tx,ty) draws the src quad where:
    //   top-left src (0,0) → world (tx, ty)
    //   after applying the similarity: worldPos = R*scale*(srcPos - pivot) + pivotWorld
    // The RSXform encodes: maps src point (ax,ay) to world pivot, with rotation about it.
    // Correct formula from Skia source: for src corner (x,y):
    //   dstX = scos*x - ssin*y + tx
    //   dstY = ssin*x + scos*y + ty
    // So tx,ty is where src (0,0) lands. To put anchor (axSrc,aySrc) at (px,py):
    //   px = scos*axSrc - ssin*aySrc + tx → tx = px - scos*axSrc + ssin*aySrc
    //   py = ssin*axSrc + scos*aySrc + ty → ty = py - ssin*axSrc - scos*aySrc
    // For θ=π, center: scos=-1, ssin≈0, px=py=100, axSrc=aySrc=16
    //   tx = 100 - (-1)*16 + 0 = 116
    //   ty = 100 - 0 - (-1)*16 = 116
    // So the 180° sprite has tx=ty=116 (the top-left corner of the rotated quad lands at 116,116).
    // The anchor (center) still maps to (100,100) in world space. This is correct.
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 84,
        dstY: 84,
        dstW: 32,
        dstH: 32,
        rotation: Math.PI,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    ]);
    const xform = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;
    const scale = 1;
    expect(xform.scos).toBeCloseTo(-scale);
    expect(xform.ssin).toBeCloseTo(0);
    // tx = 100 - (-1)*16 + 0*16 = 116
    expect(xform.tx).toBeCloseTo(116);
    // ty = 100 - 0*16 - (-1)*16 = 116
    expect(xform.ty).toBeCloseTo(116);
  });

  it('θ=π/2 (90° CW) center anchor: scos≈0, ssin≈scale, tx/ty correct', () => {
    // dstX=84, dstY=84 (anchor-baked for center of 32×32 at world (100,100))
    // scale=1, c≈0, s≈1; scos≈0, ssin≈1
    // px=100, py=100; axSrc=16, aySrc=16
    // tx = 100 - 0*16 + 1*16 = 116
    // ty = 100 - 1*16 - 0*16 = 84
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 84,
        dstY: 84,
        dstW: 32,
        dstH: 32,
        rotation: Math.PI / 2,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    ]);
    const xform = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;
    expect(xform.scos).toBeCloseTo(0);
    expect(xform.ssin).toBeCloseTo(1);
    expect(xform.tx).toBeCloseTo(116);
    expect(xform.ty).toBeCloseTo(84);
  });

  it('outline effect with rotation: dx/dy offset is applied to the rotated xform', () => {
    // With outline effect, drawOutlined calls fillXforms multiple times with dx/dy offsets.
    // The dx offset shifts the world anchor point px by dx (it adds to dstX+anchorX*dstW+dx).
    // Test: outline sprite at dstX=84, center anchor, θ=π/2, width=2.
    // One of the 8 passes uses offset (2, 0) → px = 102 instead of 100.
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const effect: OutlineEffect = {
      type: 'outline',
      color: { r: 1, g: 0, b: 0, a: 1 },
      width: 2,
    };
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 84,
        dstY: 84,
        dstW: 32,
        dstH: 32,
        rotation: Math.PI / 2,
        anchorX: 0.5,
        anchorY: 0.5,
        effect,
      }),
    ]);
    const calls = currentMockCanvas?.drawAtlasCalls ?? [];
    // 8 outline passes + 1 main pass = 9 total
    expect(calls).toHaveLength(9);
    // Main pass (index 8) at θ=π/2 with dx=dy=0:
    // scos≈0, ssin≈1, tx≈116, ty≈84
    const mainXform = calls[8]?.dsts[0] as MockXform;
    expect(mainXform.scos).toBeCloseTo(0);
    expect(mainXform.ssin).toBeCloseTo(1);
    expect(mainXform.tx).toBeCloseTo(116);
    expect(mainXform.ty).toBeCloseTo(84);
    // Confirm at least one offset pass differs from the main pass tx/ty
    const offsetXforms = calls.slice(0, 8).map((c) => c.dsts[0] as MockXform);
    const anyDiffers = offsetXforms.some(
      (xf) => Math.abs(xf.tx - mainXform.tx) > 0.01 || Math.abs(xf.ty - mainXform.ty) > 0.01,
    );
    expect(anyDiffers).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// per-sprite rotation — independent round-trip verification
//
// applyXform: Skia RSXform(scos, ssin, tx, ty) maps a src-space point (x, y)
// to world space via:  wx = scos*x - ssin*y + tx
//                      wy = ssin*x + scos*y + ty
// ---------------------------------------------------------------------------

function applyXform(
  xf: { scos: number; ssin: number; tx: number; ty: number },
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: xf.scos * x - xf.ssin * y + xf.tx, y: xf.ssin * x + xf.scos * y + xf.ty };
}

describe('createSkiaFrameRenderer — per-sprite rotation round-trip', () => {
  it('θ=π center anchor: anchor src point maps back to world anchor position', () => {
    // Sprite 32×32, center anchor (0.5,0.5), world anchor (100,100).
    // dstX = 100 - 0.5*32 = 84, dstY = 84.
    // axSrc = 0.5*32 = 16, aySrc = 0.5*32 = 16.
    // For θ=π: cos=-1, sin=0.
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 84,
        dstY: 84,
        dstW: 32,
        dstH: 32,
        rotation: Math.PI,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    ]);
    const xf = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;
    const axSrc = 0.5 * 32;
    const aySrc = 0.5 * 32;
    // The anchor src-point must map to the world anchor (100, 100).
    const anchorWorld = applyXform(xf, axSrc, aySrc);
    expect(anchorWorld.x).toBeCloseTo(100);
    expect(anchorWorld.y).toBeCloseTo(100);

    // First-principles expected position for the top-left corner (0,0):
    // offset from anchor in src space: (0-axSrc, 0-aySrc) = (-16, -16)
    // R(π) * scale=1 * offset = (cos*(-16) - sin*(-16), sin*(-16) + cos*(-16))
    //                         = ((-1)*(-16) - 0*(-16), 0*(-16) + (-1)*(-16))
    //                         = (16, 16)
    // expected world = anchorWorld + (16, 16) = (116, 116)
    const c = Math.cos(Math.PI);
    const s = Math.sin(Math.PI);
    const scale = 1;
    const offX = scale * (0 - axSrc);
    const offY = scale * (0 - aySrc);
    const expectedCorner = {
      x: 100 + (c * offX - s * offY),
      y: 100 + (s * offX + c * offY),
    };
    const topLeft = applyXform(xf, 0, 0);
    expect(topLeft.x).toBeCloseTo(expectedCorner.x);
    expect(topLeft.y).toBeCloseTo(expectedCorner.y);
  });

  it('θ=-π/2 center anchor: ssin negative, anchor maps to world anchor, corner first-principles', () => {
    // θ = -π/2: cos=0, sin=-1 → scos≈0, ssin≈-1 (CW/CCW sign guard)
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 84,
        dstY: 84,
        dstW: 32,
        dstH: 32,
        rotation: -Math.PI / 2,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    ]);
    const xf = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;

    // Sign guard: ssin must be negative (distinguishes from +π/2 test's +1).
    expect(xf.ssin).toBeCloseTo(-1);
    expect(xf.scos).toBeCloseTo(0);

    // Anchor round-trip.
    const axSrc = 0.5 * 32;
    const aySrc = 0.5 * 32;
    const anchorWorld = applyXform(xf, axSrc, aySrc);
    expect(anchorWorld.x).toBeCloseTo(100);
    expect(anchorWorld.y).toBeCloseTo(100);

    // First-principles for top-right corner (32, 0):
    // offset from anchor: (32-16, 0-16) = (16, -16)
    // R(-π/2): cos=0, sin=-1
    // rotated offset = (0*16 - (-1)*(-16), (-1)*16 + 0*(-16)) = (0-16, -16+0) = (-16, -16)
    // expected world = (100-16, 100-16) = (84, 84)
    const c = Math.cos(-Math.PI / 2);
    const s = Math.sin(-Math.PI / 2);
    const scale = 1;
    const offX = scale * (32 - axSrc);
    const offY = scale * (0 - aySrc);
    const expectedCorner = {
      x: 100 + (c * offX - s * offY),
      y: 100 + (s * offX + c * offY),
    };
    const topRight = applyXform(xf, 32, 0);
    expect(topRight.x).toBeCloseTo(expectedCorner.x);
    expect(topRight.y).toBeCloseTo(expectedCorner.y);
  });

  it('θ=π/2 non-center anchor (anchorX=0.5, anchorY=0): anchor and corner via first principles', () => {
    // Anchor is top-center: axSrc=16, aySrc=0.
    // World anchor = (100, 100).
    // dstX = 100 - 0.5*32 = 84, dstY = 100 - 0*32 = 100.
    // θ=π/2: cos=0, sin=1.
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 84,
        dstY: 100,
        dstW: 32,
        dstH: 32,
        rotation: Math.PI / 2,
        anchorX: 0.5,
        anchorY: 0,
      }),
    ]);
    const xf = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;

    const axSrc = 0.5 * 32; // = 16
    const aySrc = 0.0 * 32; // = 0

    // Anchor must map to world (100, 100).
    const anchorWorld = applyXform(xf, axSrc, aySrc);
    expect(anchorWorld.x).toBeCloseTo(100);
    expect(anchorWorld.y).toBeCloseTo(100);

    // First-principles for bottom-left corner (0, 32):
    // offset from anchor in src space: (0-16, 32-0) = (-16, 32)
    // R(π/2): cos=0, sin=1
    // rotated offset = (0*(-16) - 1*32, 1*(-16) + 0*32) = (-32, -16)
    // expected world = (100-32, 100-16) = (68, 84)
    const c = Math.cos(Math.PI / 2);
    const s = Math.sin(Math.PI / 2);
    const scale = 1;
    const offX = scale * (0 - axSrc);
    const offY = scale * (32 - aySrc);
    const expectedCorner = {
      x: 100 + (c * offX - s * offY),
      y: 100 + (s * offX + c * offY),
    };
    const bottomLeft = applyXform(xf, 0, 32);
    expect(bottomLeft.x).toBeCloseTo(expectedCorner.x);
    expect(bottomLeft.y).toBeCloseTo(expectedCorner.y);
  });

  it('rotation omitted vs rotation:0 produce identical RSXform', () => {
    // Omitting rotation in cmd defaults to 0; explicit 0 must yield the same xform.
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 50,
        dstY: 70,
        dstW: 32,
        dstH: 32,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    ]);
    const xfOmitted = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;

    // The second bridge's makeMockSkia reassigns currentMockCanvas via side
    // effect — no manual reset (which would narrow the type to null for tsc).
    const bridge2 = createSkiaFrameRenderer(makeMockSkia());
    bridge2.beginFrame(800, 600);
    bridge2.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 50,
        dstY: 70,
        dstW: 32,
        dstH: 32,
        rotation: 0,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    ]);
    const xfExplicit = currentMockCanvas?.drawAtlasCalls[0]?.dsts[0] as MockXform;

    expect(xfExplicit.scos).toBeCloseTo(xfOmitted.scos);
    expect(xfExplicit.ssin).toBeCloseTo(xfOmitted.ssin);
    expect(xfExplicit.tx).toBeCloseTo(xfOmitted.tx);
    expect(xfExplicit.ty).toBeCloseTo(xfOmitted.ty);
  });
});

describe('createSkiaFrameRenderer — stretch (drawImageRect) path', () => {
  it('non-uniform proof: stretch command produces drawImageRect dst with independent W and H', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcX: 0,
        srcY: 0,
        srcW: 2,
        srcH: 2,
        dstX: 0,
        dstY: 0,
        dstW: 4,
        dstH: 8,
        stretch: true,
      }),
    ]);
    expect(currentMockCanvas?.drawImageRectCalls).toHaveLength(1);
    expect(currentMockCanvas?.drawAtlasCalls).toHaveLength(0);
    const call = currentMockCanvas?.drawImageRectCalls[0];
    // dst width and height must be honored independently — not squared to the src aspect.
    expect(call?.dst.width).toBe(4);
    expect(call?.dst.height).toBe(8);
    expect(call?.dst.width).not.toBe(call?.dst.height);
  });

  it('default path unchanged: command without stretch routes through drawAtlas', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 32,
        srcH: 32,
        dstX: 0,
        dstY: 0,
        dstW: 64,
        dstH: 64,
        stretch: false,
      }),
    ]);
    expect(currentMockCanvas?.drawAtlasCalls).toHaveLength(1);
    expect(currentMockCanvas?.drawImageRectCalls).toHaveLength(0);
  });

  it('stretch honors alpha and anchor: 0.5 anchor centers dst on position', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    // Position (200, 300) with anchor (0.5, 0.5) and dst size 100×200.
    // SpriteBatch.draw() bakes anchor into dstX/dstY:
    //   dstX = pos.x - anchorX * dstW = 200 - 0.5*100 = 150
    //   dstY = pos.y - anchorY * dstH = 300 - 0.5*200 = 200
    bridge.drawAtlas(mockImage(), [
      cmd({
        srcW: 10,
        srcH: 10,
        dstX: 150,
        dstY: 200,
        dstW: 100,
        dstH: 200,
        alpha: 0.75,
        anchorX: 0.5,
        anchorY: 0.5,
        stretch: true,
      }),
    ]);
    const call = currentMockCanvas?.drawImageRectCalls[0];
    // dst rect top-left = (150, 200), size = (100, 200)
    expect(call?.dst.x).toBe(150);
    expect(call?.dst.y).toBe(200);
    expect(call?.dst.width).toBe(100);
    expect(call?.dst.height).toBe(200);
    // alpha applied to paint
    expect(call?.paintAlphaf).toBe(0.75);
  });
});
