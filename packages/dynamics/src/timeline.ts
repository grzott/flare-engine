/** Bake-once / scrub-often recorder for a fixed-step simulation. Friction +
 *  restitution Euler is not time-reversible, so a fall is recorded once into a
 *  pre-allocated `Float32Array` and replayed by sampling — reverse, scrub and
 *  speed all read back through `sampleInto` instead of re-integrating.
 *
 *  Angles are stored exactly as written. `Body.angle` is cumulative and never
 *  wrapped, so a plain lerp between adjacent frames is correct across
 *  multi-turn spins; a shortest-path angle lerp would unravel them.
 *
 *  Float32 storage is deliberate: this is playback precision, not simulation
 *  precision, at half the bytes of f64. */

export interface TimelineOptions {
  /** Floats per element per frame. Default 3: `dx`, `dy`, `angle`. */
  stride?: number;
  /** Frame cap; the whole buffer is allocated at creation. Default 900. */
  maxFrames?: number;
}

/** Fills one frame of `buf`: element `i` lives at `frameBase + i * stride`. */
export type TimelineWriter = (buf: Float32Array, frameBase: number) => void;

export interface Timeline {
  readonly elementCount: number;
  /** Frames recorded so far. */
  readonly frameCount: number;
  /** Recorded length in seconds: `(frameCount - 1) * dt`, 0 below two frames. */
  readonly duration: number;
  /** Writes frames until `until()` returns true or the buffer is full; without
   *  `until`, exactly one frame. `record(write)` once per tick suits a chunked,
   *  time-budgeted bake; `record(stepAndWrite, isSettled)` bakes in one call
   *  when the writer also advances the simulation. No-op once full. */
  record(writer: TimelineWriter, until?: () => boolean): void;
  /** Lerps the two frames bracketing `progress` (clamped to [0, 1], NaN reads
   *  as 0) into `out`, which must hold at least `elementCount * stride`
   *  floats. Zero-alloc. All zeros before the first frame. */
  sampleInto(progress: number, out: Float32Array): void;
}

const DEFAULT_STRIDE = 3;
const DEFAULT_MAX_FRAMES = 900;

function assertCount(name: string, value: number, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`createTimeline: ${name} must be an integer >= ${min}, got ${value}`);
  }
}

export function createTimeline(
  elementCount: number,
  dt: number,
  opts: TimelineOptions = {},
): Timeline {
  assertCount('elementCount', elementCount, 0);
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError(`createTimeline: dt must be a finite number > 0, got ${dt}`);
  }
  const stride = opts.stride ?? DEFAULT_STRIDE;
  const maxFrames = opts.maxFrames ?? DEFAULT_MAX_FRAMES;
  assertCount('stride', stride, 1);
  assertCount('maxFrames', maxFrames, 1);

  const frameStride = elementCount * stride;
  const buf = new Float32Array(Math.max(1, frameStride) * maxFrames);
  let frameCount = 0;

  return {
    elementCount,
    get frameCount() {
      return frameCount;
    },
    get duration() {
      return frameCount > 1 ? (frameCount - 1) * dt : 0;
    },
    record(writer, until) {
      if (elementCount === 0) return;
      while (frameCount < maxFrames) {
        writer(buf, frameCount * frameStride);
        frameCount++;
        if (until === undefined || until()) return;
      }
    },
    sampleInto(progress, out) {
      const n = frameStride;
      if (frameCount === 0) {
        out.fill(0, 0, n);
        return;
      }
      // NaN fails both comparisons and lands on 0.
      const p = progress > 1 ? 1 : progress >= 0 ? progress : 0;
      const f = p * (frameCount - 1);
      const i0 = Math.floor(f);
      const a = f - i0;
      const i1 = i0 + 1 < frameCount ? i0 + 1 : i0;
      const b0 = i0 * n;
      const b1 = i1 * n;
      for (let o = 0; o < n; o++) {
        const lo = buf[b0 + o]!;
        const hi = buf[b1 + o]!;
        out[o] = lo + (hi - lo) * a;
      }
    },
  };
}
