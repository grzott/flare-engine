/**
 * render-dashboard.ts — generate docs/perf/REGRESSION.md from bench-results.ndjson.
 *
 * Produces a Markdown table grouped by device×scenario, with columns:
 *   metric | p95 | baseline (7-day median) | ratio | status
 *
 * Usage (CLI):
 *   bun scripts/perf/render-dashboard.ts \
 *     [--input docs/perf/bench-results.ndjson] \
 *     [--output docs/perf/REGRESSION.md] \
 *     [--baseline .perf-baseline.json] \
 *     [--window-days 7]
 *
 * Named exports consumed by the test suite.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_WINDOW_DAYS,
  type RegressionResult,
  checkRegressions,
  loadBaselineOverride,
  parseNdjson,
} from './regression-check';

export function groupByDeviceScenario(
  results: RegressionResult[],
): Map<string, RegressionResult[]> {
  const map = new Map<string, RegressionResult[]>();
  for (const r of results) {
    const key = `${r.device} / ${r.scenario}`;
    const existing = map.get(key);
    if (existing !== undefined) {
      existing.push(r);
    } else {
      map.set(key, [r]);
    }
  }
  return map;
}

export function renderTable(rows: RegressionResult[]): string {
  const header = '| metric | p95 | baseline (7d median) | ratio | status |';
  const sep = '|--------|-----|----------------------|-------|--------|';
  const lines = rows.map((r) => {
    const status = r.regressed ? 'REGRESSION' : 'ok';
    return `| ${r.metric} | ${r.currentP95.toFixed(2)} | ${r.baselineMedian.toFixed(2)} | ${r.ratio.toFixed(3)} | ${status} |`;
  });
  return [header, sep, ...lines].join('\n');
}

export function renderDashboard(results: RegressionResult[], generatedAt: Date): string {
  if (results.length === 0) {
    return '_No data yet — run E8 baseline capture._\n';
  }

  const groups = groupByDeviceScenario(results);
  const sections: string[] = [];

  sections.push('# Perf Regression Dashboard');
  sections.push(`\n_Generated: ${generatedAt.toISOString()}_\n`);

  const regressionCount = results.filter((r) => r.regressed).length;
  if (regressionCount > 0) {
    sections.push(`> **${regressionCount} regression(s) detected** — see tables below.\n`);
  } else {
    sections.push('> All metrics within threshold.\n');
  }

  for (const [groupKey, rows] of groups) {
    sections.push(`## ${groupKey}\n`);
    sections.push(renderTable(rows));
    sections.push('');
  }

  return sections.join('\n');
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let inputPath = 'docs/perf/bench-results.ndjson';
  let outputPath = 'docs/perf/REGRESSION.md';
  let baselinePath = '.perf-baseline.json';
  let windowDays = DEFAULT_WINDOW_DAYS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[i + 1] as string;
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1] as string;
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
  const md = renderDashboard(results, new Date());

  writeFileSync(resolve(repoRoot, outputPath), md, 'utf8');
  console.log(`[render-dashboard] written to ${outputPath}`);
}
