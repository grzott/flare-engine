/**
 * regression-check.ts — compare latest bench run against rolling 7-day median.
 *
 * Algorithm:
 *   For each device×scenario×metric tuple in the current run:
 *   1. Collect all rows from bench-results.ndjson within the last 7 days.
 *   2. Compute median of p95 values for that tuple (rolling baseline).
 *   3. Flag a regression if current_p95 > baseline_median * threshold.
 *
 * Threshold defaults to 1.05 (5%) but may be overridden per device or scenario
 * via .perf-baseline.json at the repo root.
 *
 * Usage (CLI):
 *   bun scripts/perf/regression-check.ts \
 *     --input docs/perf/bench-results.ndjson \
 *     [--baseline .perf-baseline.json] \
 *     [--window-days 7]
 *
 * Named exports are the public API consumed by the test suite and by
 * render-dashboard.ts.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEFAULT_THRESHOLD = 1.05;
export const DEFAULT_WINDOW_DAYS = 7;

export interface BenchRow {
  device: string;
  scenario: string;
  metric: string;
  p95: number;
  capturedAt: string;
}

export interface BaselineOverride {
  threshold?: number;
  perDevice?: Record<string, number>;
  perScenario?: Record<string, number>;
}

export interface RegressionResult {
  device: string;
  scenario: string;
  metric: string;
  currentP95: number;
  baselineMedian: number;
  threshold: number;
  ratio: number;
  regressed: boolean;
}

export function parseNdjson(raw: string): BenchRow[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BenchRow);
}

export function windowRows(rows: BenchRow[], windowDays: number, referenceDate: Date): BenchRow[] {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - windowDays);
  return rows.filter((r) => new Date(r.capturedAt) >= cutoff);
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function resolveThreshold(
  device: string,
  scenario: string,
  override: BaselineOverride,
): number {
  if (override.perDevice?.[device] !== undefined) return override.perDevice[device] as number;
  if (override.perScenario?.[scenario] !== undefined)
    return override.perScenario[scenario] as number;
  return override.threshold ?? DEFAULT_THRESHOLD;
}

export function checkRegressions(
  rows: BenchRow[],
  windowDays: number,
  override: BaselineOverride,
  referenceDate: Date,
): RegressionResult[] {
  const latest = latestRows(rows);
  const results: RegressionResult[] = [];

  for (const current of latest) {
    const key = `${current.device}::${current.scenario}::${current.metric}`;
    // Historical baseline: rows strictly older than the current row, within the window.
    const priorRows = rows.filter((r) => {
      if (`${r.device}::${r.scenario}::${r.metric}` !== key) return false;
      if (r.capturedAt >= current.capturedAt) return false;
      const cutoff = new Date(referenceDate);
      cutoff.setDate(cutoff.getDate() - windowDays);
      return new Date(r.capturedAt) >= cutoff;
    });
    const baselineMedian =
      priorRows.length > 0 ? computeMedian(priorRows.map((r) => r.p95)) : current.p95;
    const threshold = resolveThreshold(current.device, current.scenario, override);
    const ratio = baselineMedian > 0 ? current.p95 / baselineMedian : 1;
    results.push({
      device: current.device,
      scenario: current.scenario,
      metric: current.metric,
      currentP95: current.p95,
      baselineMedian,
      threshold,
      ratio,
      regressed: ratio > threshold,
    });
  }

  return results;
}

function latestRows(rows: BenchRow[]): BenchRow[] {
  const byKey = new Map<string, BenchRow>();
  for (const row of rows) {
    const key = `${row.device}::${row.scenario}::${row.metric}`;
    const existing = byKey.get(key);
    if (existing === undefined || row.capturedAt > existing.capturedAt) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export function loadBaselineOverride(path: string): BaselineOverride {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as BaselineOverride;
  } catch {
    return {};
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let inputPath = 'docs/perf/bench-results.ndjson';
  let baselinePath = '.perf-baseline.json';
  let windowDays = DEFAULT_WINDOW_DAYS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[i + 1] as string;
      i++;
    } else if (args[i] === '--baseline' && args[i + 1]) {
      baselinePath = args[i + 1] as string;
      i++;
    } else if (args[i] === '--window-days' && args[i + 1]) {
      windowDays = Number(args[i + 1]);
      i++;
    }
  }

  const repoRoot = resolve(import.meta.dir, '../..');
  const raw = readFileSync(resolve(repoRoot, inputPath), 'utf8');
  const rows = parseNdjson(raw);
  const override = loadBaselineOverride(resolve(repoRoot, baselinePath));
  const results = checkRegressions(rows, windowDays, override, new Date());

  const regressions = results.filter((r) => r.regressed);
  if (regressions.length > 0) {
    console.error(`[regression-check] ${regressions.length} regression(s) detected:`);
    for (const r of regressions) {
      console.error(
        `  ${r.device}/${r.scenario}/${r.metric}: p95=${r.currentP95.toFixed(2)} baseline=${r.baselineMedian.toFixed(2)} ratio=${r.ratio.toFixed(3)} threshold=${r.threshold}`,
      );
    }
    process.exit(1);
  } else {
    console.log(`[regression-check] OK — ${results.length} metrics checked, 0 regressions`);
  }
}
