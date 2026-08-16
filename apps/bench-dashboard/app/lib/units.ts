export type ScaledTime = { value: string; unit: string };

export function fmtTime(ns: number | undefined): ScaledTime {
  // A row captured below the p99 sample threshold carries no p99 at all. Without
  // this guard both comparisons below are false for `undefined` and the cell
  // renders the string "NaN ms" with nothing in CI to catch it.
  if (ns === undefined || !Number.isFinite(ns)) return { value: '—', unit: '' };
  if (ns < 1_000) return { value: ns.toFixed(1), unit: 'ns' };
  if (ns < 1_000_000) return { value: (ns / 1_000).toFixed(2), unit: 'µs' };
  return { value: (ns / 1_000_000).toFixed(3), unit: 'ms' };
}

export function fmtOps(ops: number): string {
  if (ops >= 1_000_000_000) return `${(ops / 1_000_000_000).toFixed(2)}G/s`;
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M/s`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}K/s`;
  return `${ops.toFixed(0)}/s`;
}

export function suiteUnit(results: { medianNs: number }[]): 'ns' | 'µs' | 'ms' {
  const max = Math.max(...results.map((r) => r.medianNs));
  if (max < 1_000) return 'ns';
  if (max < 1_000_000) return 'µs';
  return 'ms';
}

export function nsToUnit(ns: number, unit: 'ns' | 'µs' | 'ms'): number {
  if (unit === 'µs') return ns / 1_000;
  if (unit === 'ms') return ns / 1_000_000;
  return ns;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
