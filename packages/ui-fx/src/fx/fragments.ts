import type { Vec2Out } from '../core/conventions';
import { createFractureCache } from '../core/fracture/cache';
import { cellGridFor } from '../core/fracture/cells';
import { generateFracture } from '../core/fracture/generate';
import type { FractureMesh } from '../core/fracture/types';
import { initFragmentsInto, packPhysicsInto } from '../core/motion/init';
import { FRAG_STRIDE, PHYS_LEN, REVERSE_MODE, TOTAL } from '../core/motion/layout';
import type { FragmentPose } from '../core/motion/pose';
import type { RectLike } from '../core/placement';
import type {
  DisintegratePreset,
  FragmentReverse,
  ShatterPreset,
  SnapshotPreset,
} from '../core/presets';
import type { FxImage } from '../runtime/contracts';

/** A preset that breaks the capture into pieces, with the `delay` its factory may have added. */
export type FragmentPreset = (ShatterPreset | DisintegratePreset) & { delay?: number };

/** What one fragment run moves its pieces by. Made once per run. */
export interface FragmentRun {
  mesh: FractureMesh;
  /** `FRAG_STRIDE` floats per piece, in layout pixels from the element's top left corner. */
  state: Float32Array;
  /** The `PHYS_LEN` physics block, with `REVERSE_MODE` set for the run's direction. */
  phys: Float32Array;
  /** Seconds every piece waits before the motion starts. */
  delay: number;
  /** Seconds the run lasts, the delay included. */
  duration: number;
}

/** Where the cells of a rectangular mesh are in the capture. Made once per run. */
export interface GrainCells {
  /** Each cell's source rect in the capture: x, y, width, height in image pixels. */
  rects: Float32Array;
  /** Each cell's centre in its source rect: x, y in image pixels from the rect's corner. */
  pivots: Float32Array;
}

const REVERSE: Record<FragmentReverse, number> = { rewind: 1, home: 2, 'spring-home': 3 };

const cache = /* @__PURE__ */ createFractureCache();

export function isFragmentPreset(p: SnapshotPreset): p is ShatterPreset | DisintegratePreset {
  return p.kind === 'shatter' || p.kind === 'disintegrate';
}

/**
 * The pieces `p` breaks a `width` by `height` element into. A `fragment.count` above
 * `maxFragments` is lowered to it, and the break is around the press point when the focus is
 * `'press'` and there is one. `press` is in element pixels.
 *
 * `'cells'` are `fragment.cell` pixels of the capture, which has `pixelRatio` image pixels per
 * layout pixel, and the cell grows until there are at most `maxFragments` of them. No other
 * pattern reads `pixelRatio`.
 *
 * The mesh is cached and shared: read it, never write to it.
 */
export function fragmentMesh(
  p: FragmentPreset,
  width: number,
  height: number,
  press: Vec2Out | null,
  pixelRatio: number,
): FractureMesh {
  const spec = p.fragment;
  if (spec.pattern === 'cells') {
    const widthPx = width * pixelRatio;
    const heightPx = height * pixelRatio;
    const cell = cellGridFor(widthPx, heightPx, spec.cell, p.maxFragments).cell;
    return generateFracture(
      cell === spec.cell ? spec : { ...spec, cell },
      widthPx,
      heightPx,
      cache,
    );
  }
  const count = Math.min(spec.count, p.maxFragments);
  const focus =
    spec.focus === 'press' && press !== null
      ? { x: press.x / width, y: press.y / height }
      : spec.focus;
  return generateFracture(
    count === spec.count && focus === spec.focus ? spec : { ...spec, count, focus },
    width,
    height,
    cache,
  );
}

/**
 * The launch state of every piece of `mesh` for one run of `p`. `direction` 1 plays the preset's
 * `reverse` mode, an assemble-in; -1 plays it forward.
 */
export function createFragmentRun(
  p: FragmentPreset,
  mesh: FractureMesh,
  width: number,
  height: number,
  direction: 1 | -1,
  press: Vec2Out | null,
): FragmentRun {
  const state = new Float32Array(mesh.count * FRAG_STRIDE);
  initFragmentsInto(mesh, p, width, height, press, state);
  const phys = packPhysicsInto(p, new Float32Array(PHYS_LEN));
  if (direction === 1) phys[REVERSE_MODE] = REVERSE[p.reverse];
  const delay = p.delay ?? 0;
  return { mesh, state, phys, delay, duration: delay + phys[TOTAL]! };
}

/**
 * Where each piece of `mesh`, a rectangular one, is in `image`, the capture of the element
 * measured as `rect`. A grain is drawn straight from there, so nothing is baked.
 */
export function grainCells(mesh: FractureMesh, rect: RectLike, image: FxImage): GrainCells {
  const { count, bounds, centroids } = mesh;
  const { padding, pixelRatio } = image;
  const widthPx = rect.width * pixelRatio;
  const heightPx = rect.height * pixelRatio;
  const rects = new Float32Array(count * 4);
  const pivots = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const left = bounds[o]!;
    const top = bounds[o + 1]!;
    rects[o] = padding * pixelRatio + left * widthPx;
    rects[o + 1] = padding * pixelRatio + top * heightPx;
    rects[o + 2] = (bounds[o + 2]! - left) * widthPx;
    rects[o + 3] = (bounds[o + 3]! - top) * heightPx;
    pivots[i * 2] = (centroids[i * 2]! - left) * widthPx;
    pivots[i * 2 + 1] = (centroids[i * 2 + 1]! - top) * heightPx;
  }
  return { rects, pivots };
}

/**
 * Write the RSXform that draws a sprite at `pose` into `out` at `o`: scos, ssin, tx, ty. The
 * sprite turns and scales about (`cx`, `cy`), a point in its source rect in source pixels, which
 * lands on (`pose.x`, `pose.y`). `scale` is output pixels per source pixel.
 */
export function shardXformInto(
  pose: FragmentPose,
  cx: number,
  cy: number,
  scale: number,
  out: Float32Array,
  o: number,
): void {
  'worklet';
  const scos = pose.scale * scale * Math.cos(pose.rotation);
  const ssin = pose.scale * scale * Math.sin(pose.rotation);
  out[o] = scos;
  out[o + 1] = ssin;
  out[o + 2] = pose.x - (scos * cx - ssin * cy);
  out[o + 3] = pose.y - (ssin * cx + scos * cy);
}
