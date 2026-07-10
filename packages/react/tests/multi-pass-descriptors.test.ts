import { describe, expect, it, mock } from 'bun:test';
import type {
  CompiledPassLike,
  PostFxChainLike,
  PostFxRuntimeLike,
  SkiaModuleLike,
} from '../src/skia-bridge.js';

// Restore the real createFrameRenderer after game-view.test.ts may have mocked it.
const realRender = await import('../../render/src/frame-renderer.js');
mock.module('@flare-engine/render', () => ({ ...realRender }));

import { createSkiaFrameRenderer } from '../src/skia-bridge.js';

// ---------------------------------------------------------------------------
// Minimal mocks (no Surface needed — buildPostFxPasses is descriptor-only)
// ---------------------------------------------------------------------------

function makeMockSkia(): SkiaModuleLike {
  return {
    XYWHRect: (x: number, y: number, w: number, h: number) => {
      const r = {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx: number, ny: number, nw: number, nh: number) {
          this.x = nx;
          this.y = ny;
          this.width = nw;
          this.height = nh;
        },
      };
      return r as unknown as ReturnType<SkiaModuleLike['XYWHRect']>;
    },
    RSXform: (scos: number, ssin: number, tx: number, ty: number) => {
      const x = {
        scos,
        ssin,
        tx,
        ty,
        set(s: number, si: number, nx: number, ny: number) {
          this.scos = s;
          this.ssin = si;
          this.tx = nx;
          this.ty = ny;
        },
      };
      return x as unknown as ReturnType<SkiaModuleLike['RSXform']>;
    },
    Paint: () => {
      const p = {
        setColorFilter: () => {},
        setShader: () => {},
        setAlphaf: () => {},
        setColor: () => {},
      };
      return p as unknown as ReturnType<SkiaModuleLike['Paint']>;
    },
    PictureRecorder: () => {
      const r = {
        beginRecording() {
          return {
            save: () => 0,
            restore: () => {},
            translate: () => {},
            scale: () => {},
            rotate: () => {},
            clear: () => {},
            drawPicture: () => {},
            drawAtlas: () => {},
            drawImageRect: () => {},
            drawRect: () => {},
          };
        },
        finishRecordingAsPicture: () => ({ __picture: true }),
      };
      return r as unknown as ReturnType<SkiaModuleLike['PictureRecorder']>;
    },
    ColorFilter: {
      MakeBlend: () => null as unknown as ReturnType<SkiaModuleLike['ColorFilter']['MakeBlend']>,
      MakeMatrix: () => null as unknown as ReturnType<SkiaModuleLike['ColorFilter']['MakeMatrix']>,
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

function makePass(id: string, uniformNames: string[], values: number[]): CompiledPassLike {
  let slot = 0;
  const slots = uniformNames.map((name) => {
    const s = { name, columns: 1, rows: 1, slot };
    slot += 1;
    return s;
  });
  return {
    id,
    shader: {
      getUniformCount: () => uniformNames.length,
      getUniformName: (i: number) => slots[i]?.name ?? '',
      getUniform: (i: number) => slots[i] ?? { columns: 1, rows: 1, slot: 0 },
      makeShaderWithChildren: () => ({ _kind: 'shader' }),
    },
    uniforms: new Float32Array(values),
    children: [],
  };
}

function makeMockChain(): PostFxChainLike {
  return { enabled: () => [] };
}

describe('buildPostFxPasses — multi-pass descriptor ordering', () => {
  it('single pass produces one descriptor matching pass id', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const pass = makePass('bloom', ['intensity'], [0.5]);
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => [pass] };
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('bloom');
  });

  it('three passes — order preserved: bloom → crt → vignette', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const passes = [
      makePass('bloom', ['intensity'], [0.5]),
      makePass('crt', ['scanlines'], [0.3]),
      makePass('vignette', ['radius'], [0.8]),
    ];
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => passes };
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('bloom');
    expect(result[1]?.id).toBe('crt');
    expect(result[2]?.id).toBe('vignette');
  });

  it('each descriptor source is the corresponding pass shader', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const passes = [makePass('a', ['x'], [1]), makePass('b', ['x'], [2])];
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => passes };
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect(result[0]?.source).toBe(passes[0]?.shader);
    expect(result[1]?.source).toBe(passes[1]?.shader);
  });

  it('uniform values are preserved per-pass independently', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const passes = [makePass('a', ['v'], [10]), makePass('b', ['v'], [20])];
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => passes };
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect((result[0]!.uniforms as Record<string, unknown>).v).toBe(10);
    expect((result[1]!.uniforms as Record<string, unknown>).v).toBe(20);
  });

  it('no offscreen surface allocations — buildPostFxPasses is descriptor-only', () => {
    // Bridge has no Surface on the mock — would throw if surfaces were allocated.
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const passes = [
      makePass('a', ['x'], [1]),
      makePass('b', ['x'], [2]),
      makePass('c', ['x'], [3]),
    ];
    const runtime: PostFxRuntimeLike = { supported: true, buildPass: () => passes };
    expect(() => bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600)).not.toThrow();
    const result = bridge.buildPostFxPasses(runtime, makeMockChain(), 800, 600);
    expect(result).toHaveLength(3);
  });
});
