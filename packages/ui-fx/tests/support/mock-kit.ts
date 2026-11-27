import type { CanvasKit, Canvas as CKCanvas, Image as CKImage, Surface } from 'canvaskit-wasm';

export type CallRecord = { method: string; args: unknown[] };

/** A stand-in for a CanvasKit `Image` made from a capture. */
export interface MockKitImage {
  source: unknown;
  deleted: boolean;
}

/** One `MakeSurface` call and what was drawn into the surface it returned. */
export interface MockOffscreen {
  width: number;
  height: number;
  calls: CallRecord[];
  /** The image `makeImageSnapshot` returned, or `null` before it was called. */
  snapshot: MockKitImage | null;
  deleted: boolean;
}

/** A stand-in for a CanvasKit `Path` made by `Path.MakeFromCmds`. */
export interface MockKitPath {
  cmds: number[];
  deleted: boolean;
}

export interface MockKit {
  kit: CanvasKit;
  /** Every surface, canvas and image call, in call order. */
  calls: CallRecord[];
  /** The calls named `method`, in call order. */
  callsOf(method: string): CallRecord[];
  /** The canvases `MakeWebGLCanvasSurface` was given, one per surface made. */
  surfaces: unknown[];
  deletedSurfaces: number;
  images: MockKitImage[];
  /** The raster surfaces `MakeSurface` made. Their calls are not in `calls`. */
  offscreen: MockOffscreen[];
  paths: MockKitPath[];
  /** `MakeSurface` returns `null`. */
  failOffscreen: boolean;
  paints: number;
  deletedPaints: number;
  /** `MakeWebGLCanvasSurface` returns `null`, as it does without WebGL. */
  failSurface: boolean;
  /** `MakeImageFromCanvasImageSource` throws this, as it does for a tainted canvas. */
  uploadError: unknown;
}

/**
 * A CanvasKit that records what the web FX runtime draws. Modelled on
 * `packages/render-web/tests/support/mock-kit.ts`.
 */
export function makeMockKit(): MockKit {
  const calls: CallRecord[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]): void => {
      calls.push({ method, args });
    };

  const makeSurface = (): Surface => {
    const canvas = {
      save: () => {
        calls.push({ method: 'save', args: [] });
        return 0;
      },
      restore: record('restore'),
      translate: record('translate'),
      scale: record('scale'),
      rotate: record('rotate'),
      clear: record('clear'),
      drawAtlas: record('drawAtlas'),
    } as unknown as CKCanvas;
    return {
      getCanvas: () => canvas,
      flush: record('flush'),
      delete: () => {
        mock.deletedSurfaces++;
      },
    } as unknown as Surface;
  };

  const makeOffscreen = (width: number, height: number): Surface | null => {
    if (mock.failOffscreen) return null;
    const surface: MockOffscreen = { width, height, calls: [], snapshot: null, deleted: false };
    mock.offscreen.push(surface);
    const draw =
      (method: string) =>
      (...args: unknown[]): void => {
        surface.calls.push({ method, args });
      };
    const canvas = {
      save: () => {
        surface.calls.push({ method: 'save', args: [] });
        return 0;
      },
      restore: draw('restore'),
      translate: draw('translate'),
      scale: draw('scale'),
      clipPath: draw('clipPath'),
      drawImageOptions: draw('drawImageOptions'),
    } as unknown as CKCanvas;
    return {
      getCanvas: () => canvas,
      flush: draw('flush'),
      makeImageSnapshot: () => {
        // The record is the image itself, so a test can tell which image a draw was given.
        const image: MockKitImage & { delete(): void } = {
          source: surface,
          deleted: false,
          delete() {
            image.deleted = true;
          },
        };
        surface.snapshot = image;
        return image as unknown as CKImage;
      },
      delete: () => {
        surface.deleted = true;
      },
    } as unknown as Surface;
  };

  const kit = {
    MakeSurface: makeOffscreen,
    Path: {
      MakeFromCmds: (cmds: number[]) => {
        const path: MockKitPath & { delete(): void } = {
          cmds: [...cmds],
          deleted: false,
          delete() {
            path.deleted = true;
          },
        };
        mock.paths.push(path);
        return path;
      },
    },
    MOVE_VERB: 0,
    LINE_VERB: 1,
    CLOSE_VERB: 5,
    ClipOp: { Difference: { name: 'Difference' }, Intersect: { name: 'Intersect' } },
    FilterMode: { Nearest: { name: 'Nearest' }, Linear: { name: 'Linear' } },
    MipmapMode: { None: { name: 'None' } },
    MakeWebGLCanvasSurface: (canvas: unknown) => {
      if (mock.failSurface) return null;
      mock.surfaces.push(canvas);
      return makeSurface();
    },
    MakeImageFromCanvasImageSource: (source: unknown) => {
      if (mock.uploadError !== null) throw mock.uploadError;
      const image: MockKitImage = { source, deleted: false };
      mock.images.push(image);
      calls.push({ method: 'upload', args: [source] });
      return {
        delete: () => {
          image.deleted = true;
        },
      } as unknown as CKImage;
    },
    Paint: class {
      constructor() {
        mock.paints++;
      }
      delete(): void {
        mock.deletedPaints++;
      }
    },
    BlendMode: { Modulate: { name: 'Modulate' }, SrcOver: { name: 'SrcOver' } },
    TRANSPARENT: new Float32Array([0, 0, 0, 0]),
  } as unknown as CanvasKit;

  const mock: MockKit = {
    kit,
    calls,
    callsOf: (method) => calls.filter((call) => call.method === method),
    surfaces: [],
    deletedSurfaces: 0,
    images: [],
    offscreen: [],
    paths: [],
    failOffscreen: false,
    paints: 0,
    deletedPaints: 0,
    failSurface: false,
    uploadError: null,
  };
  return mock;
}
