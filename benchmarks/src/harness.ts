export type BenchDef<S> = {
  name: string;
  setup: () => S;
  run: (state: S) => void;
  innerIters?: number;
  samples?: number;
  /** Warm-up budget in milliseconds. Batches run until the budget is spent. */
  warmupMs?: number;
};

export type BenchStats = {
  name: string;
  innerIters: number;
  samples: number;
  nsPerOp: {
    min: number;
    median: number;
    mean: number;
    max: number;
    /**
     * Present only when `samples >= P99_MIN_SAMPLES`. A 99th percentile drawn
     * from 30 samples is the single worst sample under another name — it
     * carries no more information than `max` and reads as if it did.
     */
    p99?: number;
  };
  opsPerSec: number;
  /**
   * Median wall time of one sample window, in milliseconds. Not persisted (it
   * is `innerIters * median` by construction) — the capture CLI uses it to warn
   * when a row's `innerIters` has drifted out of the timeable range.
   */
  sampleWindowMs: number;
  /** Warm-up batches actually executed before sampling. */
  warmupBatches: number;
};

/**
 * Per-run overrides applied on top of every BenchDef. The smoke gate runs the
 * real suites at sample counts that finish in seconds; timings from an
 * overridden run are not comparable to a full capture.
 */
export type BenchOverrides = {
  samples?: number;
  innerIters?: number;
  warmupMs?: number;
};

export const SMOKE_OVERRIDES: BenchOverrides = { samples: 2, innerIters: 1, warmupMs: 0 };

/**
 * Below this sample count a "p99" is not a percentile estimate, it is the top
 * sample. Rows under the threshold report `max` and omit p99 entirely rather
 * than publishing a number that sounds stronger than the data behind it.
 */
export const P99_MIN_SAMPLES = 100;

/** Default warm-up budget: enough for JSC to tier up the hot path. */
export const DEFAULT_WARMUP_MS = 300;

/**
 * A sample window shorter than this cannot be timed honestly against
 * `performance.now()` jitter; one longer than the ceiling wastes capture time
 * for no extra resolution. `index.ts` warns per row outside the band.
 */
export const MIN_SAMPLE_WINDOW_MS = 0.3;
export const MAX_SAMPLE_WINDOW_MS = 25;

const NS_PER_MS = 1_000_000;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] as number;
}

export function runBench<S>(def: BenchDef<S>, overrides?: BenchOverrides): BenchStats {
  const innerIters = overrides?.innerIters ?? def.innerIters ?? 1;
  const samples = overrides?.samples ?? def.samples ?? 100;
  const warmupMs = overrides?.warmupMs ?? def.warmupMs ?? DEFAULT_WARMUP_MS;

  const state = def.setup();

  // Warm up by elapsed time, not by a fixed batch count: a fixed count warms a
  // cheap scenario for microseconds and an expensive one for seconds, so the
  // two are measured at different JIT tiers.
  let warmupBatches = 0;
  if (warmupMs > 0) {
    const wStart = performance.now();
    do {
      for (let i = 0; i < innerIters; i++) def.run(state);
      warmupBatches++;
    } while (performance.now() - wStart < warmupMs);
  }

  const perOpNs: number[] = new Array(samples);
  const windowMs: number[] = new Array(samples);
  for (let s = 0; s < samples; s++) {
    const t0 = performance.now();
    for (let i = 0; i < innerIters; i++) def.run(state);
    const t1 = performance.now();
    windowMs[s] = t1 - t0;
    perOpNs[s] = ((t1 - t0) * NS_PER_MS) / innerIters;
  }

  const sorted = [...perOpNs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const median = percentile(sorted, 0.5);
  const min = sorted[0] as number;
  const max = sorted[sorted.length - 1] as number;
  const opsPerSec = 1e9 / median;

  const nsPerOp: BenchStats['nsPerOp'] = { min, median, mean, max };
  if (samples >= P99_MIN_SAMPLES) nsPerOp.p99 = percentile(sorted, 0.99);

  const sortedWindows = [...windowMs].sort((a, b) => a - b);

  return {
    name: def.name,
    innerIters,
    samples,
    nsPerOp,
    opsPerSec,
    sampleWindowMs: percentile(sortedWindows, 0.5),
    warmupBatches,
  };
}

export function formatStats(s: BenchStats): string {
  const ns = s.nsPerOp.median;
  const cost =
    ns < 1_000
      ? `${ns.toFixed(1)} ns`
      : ns < 1_000_000
        ? `${(ns / 1_000).toFixed(2)} us`
        : `${(ns / 1_000_000).toFixed(2)} ms`;
  const ops =
    s.opsPerSec >= 1e6
      ? `${(s.opsPerSec / 1e6).toFixed(2)}M/s`
      : s.opsPerSec >= 1e3
        ? `${(s.opsPerSec / 1e3).toFixed(1)}K/s`
        : `${s.opsPerSec.toFixed(0)}/s`;
  const tail =
    s.nsPerOp.p99 === undefined
      ? `max ${(s.nsPerOp.max / 1000).toFixed(1)}us`
      : `p99 ${(s.nsPerOp.p99 / 1000).toFixed(1)}us`;
  return `${s.name.padEnd(44)}  ${cost.padStart(10)}/op   ${ops.padStart(10)}   ${tail}`;
}
