function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export interface BootEntry {
  readonly name: string;
  readonly t: number;
}

export interface PerfSample {
  readonly label: string;
  readonly value: number;
}

let startT: number | null = null;
const entries: BootEntry[] = [];
const _perfSamples: PerfSample[] = [];

export function markBootStart(): void {
  startT = nowMs();
  entries.length = 0;
  entries.push({ name: 'boot-start', t: 0 });
}

export function markBootMilestone(name: string): void {
  if (startT === null) return;
  entries.push({ name, t: nowMs() - startT });
}

export function getBootTrace(): readonly BootEntry[] {
  return entries.slice();
}

export function resetBootTrace(): void {
  startT = null;
  entries.length = 0;
}

export function markPerfSample(label: string, value: number): void {
  _perfSamples.push({ label, value });
}

export function getPerfSamples(): readonly PerfSample[] {
  return _perfSamples;
}

export function resetPerfSamples(): void {
  _perfSamples.length = 0;
}

export function dumpBootTrace(label = 'boot-trace'): void {
  if (entries.length === 0) return;
  const parts: string[] = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const cur = entries[i];
    if (!prev || !cur) continue;
    parts.push(`${prev.name}->${cur.name}=${(cur.t - prev.t).toFixed(1)}ms`);
  }
  const total = entries[entries.length - 1];
  const totalMs = total ? total.t.toFixed(1) : '0.0';
  console.log(`[${label}] total=${totalMs}ms ${parts.join(' ')}`);
}
