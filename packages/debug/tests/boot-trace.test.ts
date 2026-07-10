import { describe, expect, test } from 'bun:test';
import { createBootTrace } from '../src/boot-trace.js';

// Replicated inline from apps/pan-tvardowski/scripts/parse-boot-trace.ts
// to verify format parity without crossing the engine/app boundary.
const BOOT_TRACE_RE = /^\[(?<label>[^\]]+)\]\s+total=(?<total>[\d.]+)ms(?:\s+(?<rest>.+))?$/;
const STEP_RE = /([a-z][a-z0-9-]*)->([a-z][a-z0-9-]*)=([\d.]+)ms/gi;

function parseBootTraceLine(
  line: string,
): { label: string; totalMs: number; deltas: Record<string, number> } | null {
  const match = BOOT_TRACE_RE.exec(line.trim());
  if (!match?.groups) return null;
  const label = match.groups.label ?? '';
  const totalMs = Number.parseFloat(match.groups.total ?? '');
  if (!Number.isFinite(totalMs)) return null;
  const deltas: Record<string, number> = {};
  const rest = match.groups.rest ?? '';
  for (const m of rest.matchAll(STEP_RE)) {
    const from = m[1];
    const to = m[2];
    const ms = Number.parseFloat(m[3] ?? '');
    if (!from || !to || !Number.isFinite(ms)) continue;
    deltas[`${from}->${to}`] = ms;
  }
  return { label, totalMs, deltas };
}

describe('createBootTrace', () => {
  test('dump returns null before any marks', () => {
    const trace = createBootTrace();
    expect(trace.dump()).toBeNull();
  });

  test('single mark produces total=0.0ms with no step segments', () => {
    const trace = createBootTrace();
    trace.mark('app');
    const out = trace.dump();
    expect(out).not.toBeNull();
    expect(out).toMatch(/^\[boot-trace\] total=0\.0ms$/);
  });

  test('default label is boot-trace', () => {
    const trace = createBootTrace();
    trace.mark('a');
    trace.mark('b');
    const out = trace.dump();
    expect(out).toMatch(/^\[boot-trace\]/);
  });

  test('custom label is used in output', () => {
    const trace = createBootTrace('cold-start');
    trace.mark('a');
    trace.mark('b');
    const out = trace.dump();
    expect(out).toMatch(/^\[cold-start\]/);
  });

  test('format matches BOOT_TRACE_RE + STEP_RE used by parse-boot-trace.ts', () => {
    const trace = createBootTrace();
    trace.mark('app');
    trace.mark('js');
    trace.mark('tti');
    const out = trace.dump();
    expect(out).not.toBeNull();

    const parsed = parseBootTraceLine(out as string);
    expect(parsed).not.toBeNull();
    expect(parsed?.label).toBe('boot-trace');
    expect(Number.isFinite(parsed?.totalMs)).toBe(true);
    expect(parsed?.totalMs).toBeGreaterThanOrEqual(0);
    expect(typeof parsed?.deltas['app->js']).toBe('number');
    expect(typeof parsed?.deltas['js->tti']).toBe('number');
  });

  test('reset clears state so dump returns null and new marks restart cleanly', () => {
    const trace = createBootTrace();
    trace.mark('a');
    trace.mark('b');
    trace.reset();
    expect(trace.dump()).toBeNull();

    trace.mark('x');
    trace.mark('y');
    const out = trace.dump();
    expect(out).not.toBeNull();
    expect(out).toMatch(/x->y=/);
  });

  test('getEntries returns a snapshot copy with correct names and ascending t', () => {
    const trace = createBootTrace();
    trace.mark('start');
    trace.mark('mid');
    trace.mark('end');
    const entries = trace.getEntries();
    expect(entries.length).toBe(3);
    expect(entries[0]?.name).toBe('start');
    expect(entries[1]?.name).toBe('mid');
    expect(entries[2]?.name).toBe('end');
    expect(entries[0]?.t).toBe(0);
    expect(entries[1]?.t ?? 0).toBeGreaterThanOrEqual(0);
    expect(entries[2]?.t ?? 0).toBeGreaterThanOrEqual(entries[1]?.t ?? 0);

    // Mutation of the returned array must not affect internal state
    (entries as BootEntry[]).length = 0;
    expect(trace.getEntries().length).toBe(3);
  });
});

// Needed for the mutation check above
type BootEntry = { readonly name: string; readonly t: number };
