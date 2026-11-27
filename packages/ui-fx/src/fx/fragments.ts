import type { Vec2Out } from '../core/conventions';
import { createFractureCache } from '../core/fracture/cache';
import { generateFracture } from '../core/fracture/generate';
import type { FractureMesh } from '../core/fracture/types';
import { initFragmentsInto, packPhysicsInto } from '../core/motion/init';
import { FRAG_STRIDE, PHYS_LEN, REVERSE_MODE, TOTAL } from '../core/motion/layout';
import type { FragmentPose } from '../core/motion/pose';
import type {
  DisintegratePreset,
  FragmentReverse,
  ShatterPreset,
  SnapshotPreset,
} from '../core/presets';

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

const REVERSE: Record<FragmentReverse, number> = { rewind: 1, home: 2, 'spring-home': 3 };

const cache = /* @__PURE__ */ createFractureCache();

export function isFragmentPreset(p: SnapshotPreset): p is ShatterPreset | DisintegratePreset {
  return p.kind === 'shatter' || p.kind === 'disintegrate';
}

/**
 * The pieces `p` breaks a `width` by `height` element into. A `fragment.count` above
 * `maxFragments` is lowered to it, and the break is around the press point when the focus is
 * `'press'` and there is one. `press` is in element pixels. The mesh is cached and shared: read
 * it, never write to it.
 */
export function fragmentMesh(
  p: FragmentPreset,
  width: number,
  height: number,
  press: Vec2Out | null,
): FractureMesh {
  const spec = p.fragment;
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
