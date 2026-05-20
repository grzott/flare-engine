export type PerfSectionStats = {
  readonly name: string;
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
};

export type PerfCounterStats = {
  readonly name: string;
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly sum: number;
  readonly mean: number;
};

export type PerfReport = {
  readonly label: string;
  readonly durationMs: number;
  readonly frameCount: number;
  readonly sections: readonly PerfSectionStats[];
  readonly counters: readonly PerfCounterStats[];
};

export type PerfRecorderHandle = {
  beginSection(name: string): void;
  endSection(name: string): void;
  recordFrame(counters?: Record<string, number>): void;
  flush(): PerfReport;
  reset(): void;
};

type SectionState = {
  name: string;
  ring: Float32Array;
  ringSize: number;
  head: number;
  filled: number;
  startT: number;
};

type CounterState = {
  name: string;
  count: number;
  min: number;
  max: number;
  sum: number;
};

type PerfRecorderOpts = {
  label?: string;
  ringSize?: number;
};

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function percentile(sorted: Float32Array, n: number, p: number): number {
  if (n === 0) return 0;
  if (n === 1) return sorted[0] as number;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (idx - lo);
}

export function createPerfRecorder(opts: PerfRecorderOpts = {}): PerfRecorderHandle {
  const label = opts.label ?? 'perf';
  const ringSize = opts.ringSize ?? 1800;

  const sections = new Map<string, SectionState>();
  const counters = new Map<string, CounterState>();
  let frameCount = 0;
  let startT: number | null = null;

  // Reusable sort buffer — allocated once on first flush, grown as needed
  let sortBuf = new Float32Array(ringSize);

  function getOrCreateSection(name: string): SectionState {
    let s = sections.get(name);
    if (s === undefined) {
      s = {
        name,
        ring: new Float32Array(ringSize),
        ringSize,
        head: 0,
        filled: 0,
        startT: 0,
      };
      sections.set(name, s);
    }
    return s;
  }

  function getOrCreateCounter(name: string): CounterState {
    let c = counters.get(name);
    if (c === undefined) {
      c = { name, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0 };
      counters.set(name, c);
    }
    return c;
  }

  function beginSection(name: string): void {
    const s = getOrCreateSection(name);
    s.startT = nowMs();
  }

  function endSection(name: string): void {
    const s = sections.get(name);
    if (s === undefined) return;
    const elapsed = nowMs() - s.startT;
    s.ring[s.head] = elapsed;
    s.head = (s.head + 1) % s.ringSize;
    if (s.filled < s.ringSize) s.filled += 1;
  }

  function recordFrame(frameCounters?: Record<string, number>): void {
    if (startT === null) startT = nowMs();
    frameCount += 1;
    if (frameCounters === undefined) return;
    for (const name in frameCounters) {
      const v = frameCounters[name] as number;
      const c = getOrCreateCounter(name);
      c.count += 1;
      if (v < c.min) c.min = v;
      if (v > c.max) c.max = v;
      c.sum += v;
    }
  }

  function flush(): PerfReport {
    const now = nowMs();
    const durationMs = startT !== null ? now - startT : 0;

    const sectionStats: PerfSectionStats[] = [];
    for (const s of sections.values()) {
      const n = s.filled;
      if (n === 0) {
        sectionStats.push({
          name: s.name,
          count: 0,
          min: 0,
          max: 0,
          mean: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        });
        continue;
      }
      // Grow sort buffer if needed
      if (sortBuf.length < n) sortBuf = new Float32Array(n);
      let sum = 0;
      let minV = Number.POSITIVE_INFINITY;
      let maxV = Number.NEGATIVE_INFINITY;
      // Copy ring in chronological order
      const start = s.filled < s.ringSize ? 0 : s.head;
      for (let i = 0; i < n; i++) {
        const v = s.ring[(start + i) % s.ringSize] as number;
        sortBuf[i] = v;
        sum += v;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
      // Sort only the filled slice
      const slice = sortBuf.subarray(0, n);
      slice.sort();
      sectionStats.push({
        name: s.name,
        count: n,
        min: minV,
        max: maxV,
        mean: sum / n,
        p50: percentile(slice, n, 50),
        p95: percentile(slice, n, 95),
        p99: percentile(slice, n, 99),
      });
    }

    const counterStats: PerfCounterStats[] = [];
    for (const c of counters.values()) {
      counterStats.push({
        name: c.name,
        count: c.count,
        min: c.count > 0 ? c.min : 0,
        max: c.count > 0 ? c.max : 0,
        sum: c.sum,
        mean: c.count > 0 ? c.sum / c.count : 0,
      });
    }

    return { label, durationMs, frameCount, sections: sectionStats, counters: counterStats };
  }

  function reset(): void {
    for (const s of sections.values()) {
      s.ring.fill(0);
      s.head = 0;
      s.filled = 0;
      s.startT = 0;
    }
    for (const c of counters.values()) {
      c.count = 0;
      c.min = Number.POSITIVE_INFINITY;
      c.max = Number.NEGATIVE_INFINITY;
      c.sum = 0;
    }
    frameCount = 0;
    startT = null;
  }

  return { beginSection, endSection, recordFrame, flush, reset };
}
