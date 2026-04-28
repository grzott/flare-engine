import { beforeEach, describe, expect, test } from 'bun:test';
import {
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
