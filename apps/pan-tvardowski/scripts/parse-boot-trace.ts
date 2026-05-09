#!/usr/bin/env bun
/**
 * Parses `[boot-trace] total=<ms>ms a->b=<ms>ms b->c=<ms>ms ...` lines emitted by
 * `dumpBootTrace()` in `apps/pan-tvardowski/src/perf/cold-start.ts`. Pure function
 * with no I/O; the runner harness pipes adb logcat / TestingBot artifact text into
 * `parseBootTraceLines()` and gets back typed `TtiResult` objects.
 */

export interface TtiResult {
  readonly label: string;
  readonly totalMs: number;
  readonly deltas: Readonly<Record<string, number>>;
}

const BOOT_TRACE_RE = /^\[(?<label>[^\]]+)\]\s+total=(?<total>[\d.]+)ms(?:\s+(?<rest>.+))?$/;
const STEP_RE = /([a-z][a-z0-9-]*)->([a-z][a-z0-9-]*)=([\d.]+)ms/gi;

export function parseBootTraceLine(line: string): TtiResult | null {
  const trimmed = line.trim();
  const match = BOOT_TRACE_RE.exec(trimmed);
  if (!match || !match.groups) return null;
  const label = match.groups.label ?? '';
  const totalRaw = match.groups.total ?? '';
  const totalMs = Number.parseFloat(totalRaw);
  if (!Number.isFinite(totalMs)) return null;
  const deltas: Record<string, number> = {};
  const rest = match.groups.rest ?? '';
  for (const stepMatch of rest.matchAll(STEP_RE)) {
    const from = stepMatch[1];
    const to = stepMatch[2];
    const ms = Number.parseFloat(stepMatch[3] ?? '');
    if (!from || !to || !Number.isFinite(ms)) continue;
    deltas[`${from}->${to}`] = ms;
  }
  return { label, totalMs, deltas };
}

export function parseBootTraceLines(input: string): readonly TtiResult[] {
  const out: TtiResult[] = [];
  for (const raw of input.split(/\r?\n/)) {
    const cleaned = raw.replace(
      /^.*?(\[boot-trace\]|\[cold-start[^\]]*\]|\[[^\]]+\])\s+total=/,
      '$1 total=',
    );
    const result = parseBootTraceLine(cleaned);
    if (result) out.push(result);
  }
  return out;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1] ?? 0;
    const hi = sorted[mid] ?? 0;
    return (lo + hi) / 2;
  }
  return sorted[mid] ?? Number.NaN;
}

export interface DeviceTtiSummary {
  readonly device: string;
  readonly runs: readonly TtiResult[];
  readonly medianTotalMs: number;
  readonly passed: boolean;
  readonly threshold: number;
}

export function summarizeDevice(
  device: string,
  runs: readonly TtiResult[],
  threshold = 3000,
): DeviceTtiSummary {
  const totals = runs.map((r) => r.totalMs);
  const med = median(totals);
  return {
    device,
    runs,
    medianTotalMs: med,
    threshold,
    passed: Number.isFinite(med) && med < threshold,
  };
}

if (import.meta.main) {
  const chunks: Buffer[] = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    const results = parseBootTraceLines(text);
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    if (results.length === 0) process.exit(2);
  });
}
