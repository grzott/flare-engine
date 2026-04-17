import { beforeEach, describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type {
  CustomShaderEffect,
  FlashEffect,
  GrayscaleEffect,
  OutlineEffect,
  SpriteDrawCommand,
  TintEffect,
} from '@flare-engine/render';
import { type SkiaModuleLike, createSkiaFrameRenderer } from '../src/skia-bridge.js';

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

interface MockPaint {
  readonly id: number;
  colorFilter: MockColorFilter | null;
  shader: MockShader | null;
  setColorFilter(filter: MockColorFilter | null): void;
  setShader(shader: MockShader | null): void;
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
  }>;
  clearCalls: Float32Array[];
}

let xywhCount = 0;
let rsxformCount = 0;
let paintCount = 0;
let recorderCount = 0;
let colorFilterBlendCalls: Array<{ color: Float32Array; mode: number }> = [];
let colorFilterMatrixCalls: Array<readonly number[]> = [];
let currentMockCanvas: MockCanvas | null = null;
let finishCalls = 0;

function createMockCanvas(): MockCanvas {
  return { drawAtlasCalls: [], clearCalls: [] };
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
        setColorFilter(filter) {
          this.colorFilter = filter;
        },
        setShader(shader) {
          this.shader = shader;
        },
      };
      return p as unknown as ReturnType<SkiaModuleLike['Paint']>;
    },
    PictureRecorder: () => {
      recorderCount++;
      const recorder = {
        beginRecording(): unknown {
          const canvas: MockCanvas & {
            save(): number;
            restore(): void;
            translate(x: number, y: number): void;
            scale(sx: number, sy: number): void;
            rotate(r: number, cx: number, cy: number): void;
            clear(color: Float32Array): void;
            drawAtlas(
              image: unknown,
              srcs: readonly unknown[],
              dsts: readonly unknown[],
              paint: MockPaint,
            ): void;
          } = {
            ...createMockCanvas(),
            save: () => 0,
            restore: () => {},
            translate: () => {},
            scale: () => {},
            rotate: () => {},
            clear(color) {
              this.clearCalls.push(new Float32Array(color));
            },
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
  return { width: () => 64, height: () => 64 };
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
});

describe('createSkiaFrameRenderer', () => {
  it('allocates a single Paint and PictureRecorder up front', () => {
    createSkiaFrameRenderer(makeMockSkia());
    expect(paintCount).toBe(1);
    expect(recorderCount).toBe(1);
    expect(xywhCount).toBe(0);
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
    bridge.beginFrame();
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
    bridge.beginFrame();
    bridge.drawAtlas(img, [cmd({ dstX: 0 }), cmd({ dstX: 10 }), cmd({ dstX: 20 })]);
    const calls = currentMockCanvas?.drawAtlasCalls;
    expect(calls).toHaveLength(1);
    expect(calls?.[0]?.srcs).toHaveLength(3);
    expect(calls?.[0]?.dsts).toHaveLength(3);
  });

  it('pool grows once then is stable on repeated same-size calls', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    const xywhAfterFirst = xywhCount;
    const rsxformAfterFirst = rsxformCount;
    expect(xywhAfterFirst).toBe(3);
    expect(rsxformAfterFirst).toBe(3);

    // Second call with same size — pool is reused, no new allocations.
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    expect(xywhCount).toBe(xywhAfterFirst);
    expect(rsxformCount).toBe(rsxformAfterFirst);
  });

  it('pool grows to max-seen when a later call is larger', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
    bridge.drawAtlas(mockImage(), [cmd({})]);
    expect(xywhCount).toBe(1);
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    expect(xywhCount).toBe(3);
    expect(rsxformCount).toBe(3);
  });

  it('endFrame returns the finished picture and clears state', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
    const picture = bridge.endFrame();
    expect(picture).toBeDefined();
    expect(finishCalls).toBe(1);
    // A subsequent endFrame without a beginFrame yields null.
    expect(bridge.endFrame()).toBeNull();
  });

  it('canvas adapter clears with unpacked ARGB components', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
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
});

describe('createSkiaFrameRenderer — sprite effects', () => {
  it('batches with no effect use the default shared paint', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({})]);
    const call = currentMockCanvas?.drawAtlasCalls[0];
    expect(call?.paint.id).toBe(1);
    expect(call?.paint.colorFilter).toBeNull();
    expect(call?.paint.shader).toBeNull();
  });

  it('tint effect assigns a MakeBlend color filter with amount-scaled alpha', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
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
    bridge.beginFrame();
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
    bridge.beginFrame();
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
    bridge.beginFrame();
    const none: GrayscaleEffect = { type: 'grayscale', amount: 0 };
    bridge.drawAtlas(mockImage(), [cmd({ effect: none })]);
    const matrix = colorFilterMatrixCalls[0]!;
    expect(matrix[0]).toBeCloseTo(1);
    expect(matrix[6]).toBeCloseTo(1);
    expect(matrix[12]).toBeCloseTo(1);
  });

  it('outline effect issues 9 drawAtlas passes (8 offsets + main) with SrcIn filter', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame();
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
    bridge.beginFrame();
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

    bridge.beginFrame();
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
    bridge.beginFrame();
    bridge.drawAtlas(mockImage(), [cmd({ effect: tintFx }), cmd({ effect: tintFx })]);
    bridge.endFrame();
    const paintsAfterWarmup = paintCount;
    const xywhAfterWarmup = xywhCount;
    const rsxformAfterWarmup = rsxformCount;

    // Frame 2 — same shape, expect no new paint, rect, or xform allocations.
    bridge.beginFrame();
    bridge.drawAtlas(mockImage(), [cmd({ effect: tintFx }), cmd({ effect: tintFx })]);
    bridge.endFrame();
    expect(paintCount).toBe(paintsAfterWarmup);
    expect(xywhCount).toBe(xywhAfterWarmup);
    expect(rsxformCount).toBe(rsxformAfterWarmup);
  });
});
