import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, RuntimeEffectLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import {
  type AnySpriteEffect,
  CAVE_INTERIOR_SKSL,
  caveInterior,
  FOREST_CANOPY_SKSL,
  forestCanopy,
  MOON_CRATER_SKSL,
  MOUNTAIN_HILLS_SKSL,
  moonCrater,
  mountainHills,
  RIVER_WAVE_SKSL,
  ROOFS_CITY_SKSL,
  riverWave,
  roofsCity,
} from '../src/index.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';

// ---------------------------------------------------------------------------
// Pins what the frame renderer hands Skia for each zone-bg effect: the SkSL
// constant it compiles and the ten uniform slots it writes. Every effect field
// carries a value no other field of that effect shares, so a swapped or
// dropped slot changes the expected array.
//
// Recording FrameRendererModule stub — same shape as the one in
// zone-bg-effects.test.ts, extended to capture `RuntimeEffect.Make` and
// `makeShader` arguments.
// ---------------------------------------------------------------------------

interface ShaderCall {
  /** SkSL the effect that built this shader was compiled from. */
  sksl: string;
  /** The array instance handed to `makeShader` — the renderer's own buffer. */
  buffer: number[];
  /** Its contents at call time; the buffer itself is rewritten every frame. */
  values: number[];
}

interface UniformLog {
  /** SkSL handed to each `RuntimeEffect.Make`, in call order. */
  makeCalls: string[];
  shaderCalls: ShaderCall[];
  paintCount: number;
  rectCalls: number;
  warnings: string[];
}

function makeModule(log: UniformLog, compiles: boolean): FrameRendererModule {
  const fakeCanvas = {
    save() {
      return 0;
    },
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clear() {},
    drawAtlas() {},
    drawImageRect() {},
    drawRect() {
      log.rectCalls++;
    },
  };
  function compile(sksl: string): RuntimeEffectLike {
    return {
      makeShader(uniforms) {
        log.shaderCalls.push({ sksl, buffer: uniforms, values: uniforms.slice() });
        return {};
      },
      getUniformCount() {
        return 0;
      },
      getUniformFloatCount() {
        return 0;
      },
      getUniformName() {
        return '';
      },
      getUniform() {
        return { columns: 1, rows: 1, slot: 0 };
      },
    };
  }
  return {
    XYWHRect(x, y, w, h) {
      const r = {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx: number, ny: number, nw: number, nh: number) {
          r.x = nx;
          r.y = ny;
          r.width = nw;
          r.height = nh;
        },
      };
      return r;
    },
    RSXform(_scos, _ssin, _tx, _ty) {
      return { scos: 0, ssin: 0, tx: 0, ty: 0, set() {} };
    },
    Paint() {
      log.paintCount++;
      return {
        setAlphaf() {},
        setColorFilter() {},
        setShader() {},
        setImageFilter() {},
      };
    },
    PictureRecorder() {
      return {
        beginRecording(_bounds: unknown) {
          return fakeCanvas;
        },
        finishRecordingAsPicture() {
          return {};
        },
      };
    },
    ColorFilter: {
      MakeBlend(_color: Float32Array, _mode: number) {
        return {};
      },
      MakeMatrix(_m: number[]) {
        return {};
      },
    },
    RuntimeEffect: {
      Make(sksl) {
        log.makeCalls.push(sksl);
        return compiles ? compile(sksl) : null;
      },
    },
  };
}

function makeCmd(effect: AnySpriteEffect): SpriteDrawCommand {
  return {
    image: {} as SkImageLike,
    srcX: 0,
    srcY: 0,
    srcW: 32,
    srcH: 32,
    dstX: 0,
    dstY: 0,
    dstW: 320,
    dstH: 240,
    effect,
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
    blend: 'normal',
    flipX: false,
    flipY: false,
  };
}

/** Runs `draw` against a fresh renderer, capturing `console.warn` into the returned log. */
function record(
  compiles: boolean,
  draw: (renderer: ReturnType<typeof createFrameRenderer>) => void,
): UniformLog {
  const log: UniformLog = {
    makeCalls: [],
    shaderCalls: [],
    paintCount: 0,
    rectCalls: 0,
    warnings: [],
  };
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    log.warnings.push(args.map(String).join(' '));
  };
  try {
    draw(createFrameRenderer(makeModule(log, compiles)));
  } finally {
    console.warn = originalWarn;
  }
  return log;
}

interface Case {
  type: string;
  sksl: string;
  effect: AnySpriteEffect;
  /** Slot-for-slot contents of the uniform array for `effect`. */
  uniforms: number[];
  /** Same effect type, every field different — proves the buffer is rewritten, not stale. */
  effect2: AnySpriteEffect;
  uniforms2: number[];
}

// Alpha (`a`) is 0.99 throughout and appears in no expected array: the zone-bg
// shaders take rgb only.
const CASES: readonly Case[] = [
  {
    type: 'roofs-city',
    sksl: ROOFS_CITY_SKSL,
    effect: roofsCity({
      skyColor: { r: 0.11, g: 0.12, b: 0.13, a: 0.99 },
      roofColor: { r: 0.14, g: 0.15, b: 0.16, a: 0.99 },
      scrollOffsetY: 17,
      density: 18,
      resolutionW: 191,
      resolutionH: 192,
    }),
    uniforms: [191, 192, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 17, 18],
    effect2: roofsCity({
      skyColor: { r: 0.61, g: 0.62, b: 0.63, a: 0.99 },
      roofColor: { r: 0.64, g: 0.65, b: 0.66, a: 0.99 },
      scrollOffsetY: 67,
      density: 68,
      resolutionW: 691,
      resolutionH: 692,
    }),
    uniforms2: [691, 692, 0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 67, 68],
  },
  {
    type: 'forest-canopy',
    sksl: FOREST_CANOPY_SKSL,
    effect: forestCanopy({
      skyColor: { r: 0.21, g: 0.22, b: 0.23, a: 0.99 },
      leafColor: { r: 0.24, g: 0.25, b: 0.26, a: 0.99 },
      scrollOffsetY: 27,
      density: 28,
      resolutionW: 291,
      resolutionH: 292,
    }),
    uniforms: [291, 292, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 27, 28],
    effect2: forestCanopy({
      skyColor: { r: 0.71, g: 0.72, b: 0.73, a: 0.99 },
      leafColor: { r: 0.74, g: 0.75, b: 0.76, a: 0.99 },
      scrollOffsetY: 77,
      density: 78,
      resolutionW: 791,
      resolutionH: 792,
    }),
    uniforms2: [791, 792, 0.71, 0.72, 0.73, 0.74, 0.75, 0.76, 77, 78],
  },
  {
    type: 'river-wave',
    sksl: RIVER_WAVE_SKSL,
    effect: riverWave({
      waterColor: { r: 0.31, g: 0.32, b: 0.33, a: 0.99 },
      foamColor: { r: 0.34, g: 0.35, b: 0.36, a: 0.99 },
      scrollOffsetY: 37,
      waveScale: 38,
      resolutionW: 391,
      resolutionH: 392,
    }),
    uniforms: [391, 392, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 37, 38],
    effect2: riverWave({
      waterColor: { r: 0.81, g: 0.82, b: 0.83, a: 0.99 },
      foamColor: { r: 0.84, g: 0.85, b: 0.86, a: 0.99 },
      scrollOffsetY: 87,
      waveScale: 88,
      resolutionW: 891,
      resolutionH: 892,
    }),
    uniforms2: [891, 892, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 87, 88],
  },
  {
    type: 'moon-crater',
    sksl: MOON_CRATER_SKSL,
    effect: moonCrater({
      moonColor: { r: 0.41, g: 0.42, b: 0.43, a: 0.99 },
      craterColor: { r: 0.44, g: 0.45, b: 0.46, a: 0.99 },
      scrollOffsetY: 47,
      craterCount: 48,
      resolutionW: 491,
      resolutionH: 492,
    }),
    uniforms: [491, 492, 0.41, 0.42, 0.43, 0.44, 0.45, 0.46, 47, 48],
    effect2: moonCrater({
      moonColor: { r: 0.91, g: 0.92, b: 0.93, a: 0.99 },
      craterColor: { r: 0.94, g: 0.95, b: 0.96, a: 0.99 },
      scrollOffsetY: 97,
      craterCount: 98,
      resolutionW: 991,
      resolutionH: 992,
    }),
    uniforms2: [991, 992, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 97, 98],
  },
  {
    type: 'cave-interior',
    sksl: CAVE_INTERIOR_SKSL,
    effect: caveInterior({
      caveColor: { r: 0.51, g: 0.52, b: 0.53, a: 0.99 },
      glowColor: { r: 0.54, g: 0.55, b: 0.56, a: 0.99 },
      scrollOffsetY: 57,
      stalactiteCount: 58,
      resolutionW: 591,
      resolutionH: 592,
    }),
    uniforms: [591, 592, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 57, 58],
    effect2: caveInterior({
      caveColor: { r: 0.011, g: 0.012, b: 0.013, a: 0.99 },
      glowColor: { r: 0.014, g: 0.015, b: 0.016, a: 0.99 },
      scrollOffsetY: 1017,
      stalactiteCount: 1018,
      resolutionW: 1191,
      resolutionH: 1192,
    }),
    uniforms2: [1191, 1192, 0.011, 0.012, 0.013, 0.014, 0.015, 0.016, 1017, 1018],
  },
  {
    type: 'mountain-hills',
    sksl: MOUNTAIN_HILLS_SKSL,
    effect: mountainHills({
      skyColor: { r: 0.071, g: 0.072, b: 0.073, a: 0.99 },
      hillColor: { r: 0.074, g: 0.075, b: 0.076, a: 0.99 },
      scrollOffsetY: 2017,
      ridgeScale: 2018,
      resolutionW: 2191,
      resolutionH: 2192,
    }),
    uniforms: [2191, 2192, 0.071, 0.072, 0.073, 0.074, 0.075, 0.076, 2017, 2018],
    effect2: mountainHills({
      skyColor: { r: 0.081, g: 0.082, b: 0.083, a: 0.99 },
      hillColor: { r: 0.084, g: 0.085, b: 0.086, a: 0.99 },
      scrollOffsetY: 3017,
      ridgeScale: 3018,
      resolutionW: 3191,
      resolutionH: 3192,
    }),
    uniforms2: [3191, 3192, 0.081, 0.082, 0.083, 0.084, 0.085, 0.086, 3017, 3018],
  },
];

const FRAMES = 3;
const image = {} as SkImageLike;

describe('frame-renderer zone-bg pass — SkSL constant and uniform slots', () => {
  it('the six SkSL constants are distinct, so a swapped constant is detectable', () => {
    expect(new Set(CASES.map((c) => c.sksl)).size).toBe(6);
  });

  for (const c of CASES) {
    it(`${c.type} compiles its own SkSL constant, once`, () => {
      const log = record(true, (renderer) => {
        for (let frame = 0; frame < FRAMES; frame++) {
          renderer.beginFrame(320, 240, frame / 60);
          renderer.drawAtlas(image, [makeCmd(c.effect), makeCmd(c.effect)]);
          renderer.endFrame();
        }
      });
      expect(log.makeCalls.length).toBe(1);
      expect(log.makeCalls[0]).toBe(c.sksl);
      expect(log.warnings.length).toBe(0);
    });

    it(`${c.type} writes its ten uniform slots in order`, () => {
      const log = record(true, (renderer) => {
        renderer.beginFrame(320, 240);
        renderer.drawAtlas(image, [makeCmd(c.effect), makeCmd(c.effect)]);
        renderer.endFrame();
      });
      // One makeShader per run, not per command.
      expect(log.shaderCalls.length).toBe(1);
      expect(log.rectCalls).toBe(2);
      expect(log.shaderCalls[0]?.sksl).toBe(c.sksl);
      expect(log.shaderCalls[0]?.values).toEqual(c.uniforms);
    });

    it(`${c.type} reuses one plain ten-slot array and rewrites it per run`, () => {
      const log = record(true, (renderer) => {
        for (let frame = 0; frame < FRAMES; frame++) {
          renderer.beginFrame(320, 240, frame / 60);
          renderer.drawAtlas(image, [makeCmd(c.effect)]);
          renderer.drawAtlas(image, [makeCmd(c.effect2)]);
          renderer.endFrame();
        }
      });
      expect(log.shaderCalls.length).toBe(2 * FRAMES);
      const buffer = log.shaderCalls[0]?.buffer;
      expect(Array.isArray(buffer)).toBe(true);
      expect(buffer?.length).toBe(10);
      for (let i = 0; i < log.shaderCalls.length; i++) {
        const call = log.shaderCalls[i];
        expect(call?.buffer).toBe(buffer);
        expect(call?.values).toEqual(i % 2 === 0 ? c.uniforms : c.uniforms2);
      }
      // Default paint + one zone-bg paint, both created once.
      expect(log.paintCount).toBe(2);
    });
  }

  it('six effect types on one renderer: each its own SkSL, uniforms and buffer', () => {
    const log = record(true, (renderer) => {
      for (let frame = 0; frame < FRAMES; frame++) {
        renderer.beginFrame(320, 240, frame / 60);
        for (const c of CASES) renderer.drawAtlas(image, [makeCmd(c.effect)]);
        renderer.endFrame();
      }
    });
    expect(log.makeCalls).toEqual(CASES.map((c) => c.sksl));
    expect(log.shaderCalls.length).toBe(CASES.length * FRAMES);
    for (let i = 0; i < log.shaderCalls.length; i++) {
      const c = CASES[i % CASES.length];
      const call = log.shaderCalls[i];
      expect(call?.sksl).toBe(c?.sksl);
      expect(call?.values).toEqual(c?.uniforms);
      // Stable across frames: the same buffer as this type's first-frame call.
      expect(call?.buffer).toBe(log.shaderCalls[i % CASES.length]?.buffer);
    }
    const firstFrameBuffers = log.shaderCalls.slice(0, CASES.length).map((call) => call.buffer);
    expect(new Set(firstFrameBuffers).size).toBe(CASES.length);
    // Default paint + one per effect type.
    expect(log.paintCount).toBe(1 + CASES.length);
    expect(log.warnings.length).toBe(0);
  });

  for (const c of CASES) {
    it(`${c.type} with a failing compile: retried per run with the same SkSL, no paint, no shader`, () => {
      const log = record(false, (renderer) => {
        for (let frame = 0; frame < FRAMES; frame++) {
          renderer.beginFrame(320, 240, frame / 60);
          renderer.drawAtlas(image, [makeCmd(c.effect)]);
          renderer.endFrame();
        }
      });
      expect(log.makeCalls).toEqual([c.sksl, c.sksl, c.sksl]);
      expect(log.shaderCalls.length).toBe(0);
      expect(log.rectCalls).toBe(0);
      // Only the renderer's default paint.
      expect(log.paintCount).toBe(1);
      expect(log.warnings).toEqual([
        '[postfx] zone-bg run skipped: Skia.RuntimeEffect is absent or the shader failed to compile',
      ]);
    });
  }
});
