import type { MicrobenchHeap, MicrobenchReport, MicrobenchResult } from './results.js';
import { findContractViolations } from './scenario-contract.js';

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
  field: 'runtime' | 'platform' | 'cpuModel' | 'gitSha',
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
 * machine, different commit, a dirty tree, drifted scenario names) is refused
 * rather than silently averaged, because the result is committed as the
 * comparison reference every later run is judged against.
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

  for (const run of runs) {
    if (run.gitDirty === true) {
      problems.push(
        `run ${run.generated} was captured from a dirty tree — commit first so the baseline names the code it measured`,
      );
    }
    for (const violation of findContractViolations(run.suites)) {
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

  const suites = first.suites.map((suite, suiteIdx) => ({
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
      return {
        scenario: result.scenario,
        medianNs,
        meanNs: median(across.map((x) => x.meanNs)),
        minNs: median(across.map((x) => x.minNs)),
        p99Ns: median(across.map((x) => x.p99Ns)),
        // Recomputed rather than aggregated: a median-of-opsPerSec would not be
        // the reciprocal of the median-of-medians, and the row would contradict
        // itself.
        opsPerSec: medianNs > 0 ? 1e9 / medianNs : 0,
        samples: result.samples,
        innerIters: result.innerIters,
        bandMinNs: Math.min(...medians),
        bandMaxNs: Math.max(...medians),
      };
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
      bandMinBytesPerFrame: Math.min(...perFrame),
      bandMaxBytesPerFrame: Math.max(...perFrame),
    };
  });

  const captures = runs.map((r) => r.generated).sort();
  const newest = captures[captures.length - 1] as string;

  return {
    ok: true,
    report: {
      generated: newest,
      runtime: first.runtime,
      platform: first.platform,
      cpuModel: first.cpuModel,
      cpuCount: first.cpuCount,
      totalMemMB: first.totalMemMB,
      gitSha: first.gitSha,
      gitDirty: false,
      runs: runs.length,
      aggregatedFrom: captures,
      suites,
      heap,
    },
  };
}
