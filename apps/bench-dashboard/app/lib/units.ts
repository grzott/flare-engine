export type ScaledTime = { value: string; unit: string };

export function fmtTime(ns: number): ScaledTime {
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
