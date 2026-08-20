import { judgeAffinity } from './affinity.js';
import type { AllocRow } from './alloc.js';
import { MAX_FOREIGN_LOAD_PERCENT, MAX_RUN_DEVIATION_PERCENT, MIN_DEVIANT_RUNS } from './load.js';
import { judgePowerScheme } from './power.js';
import type {
  MicrobenchHeap,
  MicrobenchReport,
  MicrobenchResult,
  MicrobenchSuite,
} from './results.js';
import { SCHEMA_VERSION } from './results.js';
import { findAllocViolations, findContractViolations } from './scenario-contract.js';

export type AggregateOutcome =
  | { ok: true; report: MicrobenchReport }
  | { ok: false; problems: string[] };

/**
 * Nearest-rank median, matching harness.percentile's convention so an
 * aggregated row cannot disagree with a single-run row about what "median"
 * means. Even counts take the lower middle rather than interpolating — an
 * interpolated value is not a measurement any run actually produced.
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.5 * sorted.length) - 1));
  return sorted[idx] as number;
}

function sharedField(
  runs: readonly MicrobenchReport[],
  field: 'runtime' | 'platform' | 'cpuModel' | 'gitSha' | 'devFlag',
  problems: string[],
): void {
  const seen = [...new Set(runs.map((r) => r[field] ?? 'unrecorded'))];
  if (seen.length > 1) {
    problems.push(`runs disagree on ${field}: ${seen.join(' | ')} — these are not one measurement`);
  }
}

/**
 * Folds N independent capture runs into one baseline: per-scenario
 * median-of-medians plus the run-to-run spread of those medians.
 *
 * Per-scenario matters. The median *run* for one scenario is rarely the median
 * run for another, so promoting a single whole run would publish a different
 * scenario's outlier as fact.
 *
 * Fail-closed: anything that makes the runs not-one-measurement (different
 * machine, different commit, a dirty tree, drifted scenario names, a schema
 * change mid-window) is refused rather than silently averaged, because the
 * result is committed as the comparison reference every later run is judged
 * against.
 */
export function aggregateRuns(runs: readonly MicrobenchReport[]): AggregateOutcome {
  const problems: string[] = [];

  if (runs.length === 0) {
    return { ok: false, problems: ['no runs to aggregate — capture some with `bun run bench`'] };
  }

  sharedField(runs, 'runtime', problems);
  sharedField(runs, 'platform', problems);
  sharedField(runs, 'cpuModel', problems);
  sharedField(runs, 'gitSha', problems);
  sharedField(runs, 'devFlag', problems);

  for (const run of runs) {
    if (run.devFlag === 'undeclared') {
      problems.push(
        `run ${run.generated} was captured with __DEV__ undeclared — every guarded counter site cost ~270 ns per evaluation, so its render rows measure a JSC deoptimisation rather than the engine`,
      );
    }
  }

  for (const run of runs) {
    const version = run.schemaVersion ?? 1;
    if (version !== SCHEMA_VERSION) {
      problems.push(
        `run ${run.generated} was captured under result schema v${version}, this build writes v${SCHEMA_VERSION} — re-capture instead of folding the two together`,
      );
    }
    if (run.gitDirty === true) {
      problems.push(
        `run ${run.generated} was captured from a dirty tree — commit first so the baseline names the code it measured`,
      );
    }
    for (const violation of findContractViolations(run.suites)) {
      problems.push(`run ${run.generated}: ${violation}`);
    }
    for (const violation of findAllocViolations(run.alloc ?? [])) {
      problems.push(`run ${run.generated}: ${violation}`);
    }
  }

  const first = runs[0] as MicrobenchReport;
  const shape = (r: MicrobenchReport): string =>
    r.suites.map((s) => `${s.title}:${s.results.map((x) => x.scenario).join(',')}`).join('|');
  const firstShape = shape(first);
  for (const run of runs.slice(1)) {
    if (shape(run) !== firstShape) {
      problems.push(`run ${run.generated} has a different scenario set than ${first.generated}`);
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  const suites: MicrobenchSuite[] = first.suites.map((suite, suiteIdx) => ({
    title: suite.title,
    results: suite.results.map((result, resultIdx): MicrobenchResult => {
      const across = runs.map(
        (r) =>
          (r.suites[suiteIdx] as { results: MicrobenchResult[] }).results[
            resultIdx
          ] as MicrobenchResult,
      );
      const medians = across.map((x) => x.medianNs);
      const medianNs = median(medians);
      const out: MicrobenchResult = {
        scenario: result.scenario,
        medianNs,
        meanNs: median(across.map((x) => x.meanNs)),
        minNs: median(across.map((x) => x.minNs)),
        maxNs: median(across.map((x) => x.maxNs)),
        // Recomputed rather than aggregated: a median-of-opsPerSec would not be
        // the reciprocal of the median-of-medians, and the row would contradict
        // itself.
        opsPerSec: medianNs > 0 ? 1e9 / medianNs : 0,
        samples: result.samples,
        innerIters: result.innerIters,
        bandMinNs: Math.min(...medians),
        bandMaxNs: Math.max(...medians),
      };
      // Only fold a p99 when every run has one. A window that mixes rows with
      // and without would otherwise median an array containing undefined, which
      // sorts as NaN and publishes an arbitrary member as fact.
      const p99s = across.map((x) => x.p99Ns);
      if (p99s.every((v): v is number => typeof v === 'number')) out.p99Ns = median(p99s);
      return out;
    }),
  }));

  const heap = first.heap.map((entry, heapIdx): MicrobenchHeap => {
    const across = runs.map((r) => r.heap[heapIdx] as MicrobenchHeap);
    const perFrame = across.map((x) => x.bytesPerFrame);
    return {
      name: entry.name,
      iterations: entry.iterations,
      deltaBytes: median(across.map((x) => x.deltaBytes)),
      bytesPerFrame: median(perFrame),
      warmupFrames: median(across.map((x) => x.warmupFrames ?? 0)),
      // One non-converged run taints the row: the number would then be a
      // plateau reading folded together with a heap still climbing toward it.
      converged: across.every((x) => x.converged === true),
      plateauHeapMB: median(across.map((x) => x.plateauHeapMB ?? 0)),
      blocks: entry.blocks,
      blockFrames: entry.blockFrames,
      resolutionBytesPerFrame: median(across.map((x) => x.resolutionBytesPerFrame ?? 0)),
      bandMinBytesPerFrame: Math.min(...perFrame),
      bandMaxBytesPerFrame: Math.max(...perFrame),
    };
  });

  // A row that never reached its plateau is the artifact this instrument exists
  // to retire (§10 B26) — it must not be folded into a baseline and published as
  // a steady-state number.
  const unconverged = heap.filter((h) => !h.converged).map((h) => h.name);
  if (unconverged.length > 0) {
    return {
      ok: false,
      problems: unconverged.map(
        (name) =>
          `heap row "${name}" never reached its allocation plateau in at least one run — its delta is the climb toward the plateau, not a steady-state measurement. Re-run the probe with a larger warm-up budget.`,
      ),
    };
  }

  // Exact integers, so they are reconciled rather than averaged: runs that
  // disagree mean the draw path is not deterministic, which is a finding, not
  // noise to smooth over.
  const allocOutcome = reconcileAlloc(runs);
  if (!allocOutcome.ok) return { ok: false, problems: allocOutcome.problems };

  // B29: a capture taken on a contended machine measures the neighbours.
  //
  // Two independent tests, because neither alone is sufficient. Foreign CPU
  // load names the CAUSE but cannot see a resident process that perturbs caches
  // without burning cycles; run-to-run spread catches the SYMPTOM whatever the
  // cause, but a window can be internally tight and still sit at the wrong
  // level. The incident that produced this guard had one capture fail each test.
  const environment: string[] = [];
  for (const run of runs) {
    const verdict = judgePowerScheme(
      run.powerSchemeGuid === undefined
        ? null
        : { guid: run.powerSchemeGuid, label: run.powerSchemeLabel ?? '' },
    );
    if (verdict.kind === 'refuse') {
      problems.push(`run captured under a refused power plan — ${verdict.message.split('\n')[0]}`);
    }
  }

  for (const run of runs) {
    // Absent on pre-2026-08-20 captures and on hosts that cannot report a mask; both read as
    // "unknown", which is judged as ok rather than refused. Only a recorded unpinned mask on a
    // recorded hybrid host is refused, because only that combination was measured.
    if (
      run.affinityMask === undefined ||
      run.affinityCpus === undefined ||
      run.hostPhysicalCores === undefined ||
      run.hostLogicalCpus === undefined
    ) {
      continue;
    }
    const verdict = judgeAffinity({
      mask: run.affinityMask,
      selected: run.affinityCpus,
      physical: run.hostPhysicalCores,
      logical: run.hostLogicalCpus,
    });
    if (verdict.kind === 'refuse') {
      problems.push(`run captured without CPU pinning — ${verdict.message.split('\n')[0]}`);
    }
  }

  for (const run of runs) {
    if (run.foreignLoadPercent === undefined) {
      environment.push(
        `run ${run.generated} does not record machine load — it predates the B29 guard, and "unrecorded" is not "quiet". Re-capture rather than publish a window that cannot be shown to be clean.`,
      );
    } else if (run.foreignLoadPercent > MAX_FOREIGN_LOAD_PERCENT) {
      environment.push(
        `run ${run.generated} was captured while ${run.foreignLoadPercent.toFixed(1)}% of the machine was busy with other processes (ceiling ${MAX_FOREIGN_LOAD_PERCENT}%)
      — it measures the neighbours as much as the engine.`,
      );
    }
  }
  if (environment.length > 0) return { ok: false, problems: environment };

  // Counted against the FOLDED median rather than the min-max band: the
  // published statistic is a median, so one outlier run is already absorbed and
  // refusing on it would fail healthy data (load.ts). Two deviant runs mean the
  // median itself is straddling two states.
  const unstable: string[] = [];
  for (const [suiteIdx, suite] of suites.entries()) {
    for (const [resultIdx, r] of suite.results.entries()) {
      if (r.medianNs <= 0) continue;
      const perRun = runs.map(
        (run) =>
          (run.suites[suiteIdx]?.results[resultIdx] as MicrobenchResult | undefined)?.medianNs,
      );
      const deviant = perRun.filter(
        (ns) =>
          ns !== undefined &&
          (Math.abs(ns - r.medianNs) / r.medianNs) * 100 > MAX_RUN_DEVIATION_PERCENT,
      );
      if (deviant.length >= MIN_DEVIANT_RUNS) {
        const worst = Math.max(
          ...deviant.map((ns) => (Math.abs((ns as number) - r.medianNs) / r.medianNs) * 100),
        );
        unstable.push(
          `"${r.scenario}": ${deviant.length} of ${runs.length} runs sit more than ${MAX_RUN_DEVIATION_PERCENT}% from the folded median of ${(r.medianNs / 1000).toFixed(1)} µs (worst ${worst.toFixed(0)}%) — the median is straddling two states of the machine, not describing one.`,
        );
      }
    }
  }
  if (unstable.length > 0) return { ok: false, problems: unstable };

  const captures = runs.map((r) => r.generated).sort();
  const newest = captures[captures.length - 1] as string;

  return {
    ok: true,
    report: {
      schemaVersion: SCHEMA_VERSION,
      generated: newest,
      runtime: first.runtime,
      platform: first.platform,
      devFlag: first.devFlag,
      cpuModel: first.cpuModel,
      cpuCount: first.cpuCount,
      totalMemMB: first.totalMemMB,
      gitSha: first.gitSha,
      gitDirty: false,
      foreignLoadPercent: Math.max(...runs.map((r) => r.foreignLoadPercent ?? 0)),
      runs: runs.length,
      aggregatedFrom: captures,
      suites,
      heap,
      alloc: allocOutcome.alloc,
    },
  };
}

type AllocOutcome = { ok: true; alloc: AllocRow[] } | { ok: false; problems: string[] };

function reconcileAlloc(runs: readonly MicrobenchReport[]): AllocOutcome {
  const first = (runs[0] as MicrobenchReport).alloc ?? [];
  const problems: string[] = [];

  for (const row of first) {
    if (row.problems.length > 0) {
      problems.push(`alloc gate failed for ${row.scenario}: ${row.problems.join('; ')}`);
    }
  }

  for (const run of runs.slice(1)) {
    const rows = run.alloc ?? [];
    for (const [i, row] of rows.entries()) {
      const reference = first[i];
      if (reference === undefined) continue;
      if (JSON.stringify(row) !== JSON.stringify(reference)) {
        problems.push(
          `alloc counters for ${row.scenario} differ between runs — the draw path is not deterministic: ${JSON.stringify(reference)} vs ${JSON.stringify(row)}`,
        );
      }
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, alloc: first };
}
