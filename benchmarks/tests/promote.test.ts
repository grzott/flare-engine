import { describe, expect, test } from 'bun:test';
import { aggregateRuns } from '../src/promote.js';
import type { MicrobenchReport, MicrobenchResult } from '../src/results.js';
import { EXPECTED_HEAP_SCENARIOS, EXPECTED_SCENARIOS } from '../src/scenario-contract.js';

/**
 * Builds a contract-satisfying report whose scenarios all report `medianNs`.
 * Every scenario in a run shares the value, so a run is identified by one
 * number and the aggregation math stays legible.
 */
function runAt(medianNs: number, overrides: Partial<MicrobenchReport> = {}): MicrobenchReport {
  const result = (scenario: string): MicrobenchResult => ({
    scenario,
    medianNs,
    meanNs: medianNs,
    minNs: medianNs,
    p99Ns: medianNs,
    opsPerSec: 1e9 / medianNs,
    samples: 30,
    innerIters: 100,
  });
  return {
    generated: `2026-07-2${Math.min(9, Math.max(0, Math.round(medianNs % 10)))}T00:00:00.000Z`,
    runtime: 'Bun 1.3.11',
    platform: 'win32 x64',
    cpuModel: 'Test CPU',
    cpuCount: 8,
    totalMemMB: 16000,
    gitSha: 'abc123abc123',
    gitDirty: false,
    suites: Object.entries(EXPECTED_SCENARIOS).map(([title, scenarios]) => ({
      title,
      results: scenarios.map(result),
    })),
    heap: EXPECTED_HEAP_SCENARIOS.map((name) => ({
      name,
      iterations: 500,
      deltaBytes: medianNs,
      bytesPerFrame: medianNs / 500,
    })),
    ...overrides,
  };
}

function firstResult(report: MicrobenchReport): MicrobenchResult {
  return (report.suites[0] as { results: MicrobenchResult[] }).results[0] as MicrobenchResult;
}

describe('aggregateRuns', () => {
  test('takes the per-scenario median across runs, not the mean', () => {
    // Mean would be 40 (the 100 outlier drags it); the median is 20.
    const outcome = aggregateRuns([runAt(10), runAt(20), runAt(100)].map((r) => r));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(firstResult(outcome.report).medianNs).toBe(20);
  });

  test('records the run-to-run spread as the band', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20), runAt(100)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = firstResult(outcome.report);
    expect(r.bandMinNs).toBe(10);
    expect(r.bandMaxNs).toBe(100);
  });

  test('opsPerSec is recomputed from the aggregated median, not aggregated itself', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20), runAt(100)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = firstResult(outcome.report);
    expect(r.opsPerSec).toBe(1e9 / r.medianNs);
  });

  test('carries run count and every source capture timestamp', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20), runAt(30)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.runs).toBe(3);
    const sources = outcome.report.aggregatedFrom ?? [];
    expect(sources).toHaveLength(3);
    // The baseline is dated by its newest capture, never by promotion time.
    expect(outcome.report.generated).toBe(sources[sources.length - 1] as string);
  });

  test('refuses an empty set rather than emitting an empty baseline', () => {
    const outcome = aggregateRuns([]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.join(' ')).toContain('no runs');
  });

  test('refuses runs from different machines', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20, { cpuModel: 'Other CPU' })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('cpuModel'))).toBe(true);
  });

  test('refuses runs from different commits', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20, { gitSha: 'deadbeefdead' })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('gitSha'))).toBe(true);
  });

  test('refuses a run captured from a dirty tree', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20, { gitDirty: true })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('dirty tree'))).toBe(true);
  });

  test('refuses a run whose scenario names drifted from the contract', () => {
    const drifted = runAt(20);
    const suite = drifted.suites[0] as { results: MicrobenchResult[] };
    (suite.results[0] as MicrobenchResult).scenario = 'ecs.tick  9999 entities';
    const outcome = aggregateRuns([runAt(10), drifted]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('unexpected scenario'))).toBe(true);
  });

  test('a single run aggregates to itself with a zero-width band', () => {
    const outcome = aggregateRuns([runAt(42)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = firstResult(outcome.report);
    expect(r.medianNs).toBe(42);
    expect(r.bandMinNs).toBe(42);
    expect(r.bandMaxNs).toBe(42);
  });
});
