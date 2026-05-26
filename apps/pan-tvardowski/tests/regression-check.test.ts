/**
 * E7 — regression-check.ts behavioral tests.
 *
 * Tests verify the threshold logic, median computation, window filtering,
 * and per-device / per-scenario override resolution.
 * No file I/O — all inputs are constructed inline.
 */

import { describe, expect, test } from 'bun:test';
import {
  type BaselineOverride,
  type BenchRow,
  DEFAULT_THRESHOLD,
  checkRegressions,
  computeMedian,
  parseNdjson,
  resolveThreshold,
  windowRows,
} from '../../../scripts/perf/regression-check';

// ---------------------------------------------------------------------------
// parseNdjson
// ---------------------------------------------------------------------------

describe('parseNdjson', () => {
  test('parses valid NDJSON into BenchRow array', () => {
    const raw = [
      JSON.stringify({
        device: 'pixel-6a',
        scenario: 'boot',
        metric: 'frameMs',
        p95: 12.5,
        capturedAt: '2026-05-24T00:00:00Z',
      }),
      JSON.stringify({
        device: 'galaxy-a54',
        scenario: 'boot',
        metric: 'frameMs',
        p95: 14.0,
        capturedAt: '2026-05-24T01:00:00Z',
      }),
    ].join('\n');
    const rows = parseNdjson(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.device).toBe('pixel-6a');
    expect(rows[1]?.p95).toBe(14.0);
  });

  test('ignores blank lines', () => {
    const raw = `${JSON.stringify({ device: 'd', scenario: 's', metric: 'm', p95: 1, capturedAt: '2026-01-01T00:00:00Z' })}\n\n`;
    expect(parseNdjson(raw)).toHaveLength(1);
  });

  test('returns empty array for empty string', () => {
    expect(parseNdjson('')).toHaveLength(0);
  });

  test('skips non-JSON garbage lines (testingbot CLI leakage)', () => {
    const raw = [
      'Uploading Maestro Flows',
      '  flows.zip: done (1.1 KB)',
      'Running Maestro Tests',
      JSON.stringify({
        device: 'pixel-10',
        scenario: 'boot',
        metric: 'frame',
        p95: 0.0038,
        capturedAt: '2026-05-26T05:05:38Z',
      }),
      'All tests completed successfully!',
    ].join('\n');
    const rows = parseNdjson(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.device).toBe('pixel-10');
    expect(rows[0]?.p95).toBe(0.0038);
  });
});

// ---------------------------------------------------------------------------
// computeMedian
// ---------------------------------------------------------------------------

describe('computeMedian', () => {
  test('returns 0 for empty array', () => {
    expect(computeMedian([])).toBe(0);
  });

  test('returns sole element for single-element array', () => {
    expect(computeMedian([7])).toBe(7);
  });

  test('returns average of two middle elements for even-length array', () => {
    expect(computeMedian([1, 3])).toBe(2);
  });

  test('returns middle element for odd-length array', () => {
    expect(computeMedian([1, 5, 3])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// windowRows
// ---------------------------------------------------------------------------

describe('windowRows', () => {
  const reference = new Date('2026-05-24T12:00:00Z');
  const inside: BenchRow = {
    device: 'pixel-6a',
    scenario: 'boot',
    metric: 'm',
    p95: 10,
    capturedAt: '2026-05-20T00:00:00Z',
  };
  const outside: BenchRow = {
    device: 'pixel-6a',
    scenario: 'boot',
    metric: 'm',
    p95: 10,
    capturedAt: '2026-05-01T00:00:00Z',
  };

  test('includes rows within the window', () => {
    expect(windowRows([inside], 7, reference)).toHaveLength(1);
  });

  test('excludes rows outside the window', () => {
    expect(windowRows([outside], 7, reference)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolveThreshold
// ---------------------------------------------------------------------------

describe('resolveThreshold', () => {
  test('returns DEFAULT_THRESHOLD when override is empty', () => {
    expect(resolveThreshold('pixel-6a', 'boot', {})).toBe(DEFAULT_THRESHOLD);
  });

  test('perDevice override takes precedence over global threshold', () => {
    const override: BaselineOverride = { threshold: 1.05, perDevice: { 'pixel-6a': 1.1 } };
    expect(resolveThreshold('pixel-6a', 'boot', override)).toBe(1.1);
  });

  test('perScenario override applies when device is not listed', () => {
    const override: BaselineOverride = { perScenario: { 'zone-transitions': 1.08 } };
    expect(resolveThreshold('galaxy-a54', 'zone-transitions', override)).toBe(1.08);
  });

  test('global threshold applies when neither perDevice nor perScenario match', () => {
    const override: BaselineOverride = { threshold: 1.07 };
    expect(resolveThreshold('pixel-6a', 'boot', override)).toBe(1.07);
  });
});

// ---------------------------------------------------------------------------
// checkRegressions — threshold boundary
// ---------------------------------------------------------------------------

describe('checkRegressions — threshold boundary', () => {
  const reference = new Date('2026-05-24T12:00:00Z');

  function makeHistory(p95: number, daysAgo: number): BenchRow {
    const d = new Date(reference);
    d.setDate(d.getDate() - daysAgo);
    return {
      device: 'pixel-6a',
      scenario: 'boot',
      metric: 'frameMs',
      p95,
      capturedAt: d.toISOString(),
    };
  }

  function makeLatest(p95: number): BenchRow {
    return {
      device: 'pixel-6a',
      scenario: 'boot',
      metric: 'frameMs',
      p95,
      capturedAt: reference.toISOString(),
    };
  }

  test('ratio exactly at 1.05 does NOT trigger regression (inclusive boundary)', () => {
    // baseline median = 10.0, current = 10.5 → ratio = 1.05 exactly
    const rows = [makeHistory(10.0, 3), makeLatest(10.5)];
    const results = checkRegressions(rows, 7, {}, reference);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r).toBeDefined();
    if (r === undefined) throw new Error('result undefined');
    expect(r.ratio).toBeCloseTo(1.05, 5);
    expect(r.regressed).toBe(false);
  });

  test('ratio just over 1.05 DOES trigger regression', () => {
    // baseline median = 10.0, current = 10.501 → ratio > 1.05
    const rows = [makeHistory(10.0, 3), makeLatest(10.501)];
    const results = checkRegressions(rows, 7, {}, reference);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r).toBeDefined();
    if (r === undefined) throw new Error('result undefined');
    expect(r.ratio).toBeGreaterThan(1.05);
    expect(r.regressed).toBe(true);
  });

  test('no history → baselineMedian equals currentP95 → ratio 1 → no regression', () => {
    const rows = [makeLatest(20.0)];
    const results = checkRegressions(rows, 7, {}, reference);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r).toBeDefined();
    if (r === undefined) throw new Error('result undefined');
    expect(r.baselineMedian).toBe(20.0);
    expect(r.regressed).toBe(false);
  });
});
