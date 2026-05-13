import { type BootEntry, createBootTrace } from '@flare-engine/debug';

export type { BootEntry };

export interface PerfSample {
  readonly label: string;
  readonly value: number;
}

const _trace = createBootTrace('boot-trace');
let _started = false;
const _perfSamples: PerfSample[] = [];

export function markBootStart(): void {
  _trace.reset();
  _started = true;
  _trace.mark('boot-start');
}

export function markBootMilestone(name: string): void {
  if (!_started) return;
  _trace.mark(name);
}

export function getBootTrace(): readonly BootEntry[] {
  return _trace.getEntries();
}

export function resetBootTrace(): void {
  _trace.reset();
  _started = false;
}

export function dumpBootTrace(label = 'boot-trace'): void {
  const entries = _trace.getEntries();
  if (entries.length === 0) return;
  const parts: string[] = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const cur = entries[i];
    if (!prev || !cur) continue;
    parts.push(`${prev.name}->${cur.name}=${(cur.t - prev.t).toFixed(1)}ms`);
  }
  const last = entries[entries.length - 1];
  const totalMs = last ? last.t.toFixed(1) : '0.0';
  const stepStr = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  console.log(`[${label}] total=${totalMs}ms${stepStr}`);
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
