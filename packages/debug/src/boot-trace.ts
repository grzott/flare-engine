export type BootEntry = {
  readonly name: string;
  readonly t: number;
};

export type BootTraceHandle = {
  mark(name: string): void;
  dump(): string | null;
  reset(): void;
  getEntries(): readonly BootEntry[];
};

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function createBootTrace(label = 'boot-trace'): BootTraceHandle {
  const entries: BootEntry[] = [];
  let startT: number | null = null;

  function mark(name: string): void {
    if (startT === null) {
      startT = nowMs();
      entries.push({ name, t: 0 });
    } else {
      entries.push({ name, t: nowMs() - startT });
    }
  }

  function dump(): string | null {
    if (entries.length === 0) return null;
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
    return `[${label}] total=${totalMs}ms${stepStr}`;
  }

  function reset(): void {
    entries.length = 0;
    startT = null;
  }

  function getEntries(): readonly BootEntry[] {
    return entries.slice();
  }

  return { mark, dump, reset, getEntries };
}
