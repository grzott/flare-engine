/**
 * Batch sampler for the bench-web render suites.
 *
 * **Why this is not a frame-delta sampler.** The previous implementation ran `work()` once per
 * `requestAnimationFrame` callback and took the time between consecutive callbacks as the sample,
 * dividing by a fixed `innerIters` to get per-op cost. rAF is vsync-locked, so that delta can only
 * ever be an integer multiple of the display refresh interval — which means the reported cost could
 * only ever be `k * refreshInterval / innerIters` for integer `k`. Every number the web lane
 * published under that sampler was such a multiple: on a 60 Hz desktop, 13 of the 18 GPU rows came
 * out at exactly `k = 1`, i.e. they reported the refresh interval and nothing about the engine.
 * Work cheaper than one refresh interval is invisible to a frame-delta clock by construction.
 *
 * So rAF is kept as the *scheduler* — one batch per callback, which keeps the page responsive and
 * lets the compositor run between batches — and `now()` is used as the *clock*, bracketing the
 * inner loop directly.
 *
 * **Why batches are sized by time rather than by a fixed op count.** Two independent reasons:
 *
 *  1. `performance.now()` is deliberately coarsened in browsers as a Spectre mitigation — 100 µs in
 *     Chrome without cross-origin isolation. A bracket must be long enough that this clamp is
 *     noise: a 20 ms window makes it a 0.5% error, where a 1 ms window would make it 10%.
 *  2. `innerIters` in the shared scenario SoT was sized for the Node microbench's 0.3-25 ms window
 *     against a counting stub. Real CanvasKit CPU-raster is orders of magnitude slower per op and a
 *     GPU submit is far faster, and a phone sits between them — no single fixed count is right for
 *     all three lanes. Growing the batch until the clock says it is big enough self-calibrates.
 *
 * `innerIters` is therefore untouched in the scenario SoT (the Node lane still uses it); only this
 * runner opts out of it.
 *
 * **What the measurement means per lane.** For the CPU-raster target every drawn op is synchronous
 * CPU work, so the bracket captures all of it. For the GPU target it captures **CPU-side submission
 * cost only** — WebGL/CanvasKit calls queue work and return, and GPU execution completes
 * asynchronously. Measuring true GPU time from JS needs `EXT_disjoint_timer_query_webgl2` (usually
 * unavailable to page script) or a forced `finish()`/`readPixels` sync, which distorts by
 * serializing the pipeline. The GPU lane's numbers are labelled as submission cost rather than
 * silently presented as frame cost.
 */

/** One measured batch: `ops` repetitions of the work, bracketed by the clock. */
export type BatchSample = {
  /** `elapsedMs / ops` — the reported per-op cost. */
  readonly perOpMs: number;
  /** Repetitions actually run to fill the target window. */
  readonly ops: number;
  /** Measured wall time for the whole batch. */
  readonly elapsedMs: number;
  /**
   * rAF timestamp delta across this batch, retained as a diagnostic rather than used as the clock.
   * It preserves the frame-budget signal ("did this batch's work fit in a frame") and is the value
   * that makes vsync quantization visible if it ever returns. Zero for the first batch, which has
   * no predecessor to difference against.
   */
  readonly frameDeltaMs: number;
};

export type SamplerDeps = {
  readonly now: () => number;
  readonly schedule: (cb: (ts: number) => void) => void;
};

export type SamplerOptions = {
  readonly minSamples: number;
  readonly warmupMs: number;
  /** Target wall time per batch. See this file's header for why time, not op count. */
  readonly targetBatchMs: number;
  /** Scenario name, used only to make a refusal say which row could not be measured. */
  readonly label: string;
};

const REAL_DEPS: SamplerDeps = {
  now: () => performance.now(),
  schedule: (cb) => {
    requestAnimationFrame(cb);
  },
};

/** Default batch window — long enough to dominate a 100 µs `performance.now()` clamp. */
export const DEFAULT_TARGET_BATCH_MS = 20;

/**
 * Upper bound on repetitions inside one batch. Reaching it without filling the time window means
 * the clock is not advancing across the work at all, which is a broken measurement, not a fast one.
 * Refusing is the only honest outcome: a zero-cost row cannot be distinguished from a row whose
 * work never ran.
 */
const MAX_OPS_PER_BATCH = 20_000_000;

export function sampleBatches(
  work: () => void,
  options: SamplerOptions,
  deps: SamplerDeps = REAL_DEPS,
): Promise<BatchSample[]> {
  const { minSamples, warmupMs, targetBatchMs, label } = options;

  return new Promise((resolve, reject) => {
    const samples: BatchSample[] = [];
    let warmupStart: number | null = null;
    let warmedUp = warmupMs <= 0;
    let lastTs: number | null = null;

    const tick = (ts: number): void => {
      if (!warmedUp) {
        if (warmupStart === null) warmupStart = ts;
        work();
        if (ts - warmupStart >= warmupMs) {
          warmedUp = true;
          lastTs = null;
        }
        deps.schedule(tick);
        return;
      }

      const frameDeltaMs = lastTs === null ? 0 : ts - lastTs;
      lastTs = ts;

      const t0 = deps.now();
      let ops = 0;
      let elapsedMs = 0;
      do {
        work();
        ops++;
        elapsedMs = deps.now() - t0;
      } while (elapsedMs < targetBatchMs && ops < MAX_OPS_PER_BATCH);

      if (elapsedMs < targetBatchMs) {
        reject(
          new Error(
            `bench-web: "${label}" could not be measured — ${ops} repetitions did not advance the ` +
              `clock to ${targetBatchMs} ms (read ${elapsedMs} ms). The clock is not resolving this ` +
              `work; publishing the resulting per-op figure would report timer behaviour, not cost.`,
          ),
        );
        return;
      }

      samples.push({ perOpMs: elapsedMs / ops, ops, elapsedMs, frameDeltaMs });

      if (samples.length >= minSamples) {
        resolve(samples);
        return;
      }
      deps.schedule(tick);
    };

    deps.schedule(tick);
  });
}
