import { beforeEach, describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import {
  type PostFxChainLike,
  type PostFxPassLike,
  type PostFxRuntimeLike,
  type SkSurfaceLike,
  type SkiaModuleLike,
  createSkiaFrameRenderer,
} from '../src/skia-bridge.js';

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

function makeMockImage(label = 'img'): SkImageLike & { label: string } {
  return { label, width: () => 800, height: () => 600, readPixels: () => null };
}

interface MockSurface extends SkSurfaceLike {
  snapshotCount: number;
  drawImageRectCalls: Array<{ source: unknown }>;
}

function makeMockSurface(): MockSurface {
  const surface: MockSurface = {
    snapshotCount: 0,
    drawImageRectCalls: [],
    getCanvas() {
      return {
        drawPicture: () => {},
        drawImageRect(image: unknown, _src: unknown, _dst: unknown, _paint: unknown) {
          surface.drawImageRectCalls.push({ source: image });
        },
        drawRect: () => {},
        clear: () => {},
      };
    },
    makeImageSnapshot() {
      surface.snapshotCount++;
      return makeMockImage(`snap-${surface.snapshotCount}`);
    },
  };
  return surface;
}

let surfaceAllocCount = 0;
let allocatedSurfaces: MockSurface[] = [];

function makeMockSkia(): SkiaModuleLike {
  return {
    XYWHRect: (x, y, w, h) => {
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
    RSXform: (scos, ssin, tx, ty) => {
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
        colorFilter: null as unknown,
        shader: null as unknown,
        alphaf: 1,
        setColorFilter(f: unknown) {
          this.colorFilter = f;
        },
        setShader(s: unknown) {
          this.shader = s;
        },
        setAlphaf(a: number) {
          this.alphaf = a;
        },
      };
      return p as unknown as ReturnType<SkiaModuleLike['Paint']>;
    },
    PictureRecorder: () => {
      const recorder = {
        beginRecording(_bounds?: unknown): unknown {
          const canvas = {
            save: () => 0,
            restore: () => {},
            translate: () => {},
            scale: () => {},
            rotate: () => {},
            clear: () => {},
            drawPicture: () => {},
            drawAtlas: () => {},
            drawImageRect: (_image: unknown, _src: unknown, _dst: unknown, _paint: unknown) => {
              mainCanvasDrawImageRectCalls.push({ source: _image });
            },
          };
          return canvas;
        },
        finishRecordingAsPicture(): unknown {
          return { __picture: true };
        },
      };
      return recorder as unknown as ReturnType<SkiaModuleLike['PictureRecorder']>;
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
    MakeSurface(_w: number, _h: number): SkSurfaceLike | null {
      surfaceAllocCount++;
      const s = makeMockSurface();
      allocatedSurfaces.push(s);
      return s;
    },
  };
}

// Tracks drawImageRect calls on the main recording canvas.
let mainCanvasDrawImageRectCalls: Array<{ source: unknown }> = [];

function makePass(id: string): PostFxPassLike {
  return { id };
}

function makeMockChain(): PostFxChainLike {
  return { enabled: () => [] };
}

interface MockMultiPassRuntime extends PostFxRuntimeLike {
  applyCalls: number;
  applyPassCalls: Array<{ canvas: unknown; pass: PostFxPassLike; source: unknown }>;
  passesToReturn: PostFxPassLike[];
}

function makeMockMultiPassRuntime(passes: PostFxPassLike[]): MockMultiPassRuntime {
  const rt: MockMultiPassRuntime = {
    supported: true,
    applyCalls: 0,
    applyPassCalls: [],
    passesToReturn: passes,
    apply(_canvas, _chain, _source, _width, _height) {
      this.applyCalls++;
    },
    buildPass(_chain, _width, _height) {
      return this.passesToReturn;
    },
    applyPass(canvas, pass, source, _width, _height) {
      this.applyPassCalls.push({ canvas, pass, source });
    },
  };
  return rt;
}

beforeEach(() => {
  surfaceAllocCount = 0;
  allocatedSurfaces = [];
  mainCanvasDrawImageRectCalls = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyPostFx — ping-pong multi-pass', () => {
  it('single-pass falls through to runtime.apply without allocating ping-pong surfaces', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const rt = makeMockMultiPassRuntime([makePass('p1')]);
    const chain = makeMockChain();
    const source = makeMockImage('scene');

    bridge.applyPostFx(rt, chain, source, 800, 600);

    // Single pass — should use the fast path (runtime.apply), not ping-pong.
    expect(rt.applyCalls).toBe(1);
    expect(rt.applyPassCalls).toHaveLength(0);
    // No ping-pong surfaces allocated.
    // (snapshotSurface may be allocated separately, ping-pong should not be)
    const pingPongAllocs = allocatedSurfaces.length;
    expect(pingPongAllocs).toBe(0);
  });

  it('3-pass chain: each pass receives the output of the prior pass as source', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const passes = [makePass('bloom'), makePass('crt'), makePass('vignette')];
    const rt = makeMockMultiPassRuntime(passes);
    const chain = makeMockChain();
    const scene = makeMockImage('scene');

    bridge.applyPostFx(rt, chain, scene, 800, 600);

    // 3 passes — applyPass called 3 times.
    expect(rt.applyPassCalls).toHaveLength(3);

    // First pass receives the original scene source.
    expect(rt.applyPassCalls[0]?.source).toBe(scene);
    expect(rt.applyPassCalls[0]?.pass.id).toBe('bloom');

    // Second pass receives the snapshot output of the first intermediate surface.
    // The source must differ from the scene image (it's a snapshot).
    expect(rt.applyPassCalls[1]?.source).not.toBe(scene);
    expect(rt.applyPassCalls[1]?.pass.id).toBe('crt');

    // Third pass receives the snapshot from the second intermediate surface.
    expect(rt.applyPassCalls[2]?.source).not.toBe(rt.applyPassCalls[1]?.source);
    expect(rt.applyPassCalls[2]?.pass.id).toBe('vignette');
  });

  it('ping-pong surfaces are reused across consecutive applyPostFx calls', () => {
    const bridge = createSkiaFrameRenderer(makeMockSkia());
    bridge.beginFrame(800, 600);
    const passes = [makePass('a'), makePass('b'), makePass('c')];
    const rt = makeMockMultiPassRuntime(passes);
    const chain = makeMockChain();
    const scene = makeMockImage('scene');

    bridge.applyPostFx(rt, chain, scene, 800, 600);
    const allocsAfterFirst = surfaceAllocCount;

    // Second call on the same frame — same dimensions, surfaces must be reused.
    bridge.applyPostFx(rt, chain, makeMockImage('scene2'), 800, 600);
    expect(surfaceAllocCount).toBe(allocsAfterFirst);
  });
});
