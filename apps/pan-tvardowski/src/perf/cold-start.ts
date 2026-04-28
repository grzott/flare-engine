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

let startT: number | null = null;
const entries: BootEntry[] = [];

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
