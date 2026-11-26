/**
 * Call-shape tests for the shader sprite effects (`custom`, `water`, `fog`,
 * `fire`) against a recording stub — which draw call each run reaches and with
 * what state. Whether the shader's output reaches the pixels is proved against
 * real Skia in `packages/react/tests/sprite-shader-effect-pixels.test.ts`.
 */
import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike, RuntimeEffectLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { type AnySpriteEffect, custom, fire, fog, water } from '../src/sprite-effects.js';

type RuntimeEffectMode = 'absent' | 'make-null' | 'compiled';

interface RecordingPaint extends PaintLike {
  alpha: number;
  blend: number | undefined;
  shader: unknown;
}

interface Log {
  /** One entry per canvas call, in order: `save`, `rotate 90 16 8`, `drawRect 0 0 8 8`, … */
  ops: string[];
  /** Alpha of the paint at each `drawRect`. */
  rectAlphas: number[];
  /** Blend mode of the paint at each `drawRect`. */
  rectBlends: (number | undefined)[];
  /** Uniforms handed to each built-in `makeShader`. */
  uniforms: number[][];
  paints: RecordingPaint[];
}

function makeModule(mode: RuntimeEffectMode, log: Log): FrameRendererModule {
  const fakeCanvas = {
    save() {
      log.ops.push('save');
      return 0;
    },
    restore() {
      log.ops.push('restore');
    },
    translate(x: number, y: number) {
      log.ops.push(`translate ${x} ${y}`);
    },
    scale(sx: number, sy: number) {
      log.ops.push(`scale ${sx} ${sy}`);
    },
    rotate(degrees: number, cx: number, cy: number) {
      log.ops.push(`rotate ${Math.round(degrees)} ${cx} ${cy}`);
    },
    clear() {},
    drawAtlas(_image: unknown, _srcs: unknown, _dsts: unknown, paint: PaintLike) {
      log.ops.push(`drawAtlas shader=${(paint as RecordingPaint).shader !== undefined}`);
    },
    drawImageRect(_image: unknown, _src: unknown, _dst: unknown, paint: PaintLike) {
      log.ops.push(`drawImageRect shader=${(paint as RecordingPaint).shader !== undefined}`);
    },
    drawRect(rect: { x: number; y: number; width: number; height: number }, paint: PaintLike) {
      const p = paint as RecordingPaint;
      log.ops.push(`drawRect ${rect.x} ${rect.y} ${rect.width} ${rect.height}`);
      log.rectAlphas.push(p.alpha);
      log.rectBlends.push(p.blend);
    },
  };
  const builtIn: RuntimeEffectLike = {
    makeShader(uniforms: number[]) {
      log.uniforms.push([...uniforms]);
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
    RSXform() {
      return { scos: 0, ssin: 0, tx: 0, ty: 0, set() {} };
    },
    Paint() {
      const p: RecordingPaint = {
        alpha: 1,
        blend: undefined,
        shader: undefined,
        setAlphaf(a) {
          p.alpha = a;
        },
        setColorFilter() {},
        setShader(s) {
          p.shader = s;
        },
        setImageFilter() {},
        setBlendMode(m) {
          p.blend = m;
        },
      };
      log.paints.push(p);
      return p;
    },
    PictureRecorder() {
      return {
        beginRecording() {
          return fakeCanvas;
        },
        finishRecordingAsPicture() {
          return {};
        },
      };
    },
    ColorFilter: {
      MakeBlend() {
        return {};
      },
      MakeMatrix() {
        return {};
      },
    },
  };
  if (mode !== 'absent') {
    module.RuntimeEffect = { Make: () => (mode === 'compiled' ? builtIn : null) };
  }
  return module;
}

function makeLog(): Log {
  return { ops: [], rectAlphas: [], rectBlends: [], uniforms: [], paints: [] };
}

function cmd(effect: AnySpriteEffect, partial: Partial<SpriteDrawCommand> = {}): SpriteDrawCommand {
  return {
    image: {} as SkImageLike,
    srcX: 0,
    srcY: 0,
    srcW: 8,
    srcH: 8,
    dstX: 12,
    dstY: 4,
    dstW: 8,
    dstH: 8,
    effect,
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

const RED = { r: 1, g: 0, b: 0, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function customEffect(): AnySpriteEffect {
  const shader: RuntimeEffectLike = {
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
  return custom(shader, {});
}

const BUILT_INS: ReadonlyArray<readonly [string, () => AnySpriteEffect]> = [
  ['water', () => water(RED, WHITE, 1, 0.05)],
  ['fog', () => fog(RED)],
  ['fire', () => fire({ color: RED, tipColor: WHITE })],
];

function run(mode: RuntimeEffectMode, commands: SpriteDrawCommand[], colors?: Uint32Array): Log {
  const log = makeLog();
  const renderer = createFrameRenderer(makeModule(mode, log));
  renderer.beginFrame(64, 64, 0, 1);
  renderer.drawAtlas({} as SkImageLike, commands, colors);
  return log;
}

describe('shader sprite effects — drawn as a rect at the sprite-local origin', () => {
  for (const [label, make] of [['custom', customEffect] as const, ...BUILT_INS]) {
    it(`${label}: translate to the sprite, then drawRect(0, 0, w, h) — no image draw`, () => {
      const log = run('compiled', [cmd(make())]);
      expect(log.ops).toEqual(['save', 'translate 12 4', 'drawRect 0 0 8 8', 'restore']);
    });
  }

  it('rotation turns about the anchor pivot, outside the translate', () => {
    const log = run('compiled', [
      cmd(customEffect(), { rotation: Math.PI / 2, anchorX: 0.5, anchorY: 0.5 }),
    ]);
    expect(log.ops).toEqual([
      'save',
      'rotate 90 16 8',
      'translate 12 4',
      'drawRect 0 0 8 8',
      'restore',
    ]);
  });

  it('flip mirrors about the centre of the local rect', () => {
    const log = run('compiled', [cmd(customEffect(), { flipX: true })]);
    expect(log.ops).toEqual([
      'save',
      'translate 12 4',
      'translate 4 4',
      'scale -1 1',
      'translate -4 -4',
      'drawRect 0 0 8 8',
      'restore',
    ]);
  });

  it('alpha and additive blend are on the paint at the draw, and reset after it', () => {
    const log = run('compiled', [cmd(customEffect(), { alpha: 0.25, blend: 'additive' })]);
    expect(log.rectAlphas).toEqual([0.25]);
    expect(log.rectBlends).toEqual([12]);
    for (const p of log.paints) {
      expect(p.alpha).toBe(1);
      expect(p.blend === undefined || p.blend === 3).toBe(true);
    }
  });

  it('a coloured run takes each sprite alpha from its colour; the rgb is not applied', () => {
    const effect = customEffect();
    const log = run(
      'compiled',
      [cmd(effect), cmd(effect, { dstX: 30 })],
      new Uint32Array([0xffff0000, 0x8000ff00]),
    );
    expect(log.rectAlphas[0]).toBe(1);
    expect(log.rectAlphas[1]).toBeCloseTo(0x80 / 255, 5);
  });
});

describe('built-in shader sprite effects — resolution per sprite', () => {
  for (const [label, make] of BUILT_INS) {
    it(`${label}: a sprite of another size in the run gets a shader built for its size`, () => {
      const effect = make();
      const log = run('compiled', [
        cmd(effect, { dstW: 8, dstH: 8 }),
        cmd(effect, { dstW: 8, dstH: 8 }),
        cmd(effect, { dstW: 32, dstH: 16 }),
      ]);
      expect(log.uniforms.map((u) => [u[0], u[1]])).toEqual([
        [8, 8],
        [32, 16],
      ]);
      expect(log.ops.filter((op) => op.startsWith('drawRect'))).toEqual([
        'drawRect 0 0 8 8',
        'drawRect 0 0 8 8',
        'drawRect 0 0 32 16',
      ]);
    });
  }
});

describe('built-in shader sprite effects — shader unavailable', () => {
  for (const mode of ['absent', 'make-null'] as const) {
    for (const [label, make] of BUILT_INS) {
      it(`${label}, RuntimeEffect ${mode}: the plain sprite is drawn, never a bare rect`, () => {
        expect(run(mode, [cmd(make())]).ops).toEqual(['drawAtlas shader=false']);
        expect(run(mode, [cmd(make(), { stretch: true })]).ops).toEqual([
          'drawImageRect shader=false',
        ]);
      });
    }
  }
});
