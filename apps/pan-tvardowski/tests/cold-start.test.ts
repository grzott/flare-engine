import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  dumpBootTrace,
  getBootTrace,
  markBootMilestone,
  markBootStart,
  resetBootTrace,
} from '../src/perf/cold-start';

describe('cold-start trace', () => {
  beforeEach(() => {
    resetBootTrace();
  });

  test('getBootTrace returns empty array after resetBootTrace', () => {
    const trace = getBootTrace();
    expect(trace).toHaveLength(0);
  });

  test('markBootStart produces single boot-start entry with t=0', () => {
    markBootStart();
    const trace = getBootTrace();
    expect(trace).toHaveLength(1);
    expect(trace[0]?.name).toBe('boot-start');
    expect(trace[0]?.t).toBe(0);
  });

  test('markBootMilestone appends entry with t >= 0 after markBootStart', () => {
    markBootStart();
    markBootMilestone('x');
    const trace = getBootTrace();
    expect(trace).toHaveLength(2);
    expect(trace[1]?.name).toBe('x');
    expect(trace[1]?.t).toBeGreaterThanOrEqual(0);
  });

  test('multiple milestones preserve insertion order', () => {
    markBootStart();
    markBootMilestone('a');
    markBootMilestone('b');
    markBootMilestone('c');
    const names = getBootTrace().map((e) => e.name);
    expect(names).toEqual(['boot-start', 'a', 'b', 'c']);
  });

  test('markBootMilestone before markBootStart is a no-op', () => {
    markBootMilestone('premature');
    expect(getBootTrace()).toHaveLength(0);
  });
});

describe('dumpBootTrace', () => {
  const originalLog = console.log;
  const captured: string[] = [];

  beforeEach(() => {
    resetBootTrace();
    captured.length = 0;
    console.log = (msg: unknown) => {
      captured.push(String(msg));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('emits one [boot-trace] line with total + per-step deltas', () => {
    markBootStart();
    markBootMilestone('a');
    markBootMilestone('b');
    dumpBootTrace();
    expect(captured).toHaveLength(1);
    const line = captured[0] ?? '';
    expect(line.startsWith('[boot-trace] total=')).toBe(true);
    expect(line).toContain('boot-start->a=');
    expect(line).toContain('a->b=');
    expect(line).toMatch(/total=\d+\.\dms/);
  });

  test('no-op when trace empty (no markBootStart called)', () => {
    dumpBootTrace();
    expect(captured).toHaveLength(0);
  });

  test('label override surfaces in the emitted line tag', () => {
    markBootStart();
    markBootMilestone('first-frame');
    dumpBootTrace('cold-start-pixel7');
    const line = captured[0] ?? '';
    expect(line.startsWith('[cold-start-pixel7] ')).toBe(true);
  });
});
