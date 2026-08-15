import type { CanvasKit, Canvas as CKCanvas, Image as CKImage, Surface } from 'canvaskit-wasm';

export type CallRecord = { method: string; args?: unknown[] };

export interface MockKitOptions {
  /** When true, RuntimeEffect.Make returns a working fake so multi-pass blit runs. */
  runtimeSupported?: boolean;
}

export interface MockKit {
  kit: CanvasKit;
  calls: CallRecord[];
  deletedSurfaces: number[];
  deletedPaints: string[];
  deletedShaders: string[];
  deletedSrcShaders: string[];
  deletedSnapshots: string[];
  childrenCounts: number[];
  blendModes: unknown[];
  /** How many on-screen surfaces have been created (one per build + one per resize). */
  onscreenCount: () => number;
  deletedContexts: number[];
  deletedGrContexts: number[];
  /** Force the next buildGpu() to fail, simulating a GPU that cannot allocate. */
  failNextBuild: (v: boolean) => void;
  /** Force buildGpu() to fail at a chosen stage, to cover partial-allocation teardown. */
  failAt: (stage: 'none' | 'context' | 'grcontext' | 'surface') => void;
}

export function makeMockKit(opts: MockKitOptions = {}): MockKit {
  const calls: CallRecord[] = [];
  const deletedSurfaces: number[] = [];
  const deletedPaints: string[] = [];
  const deletedShaders: string[] = [];
  const deletedSrcShaders: string[] = [];
  const deletedSnapshots: string[] = [];
  const childrenCounts: number[] = [];
  const blendModes: unknown[] = [];
  let surfaceId = 0;
  let shaderIdx = 0;
  let snapshotIdx = 0;
  let onscreenCount = 0;
  const deletedContexts: number[] = [];
  const deletedGrContexts: number[] = [];
  let ctxId = 0;
  let failStage: 'none' | 'context' | 'grcontext' | 'surface' = 'none';

  const makeSnapshot = (label: string): CKImage =>
    ({
      makeShaderOptions: () => ({
        delete: () => deletedSrcShaders.push(`src-${label}`),
      }),
      delete: () => deletedSnapshots.push(label),
    }) as unknown as CKImage;

  function makeSurface(): Surface {
    const id = ++surfaceId;
    return {
      getCanvas: () =>
        ({
          save: () => 0,
          restore: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          concat: () => {},
          clear: (c: unknown) => calls.push({ method: 'clear', args: [c] }),
          drawImage: (img: unknown, x: number, y: number) =>
            calls.push({ method: 'drawImage', args: [img, x, y] }),
          drawRect: (r: unknown, p: unknown) => calls.push({ method: 'drawRect', args: [r, p] }),
        }) as unknown as CKCanvas,
      flush: () => {},
      delete: () => deletedSurfaces.push(id),
      makeImageSnapshot: () => makeSnapshot(`snap-${++snapshotIdx}`),
      makeSurface: () => makeSurface(),
    } as unknown as Surface;
  }

  const fakeEffect = {
    makeShaderWithChildren: (_uniforms: ArrayLike<number>, children: unknown[]) => {
      childrenCounts.push(children.filter((c) => c != null).length);
      const label = `shader-${++shaderIdx}`;
      return { delete: () => deletedShaders.push(label) };
    },
  };

  const kit = {
    MakeWebGLCanvasSurface: () => {
      onscreenCount++;
      return makeSurface();
    },
    GetWebGLContext: () => (failStage === 'context' ? 0 : ++ctxId),
    MakeWebGLContext: (handle: number) => {
      if (failStage === 'grcontext') return null;
      const id = handle;
      return { delete: () => deletedGrContexts.push(id) };
    },
    MakeOnScreenGLSurface: () => {
      if (failStage === 'surface') return null;
      onscreenCount++;
      return makeSurface();
    },
    deleteContext: (handle: number) => deletedContexts.push(handle),
    ColorType: { RGBA_8888: 0 },
    AlphaType: { Premul: 1 },
    ColorSpace: { SRGB: null },
    BlendMode: { SrcOver: { name: 'SrcOver' }, Src: { name: 'Src' } },
    TileMode: { Clamp: 0 },
    FilterMode: { Linear: 0 },
    MipmapMode: { None: 0 },
    Paint: class {
      private _label = `paint-${deletedPaints.length}`;
      setColor() {}
      setBlendMode(m: unknown) {
        blendModes.push(m);
      }
      setShader() {}
      delete() {
        deletedPaints.push(this._label);
      }
    },
    RuntimeEffect: { Make: () => (opts.runtimeSupported ? fakeEffect : null) },
    Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
    LTRBRect: (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b]),
  } as unknown as CanvasKit;

  return {
    kit,
    calls,
    deletedSurfaces,
    deletedPaints,
    deletedShaders,
    deletedSrcShaders,
    deletedSnapshots,
    childrenCounts,
    blendModes,
    onscreenCount: () => onscreenCount,
    deletedContexts,
    deletedGrContexts,
    failNextBuild: (v: boolean) => {
      failStage = v ? 'context' : 'none';
    },
    failAt: (stage: 'none' | 'context' | 'grcontext' | 'surface') => {
      failStage = stage;
    },
  };
}
