/**
 * E7 — render-dashboard.ts behavioral tests.
 *
 * Verifies Markdown output shape, empty-state placeholder, group headings,
 * regression status column values, and table structure.
 */

import { describe, expect, test } from 'bun:test';
import type { RegressionResult } from '../scripts/perf/regression-check';
import {
  groupByDeviceScenario,
  renderDashboard,
  renderTable,
} from '../scripts/perf/render-dashboard';

function makeResult(
  device: string,
  scenario: string,
  metric: string,
  currentP95: number,
  baselineMedian: number,
  regressed: boolean,
): RegressionResult {
  const ratio = baselineMedian > 0 ? currentP95 / baselineMedian : 1;
  return {
    device,
    scenario,
    metric,
    currentP95,
    baselineMedian,
    threshold: 1.05,
    ratio,
    regressed,
  };
}

// ---------------------------------------------------------------------------
// renderDashboard — empty state
// ---------------------------------------------------------------------------

describe('renderDashboard — empty state', () => {
  test('returns the exact placeholder when results array is empty', () => {
    const output = renderDashboard([], new Date('2026-05-24T00:00:00Z'));
    expect(output.trim()).toBe('_No data yet — run E8 baseline capture._');
  });
});

// ---------------------------------------------------------------------------
// renderDashboard — non-empty
// ---------------------------------------------------------------------------

describe('renderDashboard — non-empty', () => {
  const results = [
    makeResult('pixel-6a', 'boot', 'frameMs', 12, 12, false),
    makeResult('pixel-6a', 'boot', 'shadowRebuildMs', 5, 5, false),
    makeResult('galaxy-a54', 'boss-smok-full', 'frameMs', 22, 20, true),
  ];
  const output = renderDashboard(results, new Date('2026-05-24T00:00:00Z'));

  test('contains a heading for each device/scenario group', () => {
    expect(output).toContain('## pixel-6a / boot');
    expect(output).toContain('## galaxy-a54 / boss-smok-full');
  });

  test('marks regressed rows with REGRESSION', () => {
    expect(output).toContain('REGRESSION');
  });

  test('marks non-regressed rows with ok', () => {
    expect(output).toContain('ok');
  });
});

// ---------------------------------------------------------------------------
// groupByDeviceScenario
// ---------------------------------------------------------------------------

describe('groupByDeviceScenario', () => {
  test('groups results by device/scenario key', () => {
    const results = [
      makeResult('pixel-6a', 'boot', 'frameMs', 10, 10, false),
      makeResult('pixel-6a', 'boot', 'shadowMs', 5, 5, false),
      makeResult('galaxy-a54', 'boot', 'frameMs', 14, 14, false),
    ];
    const groups = groupByDeviceScenario(results);
    expect(groups.size).toBe(2);
    expect(groups.get('pixel-6a / boot')).toHaveLength(2);
    expect(groups.get('galaxy-a54 / boot')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// renderTable
// ---------------------------------------------------------------------------

describe('renderTable', () => {
  test('includes header and separator rows', () => {
    const table = renderTable([makeResult('pixel-6a', 'boot', 'frameMs', 10, 10, false)]);
    expect(table).toContain('| metric |');
    expect(table).toContain('|-----');
  });
});
