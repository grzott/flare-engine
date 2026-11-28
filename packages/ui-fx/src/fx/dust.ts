import type { RectLike } from '../core/placement';
import { type DustPreset, disintegrate, presetDuration } from '../core/presets';
import { DUST_UNIFORM_FLOATS, packDustUniformsInto } from '../core/sksl';
import { compileTiming, type TimingInput } from '../core/timing';
import type { FxImage } from '../runtime/contracts';
import {
  createFragmentRun,
  type FragmentPreset,
  type FragmentRun,
  fragmentMesh,
  grainCells,
} from './fragments';

/** A dust preset, with the timing its factory may have added. */
export type DustRunPreset = DustPreset & TimingInput;

/** The grains a dust run throws off at its front. Made once per run. */
export interface DustGrains {
  /**
   * Packed for the forward run, which lasts as long as the dissolve: a grain is posed at the
   * dissolve's progress times `seconds`, whichever way the run plays.
   */
  fragments: FragmentRun;
  /** Each grain's cell in the capture: x, y, width, height in image pixels. */
  rects: Float32Array;
  /** Each cell's centre: x, y in image pixels from the cell's corner. */
  pivots: Float32Array;
  /** Seconds the dissolve takes, its delay left out. */
  seconds: number;
}

/** What one dust run draws from. Made once per run. */
export interface DustRun {
  /** The dissolve's progress over time: see `timingAt`. */
  samples: Float32Array;
  delay: number;
  duration: number;
  /** Seconds the run lasts, the delay included. */
  total: number;
  /** The shader's uniforms, packed at progress 0. */
  uniforms: Float32Array;
  grains: DustGrains | null;
}

/** The most grains a run draws: the cell cap (C32). */
const GRAIN_CAP = 3000;

/**
 * The share of the dissolve a grain lives for. The release front crosses in the rest, so the last
 * grain is gone when the dissolve ends.
 */
const GRAIN_LIFE = 1 / 3;

/**
 * The fragment preset of the grains `p` throws off, or `null` when `grainsAtFront` is below 1.
 * The capture is cut into at most `grainsAtFront` cells, 3,000 at most. A sweep along
 * `sweepAngle` releases them, and each drifts about `spread` pixels the same way as it fades.
 */
export function dustGrainPreset(p: DustRunPreset): FragmentPreset | null {
  const count = Math.min(GRAIN_CAP, Math.floor(p.grainsAtFront));
  if (!(count >= 1)) return null;
  const seconds = presetDuration(p) - (p.delay ?? 0);
  const lifetime = seconds * GRAIN_LIFE;
  return disintegrate({
    fragment: { pattern: 'cells', seed: p.seed },
    forces: [
      {
        kind: 'directional',
        angle: p.sweepAngle,
        strength: lifetime > 0 ? p.spread / lifetime : 0,
        falloff: 'none',
      },
    ],
    release: { order: 'sweep', angle: p.sweepAngle, duration: seconds - lifetime },
    physics: { gravity: 0 },
    life: { lifetime, lifetimeVariance: 0 },
    maxFragments: count,
  });
}

/** How many grains a run of `p` on an element measured as `rect` draws, or 0. */
export function dustGrainCount(p: DustRunPreset, rect: RectLike, image: FxImage): number {
  const grains = dustGrainPreset(p);
  if (grains === null) return 0;
  return fragmentMesh(grains, rect.width, rect.height, null, image.pixelRatio).count;
}

/** What a run of `p` draws from, for the element measured as `rect` and captured as `image`. */
export function createDustRun(p: DustRunPreset, rect: RectLike, image: FxImage): DustRun {
  const seconds = presetDuration(p) - (p.delay ?? 0);
  const timing = compileTiming(p, seconds);
  const uniforms = packDustUniformsInto(
    p,
    0,
    rect.width,
    rect.height,
    new Float32Array(DUST_UNIFORM_FLOATS),
  );

  let grains: DustGrains | null = null;
  const preset = dustGrainPreset(p);
  if (preset !== null) {
    const mesh = fragmentMesh(preset, rect.width, rect.height, null, image.pixelRatio);
    const fragments = createFragmentRun(preset, mesh, rect.width, rect.height, -1, null);
    const { rects, pivots } = grainCells(mesh, rect, image);
    grains = { fragments, rects, pivots, seconds: timing.duration };
  }

  return {
    samples: timing.samples,
    delay: timing.delay,
    duration: timing.duration,
    total: timing.delay + timing.duration,
    uniforms,
    grains,
  };
}
