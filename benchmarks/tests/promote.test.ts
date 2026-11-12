import { describe, expect, test } from 'bun:test';
import type { AllocRow } from '../src/alloc.js';
import { SCENARIO_DEVIATION_OVERRIDES } from '../src/load.js';
import { aggregateRuns } from '../src/promote.js';
import { type MicrobenchReport, type MicrobenchResult, SCHEMA_VERSION } from '../src/results.js';
import {
  EXPECTED_ALLOC_SCENARIOS,
  EXPECTED_HEAP_SCENARIOS,
  EXPECTED_SCENARIOS,
  FAST_MODE_ANCHOR_NS,
  FAST_MODE_ANCHOR_SCENARIO,
  FAST_MODE_ANCHOR_TOLERANCE,
  HEADLINE_PREFIXES,
} from '../src/scenario-contract.js';

// Not exported from power.ts (private there too — see power.test.ts). Mirrored
// rather than imported: only the value, measured on this hardware, matters here.
const POWER_SAVER = 'a1841308-3541-4fab-bc81-f71556f20b4a';

/**
 * Builds a contract-satisfying report whose scenarios all report `medianNs`.
 * Every scenario in a run shares the value, so a run is identified by one
 * number and the aggregation math stays legible.
 *
 * The one exception is the fast-mode anchor row, which reports `anchorNs` and
 * defaults to the anchor itself. Several fixtures replay real windows of other
 * rows (16 µs, 12 ms); copied onto `ecs.step 1000` those would read as the
 * machine's slow mode, which is not what those tests are about.
 */
let captureSeq = 0;

function runAt(
  medianNs: number,
  overrides: Partial<MicrobenchReport> = {},
  anchorNs: number = FAST_MODE_ANCHOR_NS,
): MicrobenchReport {
  // Monotonic and distinct per fixture: a shared timestamp would make the
  // "dated by its newest capture" assertion pass no matter what promote picked.
  captureSeq += 1;
  const stamp = `2026-07-28T${String(captureSeq % 24).padStart(2, '0')}:00:00.000Z`;
  const result = (scenario: string): MicrobenchResult => {
    const ns = scenario === FAST_MODE_ANCHOR_SCENARIO ? anchorNs : medianNs;
    return {
      scenario,
      medianNs: ns,
      meanNs: ns,
      minNs: ns,
      maxNs: ns * 2,
      p99Ns: ns,
      opsPerSec: 1e9 / ns,
      samples: 100,
      innerIters: 100,
    };
  };
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
    foreignLoadPercent: 0.4,
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
    // Mean would be 102 (the 106 run drags it); the median is 101. Kept inside
    // the B29 stability ceiling on purpose: a fixture the gate would refuse in
    // production is not evidence about production.
    const outcome = aggregateRuns([runAt(99), runAt(101), runAt(106)].map((r) => r));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(firstResult(outcome.report).medianNs).toBe(101);
  });

  test('records the run-to-run spread as the band', () => {
    const outcome = aggregateRuns([runAt(99), runAt(101), runAt(106)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = firstResult(outcome.report);
    expect(r.bandMinNs).toBe(99);
    expect(r.bandMaxNs).toBe(106);
  });

  test('opsPerSec is recomputed from the aggregated median, not aggregated itself', () => {
    const outcome = aggregateRuns([runAt(99), runAt(101), runAt(106)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = firstResult(outcome.report);
    expect(r.opsPerSec).toBe(1e9 / r.medianNs);
  });

  test('carries run count and every source capture timestamp', () => {
    const outcome = aggregateRuns([runAt(99), runAt(101), runAt(103)]);
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
    const partial = runAt(101);
    for (const suite of partial.suites) {
      for (const r of suite.results) r.p99Ns = undefined;
    }
    const outcome = aggregateRuns([runAt(99), partial, runAt(103)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Medianing [number, undefined, number] silently publishes an arbitrary
    // member; the row must simply carry no p99 instead.
    expect(firstResult(outcome.report).p99Ns).toBeUndefined();
  });

  test('folds maxNs across runs', () => {
    // maxNs is the median of the runs' maxima; the fixture sets max = 2x median.
    const outcome = aggregateRuns([runAt(99), runAt(101), runAt(106)]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(firstResult(outcome.report).maxNs).toBe(202);
  });

  test('carries the exact-counter section through promotion', () => {
    const outcome = aggregateRuns([runAt(99), runAt(101)]);
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

  test('refuses a run captured while the machine was busy with other work', () => {
    // B29: the incident this guards was a 23% shift in integration.frame with
    // no code change, caught only because a human read the control row.
    const outcome = aggregateRuns([runAt(100), runAt(100, { foreignLoadPercent: 41 })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.join(' ')).toContain('busy with other processes');
  });

  test('refuses a run that does not record machine load at all', () => {
    // "Unrecorded" is not "quiet" — a pre-B29 capture cannot be shown clean.
    const outcome = aggregateRuns([runAt(100), runAt(100, { foreignLoadPercent: undefined })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.join(' ')).toContain('does not record machine load');
  });

  test('refuses a window captured under the Power-Saver power plan', () => {
    // Both runs share the same scheme so sharedField('powerSchemeGuid') stays
    // silent — this isolates the judgePowerScheme refusal at the B29 guard.
    const powerSaver = { powerSchemeGuid: POWER_SAVER, powerSchemeLabel: 'Power saver' };
    const outcome = aggregateRuns([runAt(100, powerSaver), runAt(100, powerSaver)]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('Power saver'))).toBe(true);
  });

  test('refuses a window captured unpinned on a hybrid 24-core/32-thread host', () => {
    // selected (32) >= logical (32): the capture used every logical processor,
    // which judgeAffinity refuses on a detected-hybrid host.
    const unpinned = {
      affinityMask: '0xffffffff',
      affinityCpus: 32,
      hostPhysicalCores: 24,
      hostLogicalCpus: 32,
    };
    const outcome = aggregateRuns([runAt(100, unpinned), runAt(100, unpinned)]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((p) => p.includes('CPU pinning'))).toBe(true);
  });

  test('refuses a window where several runs straddle different machine states', () => {
    // The REAL medians B29's first bad capture recorded for
    // `integration.frame 1000`, in nanoseconds, taken from history.ndjson.
    // Pinning the actual event rather than a made-up spread is the difference
    // between a threshold that is calibrated and one that is asserted.
    const incident = [10_540_000, 11_970_000, 9_910_000, 12_780_000, 9_160_000];
    const outcome = aggregateRuns(incident.map((ns) => runAt(ns)));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.join(' ')).toContain('straddling two states of the machine');
  });

  test('accepts a window with ONE outlier run — the median already absorbs it', () => {
    // The real `particles.update 1000 emit+integrate` window that the first,
    // band-based version of this check wrongly refused: four runs at ~16.5 µs
    // and one at 20.2. Thirteen of fifteen recorded runs of that row sit inside
    // 16.4-16.75, so the row is sound and the gate was not.
    const window = [16_420, 20_200, 16_510, 16_460, 16_490];
    expect(aggregateRuns(window.map((ns) => runAt(ns))).ok).toBe(true);
  });

  test('accepts the clean capture that replaced it', () => {
    // Same row, same machine, quiet: 12.55-12.88 ms. The guard has to let this
    // through, or the only way past it is to delete it.
    const clean = [12_550_000, 12_560_000, 12_630_000, 12_820_000, 12_880_000];
    expect(aggregateRuns(clean.map((ns) => runAt(ns))).ok).toBe(true);
  });

  test('accepts a window whose spread is ordinary run-to-run noise', () => {
    // Guards the threshold from the other side: a gate that fires on a good
    // day gets raised until it never fires at all.
    expect(aggregateRuns([runAt(100), runAt(103)]).ok).toBe(true);
  });

  test('publishes the worst load reading in the window, not the best', () => {
    const outcome = aggregateRuns([
      runAt(100, { foreignLoadPercent: 0.2 }),
      runAt(100, { foreignLoadPercent: 3.1 }),
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.foreignLoadPercent).toBe(3.1);
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

describe('per-scenario deviation overrides', () => {
  /** A window where only `scenario` moves; every other row is held constant and stable. */
  const window = (scenario: string, perRunUs: readonly number[]): MicrobenchReport[] =>
    perRunUs.map((us) => {
      const run = runAt(1000);
      for (const suite of run.suites) {
        for (const result of suite.results) {
          if (result.scenario === scenario) result.medianNs = us * 1000;
        }
      }
      return run;
    });

  const OVERRIDDEN = 'particles.update  2000 integrate-only';
  // A sibling in the same package that is NOT overridden — the emit sweep keeps the strict limit.
  const PLAIN = 'particles.update  1000 emit+integrate';

  test('accepts an overridden row inside its own wider limit', () => {
    // 6.8 / 8.5 us is this row's real bimodality: 25% apart, so it is deviant under the global
    // 10% limit and inside its own 30% one.
    const outcome = aggregateRuns(window(OVERRIDDEN, [6.8, 8.5, 6.8, 8.5, 6.8]));
    expect(outcome.ok).toBe(true);
  });

  test('still refuses an overridden row once it exceeds even the wider limit', () => {
    const outcome = aggregateRuns(window(OVERRIDDEN, [6.8, 12, 6.8, 12, 6.8]));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.some((problem) => problem.includes('wider, limit'))).toBe(true);
  });

  test('holds a row without an override to the global limit', () => {
    // The identical spread on a neighbouring row is still refused — the override is one row, not
    // a relaxation of the guard.
    const outcome = aggregateRuns(window(PLAIN, [6.8, 8.5, 6.8, 8.5, 6.8]));
    expect(outcome.ok).toBe(false);
  });

  test('every override names a scenario the contract expects, so a typo cannot silently apply to nothing', () => {
    const known = new Set(Object.values(EXPECTED_SCENARIOS).flat());
    for (const scenario of SCENARIO_DEVIATION_OVERRIDES.keys()) {
      expect(known.has(scenario)).toBe(true);
    }
  });

  // The recorded 2026-11-12 windows these two overrides were added for, per-run medians in µs.
  test.each([
    ['animation.updateTweens    1000 tweens, 4 easings', [2.35, 2.42, 3.18, 3.15, 2.91]],
    ['animation.updateAnimator  1000 animators, looping', [6.43, 6.22, 7.36, 7.27, 6.31]],
  ])('folds the refused 2026-11-12 window of %s under its override', (scenario, perRunUs) => {
    expect(aggregateRuns(window(scenario, perRunUs)).ok).toBe(true);
    expect(aggregateRuns(window(PLAIN, perRunUs)).ok).toBe(false);
  });
});

describe('fast-mode anchor (PERF-14b)', () => {
  /** A window where only the anchor row moves; every other row is held constant and stable. */
  const anchorWindow = (perRunNs: readonly number[]): MicrobenchReport[] =>
    perRunNs.map((ns) => runAt(1000, {}, ns));

  const ceilingNs = FAST_MODE_ANCHOR_NS * FAST_MODE_ANCHOR_TOLERANCE;

  test('anchors a row the scenario contract requires, so a rename cannot silently skip it', () => {
    expect(EXPECTED_SCENARIOS.ECS).toContain(FAST_MODE_ANCHOR_SCENARIO);
    expect(FAST_MODE_ANCHOR_SCENARIO.startsWith(HEADLINE_PREFIXES.ecs)).toBe(true);
  });

  test('accepts five runs inside the fast mode', () => {
    // The published fold's own run-to-run band at 0b7ea242ae53: 9.30-9.79 µs.
    const outcome = aggregateRuns(anchorWindow([9_298, 9_455, 9_512, 9_620, 9_787]));
    expect(outcome.ok).toBe(true);
  });

  test('refuses five runs that agree with each other inside the slow mode, naming the anchor', () => {
    // The slow mode PERF-14b recorded: 16.4-16.5 µs, tight enough to pass the deviation guard.
    const window = anchorWindow([16_400, 16_450, 16_480, 16_500, 16_520]);
    const outcome = aggregateRuns(window);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems).toHaveLength(1);
    const message = outcome.problems[0] as string;
    expect(message).toContain(`"${FAST_MODE_ANCHOR_SCENARIO}"`);
    expect(message).toContain('FAST_MODE_ANCHOR_NS');
    expect(message).toContain('anchor 9.46 µs');
    expect(message).toContain('×1.3');
    expect(message).toContain('ceiling 12.29 µs');
    for (const [i, run] of window.entries()) {
      expect(message).toContain(`run ${i + 1} of 5 (${run.generated})`);
    }
    expect(message).toContain('16.40 µs');
    expect(message).toContain('16.52 µs');
    expect(message).toContain('let it cool / re-run the five `bench:pinned` captures');
    expect(message).toContain('in the same PR as the change that moved it');
  });

  test('refuses a 4-fast/1-slow window on the anchor, naming only the slow run', () => {
    // The deviation guard accepts this window by design (MIN_DEVIANT_RUNS = 2: one outlier is
    // absorbed by the median), so the anchor is the only guard that sees the slow run.
    const window = anchorWindow([9_400, 9_450, 16_450, 9_500, 9_550]);
    const outcome = aggregateRuns(window);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems).toHaveLength(1);
    const message = outcome.problems[0] as string;
    expect(message).toContain(
      `run 3 of 5 (${(window[2] as MicrobenchReport).generated}) at 16.45 µs`,
    );
    for (const i of [0, 1, 3, 4]) {
      expect(message).not.toContain((window[i] as MicrobenchReport).generated);
    }
    expect(message).not.toContain('straddling two states');
  });

  test('a 3-fast/2-slow straddle is still refused by the deviation guard, message unchanged', () => {
    const outcome = aggregateRuns(anchorWindow([9_500, 16_500, 9_500, 16_500, 9_500]));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems).toEqual([
      '"ecs.step  1000 entities (Pos+Vel)": 2 of 5 runs sit more than 10% from the folded median of 9.5 µs (worst 74%) — the median is straddling two states of the machine, not describing one.',
    ]);
  });

  test('treats a run exactly at the ceiling as fast mode, and one nanosecond above as slow', () => {
    expect(
      aggregateRuns(anchorWindow([ceilingNs, ceilingNs, ceilingNs, ceilingNs, ceilingNs])).ok,
    ).toBe(true);
    const above = ceilingNs + 1;
    expect(aggregateRuns(anchorWindow([above, above, above, above, above])).ok).toBe(false);
  });

  test('a window missing the anchor row is refused as a contract mismatch before the anchor runs', () => {
    const window = anchorWindow([9_455, 9_455, 9_455]);
    for (const run of window) {
      const ecs = run.suites.find((s) => s.title === 'ECS') as { results: MicrobenchResult[] };
      ecs.results = ecs.results.filter((r) => r.scenario !== FAST_MODE_ANCHOR_SCENARIO);
    }
    const outcome = aggregateRuns(window);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    for (const run of window) {
      expect(outcome.problems).toContain(
        `run ${run.generated}: missing scenario: ${FAST_MODE_ANCHOR_SCENARIO}`,
      );
    }
    expect(outcome.problems.join(' ')).not.toContain('fast-mode anchor');
  });
});
