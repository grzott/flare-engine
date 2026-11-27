import { mock } from 'bun:test';
import { createElement, type ReactNode, useEffect } from 'react';

type Props = Record<string, unknown> & { children?: ReactNode };

/** A stand-in for an `SkImage`. */
export interface MockImage {
  width(): number;
  height(): number;
  dispose(): void;
  disposed: boolean;
}

interface MockRect {
  x: number;
  y: number;
  width: number;
  height: number;
  setXYWH(x: number, y: number, width: number, height: number): void;
}

interface MockRSXform {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
  set(scos: number, ssin: number, tx: number, ty: number): void;
}

/** One `Skia.Surface.Make` call and what was drawn into the surface it returned. */
export interface MockSurface {
  width: number;
  height: number;
  draws: { image: MockImage; src: MockRect; dest: MockRect; filter: number; mipmap: number }[];
  flushes: number;
  /** The image `makeImageSnapshot` returned, or `null` before it was called. */
  snapshot: MockImage | null;
}

/** Every node of one mocked component: how often it mounted, and its latest props. */
export interface MockNodes {
  mounts: number;
  unmounts: number;
  props: Props | null;
}

const nodes = (): MockNodes => ({ mounts: 0, unmounts: 0, props: null });

export const createMockImage = (width: number, height: number): MockImage => {
  const image: MockImage = {
    width: () => width,
    height: () => height,
    dispose() {
      image.disposed = true;
    },
    disposed: false,
  };
  return image;
};

/** What the tests drive and read. */
export const skia = {
  canvas: nodes(),
  atlas: nodes(),
  image: nodes(),
  group: nodes(),
  vertices: nodes(),
  imageShader: nodes(),
  /** The `current` of the ref each `makeImageFromView` call was given. */
  captured: [] as unknown[],
  /** What the next `makeImageFromView` resolves with. `null` rejects instead. */
  nextImage: null as MockImage | null,
  surfaces: [] as MockSurface[],
  /** `Skia.Surface.Make` returns `null`. */
  failSurface: false,
  reset(): void {
    for (const kind of [
      skia.canvas,
      skia.atlas,
      skia.image,
      skia.group,
      skia.vertices,
      skia.imageShader,
    ]) {
      kind.mounts = 0;
      kind.unmounts = 0;
      kind.props = null;
    }
    skia.captured = [];
    skia.nextImage = null;
    skia.surfaces = [];
    skia.failSurface = false;
  },
};

const recorded = (kind: MockNodes, tag: string | null, withChildren = false) =>
  function Node(props: Props): ReactNode {
    kind.props = props;
    useEffect(() => {
      kind.mounts++;
      return () => {
        kind.unmounts++;
      };
    }, []);
    if (tag === null) return withChildren ? props.children : null;
    return createElement(tag, { 'data-skia': 'canvas' }, props.children);
  };

const rect = (x: number, y: number, width: number, height: number): MockRect => {
  const made: MockRect = {
    x,
    y,
    width,
    height,
    setXYWH(nx, ny, nw, nh) {
      made.x = nx;
      made.y = ny;
      made.width = nw;
      made.height = nh;
    },
  };
  return made;
};

const rsxform = (scos: number, ssin: number, tx: number, ty: number): MockRSXform => {
  const made: MockRSXform = {
    scos,
    ssin,
    tx,
    ty,
    set(nscos, nssin, ntx, nty) {
      made.scos = nscos;
      made.ssin = nssin;
      made.tx = ntx;
      made.ty = nty;
    },
  };
  return made;
};

/** As RN-Skia's buffers: `size` host objects made once, and rewritten by `modifier` on each read. */
const buffer =
  <T>(initial: () => T) =>
  (size: number, modifier: (item: T, index: number) => void): { readonly value: T[] } => {
    const items = Array.from({ length: size }, initial);
    return {
      get value(): T[] {
        items.forEach(modifier);
        return items;
      },
    };
  };

const skiaModule = {
  Canvas: recorded(skia.canvas, 'div'),
  Atlas: recorded(skia.atlas, null),
  Image: recorded(skia.image, null),
  Group: recorded(skia.group, null),
  Vertices: recorded(skia.vertices, null, true),
  ImageShader: recorded(skia.imageShader, null),
  FilterMode: { Nearest: 0, Linear: 1 },
  MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
  useRSXformBuffer: buffer(() => rsxform(1, 0, 0, 0)),
  useRectBuffer: buffer(() => rect(0, 0, 0, 0)),
  makeImageFromView(ref: { current: unknown }): Promise<MockImage> {
    skia.captured.push(ref.current);
    const image = skia.nextImage;
    return image === null
      ? Promise.reject(new Error('mock-skia: the capture failed'))
      : Promise.resolve(image);
  },
  Skia: {
    XYWHRect: rect,
    RSXform: rsxform,
    Surface: {
      Make(width: number, height: number) {
        const surface: MockSurface = { width, height, draws: [], flushes: 0, snapshot: null };
        skia.surfaces.push(surface);
        if (skia.failSurface) return null;
        return {
          getCanvas: () => ({
            drawImageRectOptions(
              image: MockImage,
              src: MockRect,
              dest: MockRect,
              filter: number,
              mipmap: number,
            ): void {
              surface.draws.push({ image, src, dest, filter, mipmap });
            },
          }),
          flush(): void {
            surface.flushes++;
          },
          makeImageSnapshot(): MockImage {
            surface.snapshot = createMockImage(width, height);
            return surface.snapshot;
          },
          dispose(): void {},
        };
      },
    },
  },
};

/**
 * Replaces `@shopify/react-native-skia`. Call it before importing the module under test.
 *
 * `Canvas` renders a `div` around its children and `Vertices` renders its children alone; `Atlas`,
 * `Image`, `Group` and `ImageShader` render nothing. Each records its mounts and its latest props. `makeImageFromView` resolves with `skia.nextImage`, and
 * `Skia.Surface.Make` records what is drawn into the surface it returns.
 */
export const installSkiaMock = (): typeof skia => {
  mock.module('@shopify/react-native-skia', () => skiaModule);
  return skia;
};
