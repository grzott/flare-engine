import { describe, expect, test } from 'bun:test';
import type { AllocRow } from '../src/alloc.js';
import { aggregateRuns } from '../src/promote.js';
import { type MicrobenchReport, type MicrobenchResult, SCHEMA_VERSION } from '../src/results.js';
import {
  EXPECTED_ALLOC_SCENARIOS,
  EXPECTED_HEAP_SCENARIOS,
  EXPECTED_SCENARIOS,
} from '../src/scenario-contract.js';

/**
 * Builds a contract-satisfying report whose scenarios all report `medianNs`.
 * Every scenario in a run shares the value, so a run is identified by one
 * number and the aggregation math stays legible.
 */
let captureSeq = 0;

function runAt(medianNs: number, overrides: Partial<MicrobenchReport> = {}): MicrobenchReport {
  // Monotonic and distinct per fixture: a shared timestamp would make the
  // "dated by its newest capture" assertion pass no matter what promote picked.
  captureSeq += 1;
  const stamp = `2026-07-28T${String(captureSeq % 24).padStart(2, '0')}:00:00.000Z`;
  const result = (scenario: string): MicrobenchResult => ({
    scenario,
    medianNs,
    meanNs: medianNs,
    minNs: medianNs,
    maxNs: medianNs * 2,
    p99Ns: medianNs,
    opsPerSec: 1e9 / medianNs,
    samples: 100,
    innerIters: 100,
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    generated: stamp,
    runtime: 'Bun 1.3.11',
    platform: 'win32 x64',
    devFlag: 'false',
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
      iterations: 1000,
      deltaBytes: medianNs,
      bytesPerFrame: medianNs / 1000,
      warmupFrames: 2000,
      converged: true,
      plateauHeapMB: 20,
      blocks: 3,
      blockFrames: 200,
      resolutionBytesPerFrame: 512,
    })),
    alloc: EXPECTED_ALLOC_SCENARIOS.map(allocRow),
    ...overrides,
  };
}

function allocRow(scenario: string): AllocRow {
  const expected = {
    perFrameFactoryCalls: 0,
    drawAtlasPerFrame: 1,
    drawImageRectPerFrame: 0,
    drawRectPerFrame: 0,
    xformUnrotatedPerFrame: 1000,
    xformRotatedPerFrame: 0,
  };
  return {
    scenario,
    frames: 20,
    poolMisses: 0,
    particleFactoryCalls: 0,
    cachedFactoryCalls: 0,
    ...expected,
    expected,
    problems: [],
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

  test('refuses a window that mixes result-schema versions', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20, { schemaVersion: 1 })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('result schema v1'))).toBe(true);
  });

  test('withholds p99 unless every folded run carries one', () => {
    const partial = runAt(20);
    for (const suite of partial.suites) {
      for (const r of suite.results) r.p99Ns = undefined;
    }
    const outcome = aggregateRuns([runAt(10), partial, runAt(30)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Medianing [number, undefined, number] silently publishes an arbitrary
    // member; the row must simply carry no p99 instead.
    expect(firstResult(outcome.report).p99Ns).toBeUndefined();
  });

  test('folds maxNs across runs', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20), runAt(100)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(firstResult(outcome.report).maxNs).toBe(40);
  });

  test('carries the exact-counter section through promotion', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect((outcome.report.alloc ?? []).map((r) => r.scenario)).toEqual([
      ...EXPECTED_ALLOC_SCENARIOS,
    ]);
  });

  test('refuses runs whose exact counters disagree — that is a finding, not noise', () => {
    const drifted = runAt(20);
    const row = (drifted.alloc as AllocRow[])[0] as AllocRow;
    row.drawAtlasPerFrame = 2;
    const outcome = aggregateRuns([runAt(10), drifted]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('not deterministic'))).toBe(true);
  });

  test('refuses a run whose allocation gate failed', () => {
    const failed = runAt(20);
    const row = (failed.alloc as AllocRow[])[0] as AllocRow;
    row.problems = ['pool misses: 3, expected 0'];
    const outcome = aggregateRuns([failed]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('alloc gate failed'))).toBe(true);
  });

  test('refuses a run missing the alloc section entirely', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20, { alloc: [] })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('missing alloc scenario'))).toBe(true);
  });

  test('refuses a window whose runs disagree about the __DEV__ configuration', () => {
    const outcome = aggregateRuns([runAt(10), runAt(20, { devFlag: 'undeclared' })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('devFlag'))).toBe(true);
  });

  test('refuses a run captured with __DEV__ undeclared — it measures a JSC deopt', () => {
    const outcome = aggregateRuns([runAt(10, { devFlag: 'undeclared' })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('undeclared'))).toBe(true);
  });

  test('refuses a heap row that never reached its plateau', () => {
    const drifting = runAt(20);
    const row = drifting.heap[0];
    if (row) row.converged = false;
    const outcome = aggregateRuns([runAt(10), drifting]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('never reached its allocation plateau'))).toBe(
      true,
    );
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
