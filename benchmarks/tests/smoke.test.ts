import { describe, expect, test } from 'bun:test';
import { ecsBenches } from '../src/ecs.bench.js';
import { type BenchStats, SMOKE_OVERRIDES } from '../src/harness.js';
import { integrationBenches, integrationHeapDelta } from '../src/integration.bench.js';
import { particlesBenches } from '../src/particles.bench.js';
import { physicsBenches } from '../src/physics.bench.js';
import { renderBenches } from '../src/render.bench.js';
import {
  EXPECTED_HEAP_SCENARIOS,
  EXPECTED_SCENARIOS,
  EXPECTED_SUITE_TITLES,
  findContractViolations,
} from '../src/scenario-contract.js';

/**
 * Executes every benchmark body at smoke sample counts. Nothing here asserts a
 * timing: the point is that the suites still *run* against the current engine
 * and still produce the scenario names the published doc indexes by. Without
 * this the bench stack only ever ran when a human typed the command, which is
 * how a 3x regression sat unnoticed for three months.
 */

const SUITES: Record<string, () => BenchStats[]> = {
  ECS: () => ecsBenches(SMOKE_OVERRIDES),
  Physics: () => physicsBenches(SMOKE_OVERRIDES),
  Particles: () => particlesBenches(SMOKE_OVERRIDES),
  Render: () => renderBenches(SMOKE_OVERRIDES),
  Integration: () => integrationBenches(SMOKE_OVERRIDES),
};

describe('microbench smoke', () => {
  for (const title of EXPECTED_SUITE_TITLES) {
    test(`${title} runs and matches the frozen scenario list`, () => {
      const run = SUITES[title] as () => BenchStats[];
      const stats = run();

      expect(stats.map((s) => s.name)).toEqual([...(EXPECTED_SCENARIOS[title] ?? [])]);

      for (const s of stats) {
        expect(Number.isFinite(s.nsPerOp.median)).toBe(true);
        expect(Number.isFinite(s.nsPerOp.mean)).toBe(true);
        expect(Number.isFinite(s.nsPerOp.p99)).toBe(true);
        // Proves the overrides actually reached runBench — without this a
        // silently-ignored override would make the smoke run take 2 minutes.
        expect(s.samples).toBe(SMOKE_OVERRIDES.samples as number);
        expect(s.innerIters).toBe(SMOKE_OVERRIDES.innerIters as number);
      }
    });
  }

  test('heap delta section runs and matches the frozen scenario list', () => {
    const heap = integrationHeapDelta(2, 1);
    expect(heap.map((h) => h.name)).toEqual([...EXPECTED_HEAP_SCENARIOS]);
    for (const h of heap) {
      expect(Number.isFinite(h.deltaBytes)).toBe(true);
      expect(h.iterations).toBe(2);
    }
  });

  test('the live suites satisfy the contract the published doc is validated against', () => {
    const suites = EXPECTED_SUITE_TITLES.map((title) => ({
      title,
      results: (SUITES[title] as () => BenchStats[])().map((s) => ({ scenario: s.name })),
    }));
    expect(findContractViolations(suites)).toEqual([]);
  });
});

describe('contract validation', () => {
  const good = [
    { title: 'ECS', results: (EXPECTED_SCENARIOS.ECS ?? []).map((scenario) => ({ scenario })) },
  ];

  test('a renamed scenario is reported, not tolerated', () => {
    const renamed = [
      { title: 'ECS', results: [{ scenario: 'ecs.tick  1000 entities (Pos+Vel)' }] },
    ];
    const problems = findContractViolations(renamed);
    expect(problems.some((p) => p.includes('missing scenario: ecs.step  1000'))).toBe(true);
    expect(problems.some((p) => p.includes('unexpected scenario: ecs.tick'))).toBe(true);
    expect(problems.some((p) => p.includes('headline prefix "ecs.step  1000"'))).toBe(true);
  });

  test('a dropped suite is reported', () => {
    expect(findContractViolations(good).some((p) => p === 'missing suite: Render')).toBe(true);
  });

  test('a duplicated headline scenario is reported — an ambiguous headline is not publishable', () => {
    const dupe = [
      {
        title: 'ECS',
        results: [
          ...(EXPECTED_SCENARIOS.ECS ?? []).map((scenario) => ({ scenario })),
          { scenario: 'ecs.step  1000 entities (Pos+Vel)' },
        ],
      },
    ];
    expect(
      findContractViolations(dupe).some((p) =>
        p.includes('matches 2 scenarios, expected exactly 1'),
      ),
    ).toBe(true);
  });
});
