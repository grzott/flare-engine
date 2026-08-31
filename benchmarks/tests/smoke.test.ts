import { afterAll, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import {
  _resetComponentIds,
  defineComponent,
  Follower,
  Lifetime,
  Parent,
  Position,
  Rotation,
  Scale,
  Velocity,
} from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { ecsBenches } from '../src/ecs.bench.js';
import { type BenchStats, P99_MIN_SAMPLES, SMOKE_OVERRIDES } from '../src/harness.js';
import { runHeapProbe } from '../src/heap-probe.js';
import {
  buildState,
  frame,
  integrationBenches,
  outOfBoundsCount as integrationOutOfBounds,
} from '../src/integration.bench.js';
import { particlesBenches } from '../src/particles.bench.js';
import {
  buildWorld,
  physicsBenches,
  outOfBoundsCount as physicsOutOfBounds,
  stepAndMove,
} from '../src/physics.bench.js';
import { renderBenches } from '../src/render.bench.js';
import { srcDir } from '../src/results.js';
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

// ecs.bench.ts and integration.bench.ts call _resetComponentIds() inside their
// buildWorld/buildState helpers, which leaves nextComponentId=0 after all bench
// tests complete.  Any module that defines components at module scope and loads
// in the same Bun worker after this file would get IDs starting at 0, colliding
// with built-in components (Position=0, Velocity=1, etc.).
// Re-advance the counter past every existing module-scope component definition.
afterAll(() => {
  const maxId = Math.max(
    Position.id,
    Velocity.id,
    Rotation.id,
    Scale.id,
    Parent.id,
    Lifetime.id,
    Follower.id,
    Sprite.id,
  );
  _resetComponentIds();
  for (let i = 0; i <= maxId; i++) {
    defineComponent(`__bench_realign_${i}`);
  }
});

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
        expect(Number.isFinite(s.nsPerOp.max)).toBe(true);
        // p99 is withheld below the sample threshold rather than published as
        // the top sample under a percentile's name.
        expect(s.nsPerOp.p99).toBeUndefined();
        // Proves the overrides actually reached runBench — without this a
        // silently-ignored override would make the smoke run take 2 minutes.
        expect(s.samples).toBe(SMOKE_OVERRIDES.samples as number);
        expect(s.innerIters).toBe(SMOKE_OVERRIDES.innerIters as number);
        expect(s.warmupBatches).toBe(0);
      }
    });
  }

  test('a full-sample row does carry a p99', () => {
    const [row] = ecsBenches({ samples: P99_MIN_SAMPLES, innerIters: 1, warmupMs: 0 });
    expect(row?.samples).toBe(P99_MIN_SAMPLES);
    expect(Number.isFinite(row?.nsPerOp.p99)).toBe(true);
  });

  test('the live suites satisfy the contract the published doc is validated against', () => {
    const suites = EXPECTED_SUITE_TITLES.map((title) => ({
      title,
      results: (SUITES[title] as () => BenchStats[])().map((s) => ({ scenario: s.name })),
    }));
    expect(findContractViolations(suites)).toEqual([]);
  });
});

describe('workload stationarity', () => {
  // B16: these workloads used to integrate off the field while being measured,
  // so a "dense" scenario decayed into a sparse one mid-run and the median
  // depended on the sampler configuration. The bound is now machine-checked.
  test('integration entities stay inside the play field across many frames', () => {
    const state = buildState(200);
    for (let i = 0; i < 600; i++) frame(state);
    expect(integrationOutOfBounds(state)).toBe(0);
  });

  test('physics colliders stay inside the play field across many frames', () => {
    const dense = buildWorld(100, 'dense');
    for (let i = 0; i < 600; i++) stepAndMove(dense);
    expect(physicsOutOfBounds(dense)).toBe(0);

    const sparse = buildWorld(100, 'sparse');
    for (let i = 0; i < 600; i++) stepAndMove(sparse);
    expect(physicsOutOfBounds(sparse)).toBe(0);
  });
});

describe('isolated heap probe', () => {
  test('the probe body runs and reports the frozen scenario names', () => {
    const names = [500, 1000, 2000].map(
      (entities) =>
        runHeapProbe({
          entities,
          warmupBudgetMs: 0,
          blockFrames: 2,
          blocks: 2,
          gcRounds: 1,
        }).name,
    );
    expect(names).toEqual([...EXPECTED_HEAP_SCENARIOS]);
  });

  test('the probe reports structural invariants, not just a heap number', () => {
    const r = runHeapProbe({ entities: 200, warmupBudgetMs: 0, blockFrames: 4, blocks: 2 });
    expect(Number.isFinite(r.deltaBytes)).toBe(true);
    expect(r.blockBytesPerFrame).toHaveLength(2);
    expect(r.iterations).toBe(8);
    // The claim the heap number cannot make on its own.
    expect(r.spriteBatchAllocs).toBe(0);
    expect(r.particlesCreated).toBe(0);
    expect(r.outOfBounds).toBe(0);
  });

  test('the CLI form runs in a real subprocess and emits one JSON line', () => {
    const proc = Bun.spawnSync(
      [
        'bun',
        'run',
        resolve(srcDir(), 'heap-probe.ts'),
        '--entities',
        '100',
        '--warmup-ms',
        '1',
        '--block-frames',
        '2',
        '--blocks',
        '2',
        '--gc-rounds',
        '1',
      ],
      { cwd: resolve(srcDir(), '..'), stdout: 'pipe', stderr: 'pipe' },
    );
    expect(proc.exitCode).toBe(0);
    const line = proc.stdout.toString().trim().split('\n').pop() ?? '';
    const parsed = JSON.parse(line) as { name: string; outOfBounds: number };
    expect(parsed.name).toBe('integration.heap   100 entities');
    expect(parsed.outOfBounds).toBe(0);
  }, 30_000);
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
