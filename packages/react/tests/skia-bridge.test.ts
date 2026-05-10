import { beforeEach, describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type {
  CustomShaderEffect,
  FlashEffect,
  FogEffect,
  GrayscaleEffect,
  OutlineEffect,
  SpriteDrawCommand,
  TintEffect,
  WaterEffect,
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
  alphaf: number;
  setColorFilter(filter: MockColorFilter | null): void;
  setShader(shader: MockShader | null): void;
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
let beginRecordingBoundsArgs: Array<{ x: number; y: number; width: number; height: number }> = [];

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
        alphaf: 1,
        setColorFilter(filter) {
          this.colorFilter = filter;
        },
        setShader(shader) {
          this.shader = shader;
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

interface MockWaterRuntimeEffect {
  makeShaderCalls: Array<readonly number[]>;
  makeCount: number;
  makeShader(uniforms: number[]): MockShader;
}

let runtimeEffectMakeCalls = 0;
let currentMockWaterEffect: MockWaterRuntimeEffect | null = null;

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
});

describe('createSkiaFrameRenderer', () => {
  it('allocates a single Paint, PictureRecorder, and bounds rect up front', () => {
    createSkiaFrameRenderer(makeMockSkia());
    expect(paintCount).toBe(1);
    expect(recorderCount).toBe(1);
    // One XYWHRect pre-allocated for the recording bounds, reused each frame.
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
    // 1 pre-allocated bounds rect + 3 pool entries
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
    // 1 pre-allocated bounds rect + 1 pool entry
    expect(xywhCount).toBe(2);
    bridge.drawAtlas(mockImage(), [cmd({}), cmd({}), cmd({})]);
    // 1 pre-allocated bounds rect + 3 pool entries
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
    expect(uniforms?.[0]).toBe(0);
    expect(uniforms?.[1]).toBe(0);
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
// applyPostFx
// ---------------------------------------------------------------------------

import type { PostFxChainLike, PostFxRuntimeLike } from '../src/skia-bridge.js';

interface MockPostFxRuntime extends PostFxRuntimeLike {
  applyCalls: Array<{
    canvas: unknown;
    chain: PostFxChainLike;
    source: unknown;
    width: number;
    height: number;
  }>;
}

function makeMockPostFxRuntime(supported: boolean): MockPostFxRuntime {
  return {
    supported,
    applyCalls: [],
    apply(canvas, chain, source, width, height) {
      this.applyCalls.push({ canvas, chain, source, width, height });
    },
  };
}

function makeMockChain(): PostFxChainLike {
  return { enabled: () => [] };
}

describe('createSkiaFrameRenderer — applyPostFx', () => {
  it('no-op before beginFrame — apply never called on runtime', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    const runtime = makeMockPostFxRuntime(true);
    const chain = makeMockChain();
    const source = mockImage();

    bridge.applyPostFx(runtime, chain, source, 800, 600);

    expect(runtime.applyCalls).toHaveLength(0);
  });

  it('source === null — apply never called on runtime', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime = makeMockPostFxRuntime(true);
    const chain = makeMockChain();

    bridge.applyPostFx(runtime, chain, null, 800, 600);

    expect(runtime.applyCalls).toHaveLength(0);
  });

  it('delegates to runtime.apply with current canvas, chain, source, width, height', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime = makeMockPostFxRuntime(true);
    const chain = makeMockChain();
    const source = mockImage();

    bridge.applyPostFx(runtime, chain, source, 800, 600);

    expect(runtime.applyCalls).toHaveLength(1);
    const call = runtime.applyCalls[0]!;
    expect(call.source).toBe(source);
    expect(call.chain).toBe(chain);
    expect(call.width).toBe(800);
    expect(call.height).toBe(600);
    expect(call.canvas).not.toBeNull();
  });

  it('no-op when runtime.supported is false — apply never called', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const runtime = makeMockPostFxRuntime(false);
    const chain = makeMockChain();
    const source = mockImage();

    bridge.applyPostFx(runtime, chain, source, 800, 600);

    expect(runtime.applyCalls).toHaveLength(0);
  });
});
