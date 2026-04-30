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
