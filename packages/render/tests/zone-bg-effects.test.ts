import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike, RuntimeEffectLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import {
  type AnySpriteEffect,
  CAVE_INTERIOR_SKSL,
  type CaveInteriorEffect,
  caveInterior,
  FOREST_CANOPY_SKSL,
  type ForestCanopyEffect,
  forestCanopy,
  MOON_CRATER_SKSL,
  MOUNTAIN_HILLS_SKSL,
  type MoonCraterEffect,
  type MountainHillsEffect,
  moonCrater,
  mountainHills,
  RIVER_WAVE_SKSL,
  type RiverWaveEffect,
  ROOFS_CITY_SKSL,
  type RoofsCityEffect,
  riverWave,
  roofsCity,
  type SpriteColor,
  updateEffect,
} from '../src/index.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';

const dark: SpriteColor = { r: 0.05, g: 0.05, b: 0.1, a: 1 };
const light: SpriteColor = { r: 0.8, g: 0.8, b: 0.9, a: 1 };
const green: SpriteColor = { r: 0.1, g: 0.5, b: 0.1, a: 1 };
const blue: SpriteColor = { r: 0.1, g: 0.3, b: 0.7, a: 1 };
const foam: SpriteColor = { r: 0.9, g: 0.9, b: 1.0, a: 1 };
const gray: SpriteColor = { r: 0.6, g: 0.6, b: 0.6, a: 1 };
const rust: SpriteColor = { r: 0.3, g: 0.2, b: 0.1, a: 1 };
const cave: SpriteColor = { r: 0.05, g: 0.03, b: 0.02, a: 1 };
const amber: SpriteColor = { r: 0.9, g: 0.6, b: 0.1, a: 1 };
const sky: SpriteColor = { r: 0.4, g: 0.6, b: 0.9, a: 1 };
const hill: SpriteColor = { r: 0.2, g: 0.4, b: 0.2, a: 1 };

describe('roofsCity', () => {
  it('factory returns correct type', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light });
    expect(e.type).toBe('roofs-city');
  });

  it('factory applies defaults for scrollOffsetY and density', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.density).toBe(6);
  });

  it('factory passes explicit overrides', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light, scrollOffsetY: 120, density: 10 });
    expect(e.scrollOffsetY).toBe(120);
    expect(e.density).toBe(10);
  });

  it('factory preserves color references', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light });
    expect(e.skyColor).toBe(dark);
    expect(e.roofColor).toBe(light);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: RoofsCityEffect = roofsCity({ skyColor: dark, roofColor: light, scrollOffsetY: 50 });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('ROOFS_CITY_SKSL contains required uniforms and entry point', () => {
    expect(ROOFS_CITY_SKSL).toContain('scrollOffsetY');
    expect(ROOFS_CITY_SKSL).toContain('resolution');
    expect(ROOFS_CITY_SKSL).toContain('density');
    expect(ROOFS_CITY_SKSL).toContain('half4 main');
  });
});

describe('forestCanopy', () => {
  it('factory returns correct type', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green });
    expect(e.type).toBe('forest-canopy');
  });

  it('factory applies defaults for scrollOffsetY and density', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.density).toBe(5);
  });

  it('factory passes explicit overrides', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green, scrollOffsetY: 80, density: 8 });
    expect(e.scrollOffsetY).toBe(80);
    expect(e.density).toBe(8);
  });

  it('factory preserves color references', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green });
    expect(e.skyColor).toBe(sky);
    expect(e.leafColor).toBe(green);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: ForestCanopyEffect = forestCanopy({
      skyColor: sky,
      leafColor: green,
      scrollOffsetY: 30,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('FOREST_CANOPY_SKSL contains required uniforms and entry point', () => {
    expect(FOREST_CANOPY_SKSL).toContain('scrollOffsetY');
    expect(FOREST_CANOPY_SKSL).toContain('resolution');
    expect(FOREST_CANOPY_SKSL).toContain('density');
    expect(FOREST_CANOPY_SKSL).toContain('half4 main');
  });
});

describe('riverWave', () => {
  it('factory returns correct type', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam });
    expect(e.type).toBe('river-wave');
  });

  it('factory applies defaults for scrollOffsetY and waveScale', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.waveScale).toBe(2);
  });

  it('factory passes explicit overrides', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam, scrollOffsetY: 60, waveScale: 3 });
    expect(e.scrollOffsetY).toBe(60);
    expect(e.waveScale).toBe(3);
  });

  it('factory preserves color references', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam });
    expect(e.waterColor).toBe(blue);
    expect(e.foamColor).toBe(foam);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: RiverWaveEffect = riverWave({ waterColor: blue, foamColor: foam, scrollOffsetY: 20 });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('RIVER_WAVE_SKSL contains required uniforms and entry point', () => {
    expect(RIVER_WAVE_SKSL).toContain('scrollOffsetY');
    expect(RIVER_WAVE_SKSL).toContain('resolution');
    expect(RIVER_WAVE_SKSL).toContain('waveScale');
    expect(RIVER_WAVE_SKSL).toContain('half4 main');
  });
});

describe('moonCrater', () => {
  it('factory returns correct type', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust });
    expect(e.type).toBe('moon-crater');
  });

  it('factory applies defaults for scrollOffsetY and craterCount', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.craterCount).toBe(4);
  });

  it('factory passes explicit overrides', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust, scrollOffsetY: 40, craterCount: 6 });
    expect(e.scrollOffsetY).toBe(40);
    expect(e.craterCount).toBe(6);
  });

  it('factory preserves color references', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust });
    expect(e.moonColor).toBe(gray);
    expect(e.craterColor).toBe(rust);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: MoonCraterEffect = moonCrater({
      moonColor: gray,
      craterColor: rust,
      scrollOffsetY: 10,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('MOON_CRATER_SKSL contains required uniforms and entry point', () => {
    expect(MOON_CRATER_SKSL).toContain('scrollOffsetY');
    expect(MOON_CRATER_SKSL).toContain('resolution');
    expect(MOON_CRATER_SKSL).toContain('craterCount');
    expect(MOON_CRATER_SKSL).toContain('half4 main');
  });
});

describe('caveInterior', () => {
  it('factory returns correct type', () => {
    const e = caveInterior({ caveColor: cave, glowColor: amber });
    expect(e.type).toBe('cave-interior');
  });

  it('factory applies defaults for scrollOffsetY and stalactiteCount', () => {
    const e = caveInterior({ caveColor: cave, glowColor: amber });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.stalactiteCount).toBe(8);
  });

  it('factory passes explicit overrides', () => {
    const e = caveInterior({
      caveColor: cave,
      glowColor: amber,
      scrollOffsetY: 90,
      stalactiteCount: 12,
    });
    expect(e.scrollOffsetY).toBe(90);
    expect(e.stalactiteCount).toBe(12);
  });

  it('factory preserves color references', () => {
    const e = caveInterior({ caveColor: cave, glowColor: amber });
    expect(e.caveColor).toBe(cave);
    expect(e.glowColor).toBe(amber);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: CaveInteriorEffect = caveInterior({
      caveColor: cave,
      glowColor: amber,
      scrollOffsetY: 55,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('CAVE_INTERIOR_SKSL contains required uniforms and entry point', () => {
    expect(CAVE_INTERIOR_SKSL).toContain('scrollOffsetY');
    expect(CAVE_INTERIOR_SKSL).toContain('resolution');
    expect(CAVE_INTERIOR_SKSL).toContain('stalactiteCount');
    expect(CAVE_INTERIOR_SKSL).toContain('half4 main');
  });
});

describe('mountainHills', () => {
  it('factory returns correct type', () => {
    const e = mountainHills({ skyColor: sky, hillColor: hill });
    expect(e.type).toBe('mountain-hills');
  });

  it('factory applies defaults for scrollOffsetY and ridgeScale', () => {
    const e = mountainHills({ skyColor: sky, hillColor: hill });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.ridgeScale).toBe(1.5);
  });

  it('factory passes explicit overrides', () => {
    const e = mountainHills({
      skyColor: sky,
      hillColor: hill,
      scrollOffsetY: 100,
      ridgeScale: 2.5,
    });
    expect(e.scrollOffsetY).toBe(100);
    expect(e.ridgeScale).toBe(2.5);
  });

  it('factory preserves color references', () => {
    const e = mountainHills({ skyColor: sky, hillColor: hill });
    expect(e.skyColor).toBe(sky);
    expect(e.hillColor).toBe(hill);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: MountainHillsEffect = mountainHills({
      skyColor: sky,
      hillColor: hill,
      scrollOffsetY: 75,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('MOUNTAIN_HILLS_SKSL contains required uniforms and entry point', () => {
    expect(MOUNTAIN_HILLS_SKSL).toContain('scrollOffsetY');
    expect(MOUNTAIN_HILLS_SKSL).toContain('resolution');
    expect(MOUNTAIN_HILLS_SKSL).toContain('ridgeScale');
    expect(MOUNTAIN_HILLS_SKSL).toContain('half4 main');
  });
});

describe('AnySpriteEffect — zone bg arms in exhaustive switch', () => {
  it('discriminates all 6 zone-bg effect types', () => {
    const effects: AnySpriteEffect[] = [
      roofsCity({ skyColor: dark, roofColor: light }),
      forestCanopy({ skyColor: sky, leafColor: green }),
      riverWave({ waterColor: blue, foamColor: foam }),
      moonCrater({ moonColor: gray, craterColor: rust }),
      caveInterior({ caveColor: cave, glowColor: amber }),
      mountainHills({ skyColor: sky, hillColor: hill }),
    ];
    const matched: string[] = [];
    for (const e of effects) {
      switch (e.type) {
        case 'roofs-city':
          matched.push(`roofs-city:${e.density}`);
          break;
        case 'forest-canopy':
          matched.push(`forest-canopy:${e.density}`);
          break;
        case 'river-wave':
          matched.push(`river-wave:${e.waveScale}`);
          break;
        case 'moon-crater':
          matched.push(`moon-crater:${e.craterCount}`);
          break;
        case 'cave-interior':
          matched.push(`cave-interior:${e.stalactiteCount}`);
          break;
        case 'mountain-hills':
          matched.push(`mountain-hills:${e.ridgeScale}`);
          break;
        default:
          matched.push('other');
      }
    }
    expect(matched).toEqual([
      'roofs-city:6',
      'forest-canopy:5',
      'river-wave:2',
      'moon-crater:4',
      'cave-interior:8',
      'mountain-hills:1.5',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Frame-renderer zone-bg pass — recording FrameRendererModule stub (pattern
// from frame-renderer-counters.test.ts). `mode` selects the shape of
// `Skia.RuntimeEffect`: absent, present but failing to compile, or compiling.
// ---------------------------------------------------------------------------

type RuntimeEffectMode = 'absent' | 'make-null' | 'compiled';

interface DrawLog {
  /** Paint handed to each `drawRect`, in call order. */
  rectPaints: unknown[];
  atlasCalls: number;
  imageRectCalls: number;
  /** Every paint the renderer created, in creation order — [0] is its default paint. */
  paints: PaintLike[];
  warnings: string[];
}

function makeLog(): DrawLog {
  return { rectPaints: [], atlasCalls: 0, imageRectCalls: 0, paints: [], warnings: [] };
}

function makeRecordingModule(mode: RuntimeEffectMode, log: DrawLog): FrameRendererModule {
  const fakeCanvas = {
    save() {
      return 0;
    },
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clear() {},
    drawAtlas() {
      log.atlasCalls++;
    },
    drawImageRect() {
      log.imageRectCalls++;
    },
    drawRect(_rect: unknown, paint: unknown) {
      log.rectPaints.push(paint);
    },
  };
  const compiledEffect: RuntimeEffectLike = {
    makeShader() {
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
  const module: FrameRendererModule = {
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
      const paint: PaintLike = {
        setAlphaf() {},
        setColorFilter() {},
        setShader() {},
        setImageFilter() {},
      };
      log.paints.push(paint);
      return paint;
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
  };
  if (mode !== 'absent') {
    module.RuntimeEffect = {
      Make() {
        return mode === 'compiled' ? compiledEffect : null;
      },
    };
  }
  return module;
}

function makeCmd(effect: AnySpriteEffect | undefined, stretch = false): SpriteDrawCommand {
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
    stretch,
    blend: 'normal',
    flipX: false,
    flipY: false,
  };
}

const ZONE_BG_EFFECTS: ReadonlyArray<readonly [string, AnySpriteEffect]> = [
  ['roofs-city', roofsCity({ skyColor: dark, roofColor: light })],
  ['forest-canopy', forestCanopy({ skyColor: sky, leafColor: green })],
  ['river-wave', riverWave({ waterColor: blue, foamColor: foam })],
  ['moon-crater', moonCrater({ moonColor: gray, craterColor: rust })],
  ['cave-interior', caveInterior({ caveColor: cave, glowColor: amber })],
  ['mountain-hills', mountainHills({ skyColor: sky, hillColor: hill })],
];

const FRAMES = 3;

/** Runs `draw` against a fresh renderer, capturing `console.warn` into the returned log. */
function record(
  mode: RuntimeEffectMode,
  draw: (renderer: ReturnType<typeof createFrameRenderer>) => void,
): DrawLog {
  const log = makeLog();
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    log.warnings.push(args.map(String).join(' '));
  };
  try {
    draw(createFrameRenderer(makeRecordingModule(mode, log)));
  } finally {
    console.warn = originalWarn;
  }
  return log;
}

/**
 * FRAMES frames, each a plain two-sprite run, then a two-rect zone-bg run,
 * then a single zone-bg command flagged `stretch`.
 */
function renderZoneBgFrames(mode: RuntimeEffectMode, effect: AnySpriteEffect): DrawLog {
  return record(mode, (renderer) => {
    const image = {} as SkImageLike;
    for (let frame = 0; frame < FRAMES; frame++) {
      renderer.beginFrame(320, 240, frame / 60);
      renderer.drawAtlas(image, [makeCmd(undefined), makeCmd(undefined)]);
      renderer.drawAtlas(image, [makeCmd(effect), makeCmd(effect)]);
      renderer.drawAtlas(image, [makeCmd(effect, true)]);
      renderer.endFrame();
    }
  });
}

describe('frame-renderer zone-bg pass — compiled effect absent', () => {
  for (const mode of ['absent', 'make-null'] as const) {
    const label =
      mode === 'absent' ? 'Skia.RuntimeEffect undefined' : 'RuntimeEffect.Make returns null';
    for (const [type, effect] of ZONE_BG_EFFECTS) {
      it(`${label}: ${type} run is skipped — no drawRect, no atlas draw`, () => {
        const log = renderZoneBgFrames(mode, effect);
        expect(log.rectPaints.length).toBe(0);
        expect(log.imageRectCalls).toBe(0);
        // Only the plain run reaches the canvas: one drawAtlas per frame.
        expect(log.atlasCalls).toBe(FRAMES);
      });

      it(`${label}: ${type} skip is logged once, not per frame`, () => {
        const log = renderZoneBgFrames(mode, effect);
        expect(log.warnings.length).toBe(1);
        expect(log.warnings[0]).toContain('zone-bg');
      });
    }
  }

  it('one renderer skipping all six effect types still logs once', () => {
    const log = record('absent', (renderer) => {
      renderer.beginFrame(320, 240);
      for (const [, effect] of ZONE_BG_EFFECTS) {
        renderer.drawAtlas({} as SkImageLike, [makeCmd(effect)]);
      }
      renderer.endFrame();
    });
    expect(log.warnings.length).toBe(1);
    expect(log.rectPaints.length).toBe(0);
    expect(log.atlasCalls).toBe(0);
  });
});

describe('frame-renderer zone-bg pass — compiled effect present', () => {
  for (const [type, effect] of ZONE_BG_EFFECTS) {
    it(`${type} run draws one shader rect per command and nothing else`, () => {
      const log = renderZoneBgFrames('compiled', effect);
      // 2 rects + 1 stretch-flagged rect per frame; zone-bg ignores the stretch flag.
      expect(log.rectPaints.length).toBe(3 * FRAMES);
      expect(log.imageRectCalls).toBe(0);
      expect(log.atlasCalls).toBe(FRAMES);
      expect(log.warnings.length).toBe(0);
      // One dedicated paint, reused every frame, never the renderer's default paint.
      const paint = log.rectPaints[0];
      expect(paint).not.toBe(log.paints[0]);
      for (const p of log.rectPaints) expect(p).toBe(paint);
    });
  }
});
