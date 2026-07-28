export type BenchDef<S> = {
  name: string;
  setup: () => S;
  run: (state: S) => void;
  innerIters?: number;
  samples?: number;
  warmup?: number;
};

export type BenchStats = {
  name: string;
  innerIters: number;
  samples: number;
  nsPerOp: { min: number; median: number; mean: number; p99: number };
  opsPerSec: number;
};

/**
 * Per-run overrides applied on top of every BenchDef. The smoke gate runs the
 * real suites at sample counts that finish in seconds; timings from an
 * overridden run are not comparable to a full capture.
 */
export type BenchOverrides = {
  samples?: number;
  innerIters?: number;
  warmup?: number;
};

export const SMOKE_OVERRIDES: BenchOverrides = { samples: 2, innerIters: 1, warmup: 0 };

const NS_PER_MS = 1_000_000;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] as number;
}

export function runBench<S>(def: BenchDef<S>, overrides?: BenchOverrides): BenchStats {
  const innerIters = overrides?.innerIters ?? def.innerIters ?? 1;
  const samples = overrides?.samples ?? def.samples ?? 30;
  const warmup = overrides?.warmup ?? def.warmup ?? 3;

  const state = def.setup();

  for (let w = 0; w < warmup; w++) {
    for (let i = 0; i < innerIters; i++) def.run(state);
  }

  const perOpNs: number[] = new Array(samples);
  for (let s = 0; s < samples; s++) {
    const t0 = performance.now();
    for (let i = 0; i < innerIters; i++) def.run(state);
    const t1 = performance.now();
    perOpNs[s] = ((t1 - t0) * NS_PER_MS) / innerIters;
  }

  const sorted = [...perOpNs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const median = percentile(sorted, 0.5);
  const p99 = percentile(sorted, 0.99);
  const min = sorted[0] as number;
  const opsPerSec = 1e9 / median;

  return {
    name: def.name,
    innerIters,
    samples,
    nsPerOp: { min, median, mean, p99 },
    opsPerSec,
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
  return `${s.name.padEnd(44)}  ${cost.padStart(10)}/op   ${ops.padStart(10)}   p99 ${(s.nsPerOp.p99 / 1000).toFixed(1)}us`;
}

export function toMarkdownRow(s: BenchStats): string {
  const ns = s.nsPerOp.median;
  const cost =
    ns < 1_000
      ? `${ns.toFixed(1)} ns`
      : ns < 1_000_000
        ? `${(ns / 1_000).toFixed(2)} µs`
        : `${(ns / 1_000_000).toFixed(2)} ms`;
  const ops =
    s.opsPerSec >= 1e6
      ? `${(s.opsPerSec / 1e6).toFixed(2)}M`
      : s.opsPerSec >= 1e3
        ? `${(s.opsPerSec / 1e3).toFixed(1)}K`
        : s.opsPerSec.toFixed(0);
  const p99 = s.nsPerOp.p99 / 1000;
  return `| ${s.name} | ${cost} | ${ops}/s | ${p99.toFixed(1)} µs |`;
}
