import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike, RuntimeEffectLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import type { ShaderUniforms } from '../src/sprite-effects.js';
import { custom } from '../src/sprite-effects.js';

// FrameRendererModule stub (pattern from frame-renderer-slice-cache.test.ts)
function makeModule(): FrameRendererModule {
  const fakePaint: PaintLike = {
    setAlphaf() {},
    setColorFilter() {},
    setShader() {},
    setImageFilter() {},
  };
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
    drawRect() {},
  };
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
      return fakePaint;
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
}

type UniformDecl = { name: string; columns: number; rows: number; slot: number };

type CountingShader = RuntimeEffectLike & {
  counts: { count: number; floatCount: number; uniform: number[]; name: number[] };
  made: number[][];
};

function makeCountingShader(decls: UniformDecl[], floatCount: number): CountingShader {
  const counts = {
    count: 0,
    floatCount: 0,
    uniform: decls.map(() => 0),
    name: decls.map(() => 0),
  };
  const made: number[][] = [];
  return {
    counts,
    made,
    makeShader(uniforms) {
      // The renderer reuses one scratch array, so snapshot it.
      made.push(uniforms.slice());
      return {};
    },
    getUniformCount() {
      counts.count++;
      return decls.length;
    },
    getUniformFloatCount() {
      counts.floatCount++;
      return floatCount;
    },
    getUniformName(i) {
      counts.name[i] = (counts.name[i] ?? 0) + 1;
      return decls[i]?.name ?? '';
    },
    getUniform(i) {
      counts.uniform[i] = (counts.uniform[i] ?? 0) + 1;
      const d = decls[i];
      return { columns: d?.columns ?? 0, rows: d?.rows ?? 0, slot: d?.slot ?? 0 };
    },
  };
}

function makeRun(shader: RuntimeEffectLike, uniforms: ShaderUniforms): SpriteDrawCommand[] {
  return [
    {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: custom(shader, uniforms),
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    },
  ];
}

// float u_time; vec3 u_color; vec2 u_offset; mat2 u_m; — 10 floats
const DECLS: UniformDecl[] = [
  { name: 'u_time', columns: 1, rows: 1, slot: 0 },
  { name: 'u_color', columns: 3, rows: 1, slot: 1 },
  { name: 'u_offset', columns: 2, rows: 1, slot: 4 },
  { name: 'u_m', columns: 2, rows: 2, slot: 6 },
];

describe('custom shader uniform layout', () => {
  it('reflects a shader layout once across many runs', () => {
    const shader = makeCountingShader(DECLS, 10);
    const renderer = createFrameRenderer(makeModule());
    const image = {} as SkImageLike;
    for (let frame = 0; frame < 3; frame++) {
      renderer.beginFrame(128, 128);
      for (let run = 0; run < 5; run++) {
        renderer.drawAtlas(image, makeRun(shader, { u_time: frame + run, u_color: [1, 2, 3] }));
      }
    }

    expect(shader.made.length).toBe(15);
    expect(shader.counts.count).toBe(1);
    expect(shader.counts.floatCount).toBe(1);
    expect(shader.counts.uniform).toEqual([1, 1, 1, 1]);
    expect(shader.counts.name).toEqual([1, 1, 1, 1]);
  });

  it('shares the cached layout between renderers and keeps shaders apart', () => {
    const a = makeCountingShader(DECLS, 10);
    const b = makeCountingShader([{ name: 'u_k', columns: 1, rows: 1, slot: 0 }], 1);
    const image = {} as SkImageLike;
    for (let i = 0; i < 2; i++) {
      const renderer = createFrameRenderer(makeModule());
      renderer.beginFrame(128, 128);
      renderer.drawAtlas(image, makeRun(a, { u_time: 1 }));
      renderer.drawAtlas(image, makeRun(b, { u_k: 7 }));
      renderer.drawAtlas(image, makeRun(a, { u_time: 2 }));
    }

    expect(a.counts.count).toBe(1);
    expect(a.counts.floatCount).toBe(1);
    expect(a.counts.uniform).toEqual([1, 1, 1, 1]);
    expect(b.counts.count).toBe(1);
    expect(b.counts.floatCount).toBe(1);
    expect(b.counts.name).toEqual([1]);
    expect(b.made).toEqual([[7], [7]]);
    expect(a.made[1]).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('fills scalar, vector and matrix uniforms at their slots', () => {
    const shader = makeCountingShader(DECLS, 10);
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas(
      {} as SkImageLike,
      makeRun(shader, {
        u_time: 0.5,
        u_color: [1, 2, 3],
        u_offset: [4, 5],
        u_m: [6, 7, 8, 9],
      }),
    );

    expect(shader.made).toEqual([[0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  });

  it('zero-fills a missing uniform and zero-pads a short vector', () => {
    const shader = makeCountingShader(DECLS, 10);
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas(
      {} as SkImageLike,
      makeRun(shader, { u_color: [1], u_m: [6, 7], u_unknown: 99 }),
    );

    expect(shader.made).toEqual([[0, 1, 0, 0, 0, 0, 6, 7, 0, 0]]);
  });

  it('ignores vector elements past the declared size', () => {
    const shader = makeCountingShader(DECLS, 10);
    const renderer = createFrameRenderer(makeModule());
    renderer.beginFrame(128, 128);
    renderer.drawAtlas({} as SkImageLike, makeRun(shader, { u_offset: [4, 5, 99, 99] }));

    expect(shader.made).toEqual([[0, 0, 0, 0, 4, 5, 0, 0, 0, 0]]);
  });

  it('zeroes stale values between runs', () => {
    const shader = makeCountingShader(DECLS, 10);
    const small = makeCountingShader([{ name: 'u_k', columns: 1, rows: 1, slot: 0 }], 1);
    const renderer = createFrameRenderer(makeModule());
    const image = {} as SkImageLike;
    renderer.beginFrame(128, 128);
    renderer.drawAtlas(
      image,
      makeRun(shader, { u_time: 1, u_color: [1, 2, 3], u_offset: [4, 5], u_m: [6, 7, 8, 9] }),
    );
    renderer.drawAtlas(image, makeRun(shader, { u_offset: [4] }));
    renderer.drawAtlas(image, makeRun(small, {}));
    renderer.drawAtlas(image, makeRun(shader, { u_time: 2 }));

    expect(shader.made).toEqual([
      [1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 0, 0, 0, 4, 0, 0, 0, 0, 0],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]);
    expect(small.made).toEqual([[0]]);
  });
});
