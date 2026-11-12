import { afterAll, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { updateTweens } from '@flare-engine/animation';
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
import {
  animationBenches,
  animatorsRun,
  buildAnimators,
  buildTweens,
} from '../src/animation.bench.js';
import { ecsBenches } from '../src/ecs.bench.js';
import { type BenchStats, P99_MIN_SAMPLES, SMOKE_OVERRIDES } from '../src/harness.js';
import { runHeapProbe } from '../src/heap-probe.js';
import {
  buildState,
  frame,
  integrationBenches,
  outOfBoundsCount as integrationOutOfBounds,
} from '../src/integration.bench.js';
import { buildVec2State, mathBenches, vec2Run } from '../src/math.bench.js';
import { particlesBenches } from '../src/particles.bench.js';
import { buildSearchState, pathfindingBenches, searchRun } from '../src/pathfinding.bench.js';
import {
  buildWorld,
  physicsBenches,
  outOfBoundsCount as physicsOutOfBounds,
  stepAndMove,
} from '../src/physics.bench.js';
import {
  buildController,
  buildEnabledState,
  buildPassRun,
  buildPassState,
  enabledRun,
  postfxBenches,
} from '../src/postfx.bench.js';
import { renderBenches } from '../src/render.bench.js';
import {
  buildRenderSystemState,
  renderSystemBenches,
  renderSystemRun,
} from '../src/render-system.bench.js';
import { srcDir } from '../src/results.js';
import {
  EXPECTED_HEAP_SCENARIOS,
  EXPECTED_SCENARIOS,
  EXPECTED_SUITE_TITLES,
  findContractViolations,
} from '../src/scenario-contract.js';
import { buildDrawState, drawRun, tilemapBenches } from '../src/tilemap.bench.js';

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
  Animation: () => animationBenches(SMOKE_OVERRIDES),
  PostFx: () => postfxBenches(SMOKE_OVERRIDES),
  Tilemap: () => tilemapBenches(SMOKE_OVERRIDES),
  Pathfinding: () => pathfindingBenches(SMOKE_OVERRIDES),
  Math: () => mathBenches(SMOKE_OVERRIDES),
  RenderSystem: () => renderSystemBenches(SMOKE_OVERRIDES),
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

  // The animation, postfx and tilemap rows each claim a population that stays
  // live for the whole capture. If one drained — a tween completing, a timed
  // effect expiring — later samples would time an emptier frame than earlier ones.
  test('tweens never complete and animators keep playing across many frames', () => {
    const mgr = buildTweens(200);
    for (let i = 0; i < 600; i++) updateTweens(mgr, 1 / 60);
    expect(mgr.tweens).toHaveLength(200);
    expect(mgr.tweens.some((tw) => tw.done)).toBe(false);

    const animators = buildAnimators(200);
    for (let i = 0; i < 600; i++) animatorsRun(animators);
    expect(animators.every((a) => a.currentAnimation !== null && !a.finished)).toBe(true);
  });

  test('the postfx controller keeps its flash and timed effects live', () => {
    const controller = buildController();
    for (let i = 0; i < 600; i++) controller.update(1 / 60);
    const flash = controller.chain.get('grayscale-flash')?.uniforms;
    expect(flash?.kind === 'grayscale-flash' && flash.intensity > 0.99).toBe(true);
    for (const id of ['chromatic-aberration', 'god-rays', 'weather-clouds', 'crt']) {
      expect(controller.chain.get(id)?.enabled).toBe(true);
    }
  });

  test('chain iteration and buildPass see the five enabled effects, with every shader cached', () => {
    const enabled = buildEnabledState();
    enabledRun(enabled);
    expect(enabled.visited).toBe(5);

    const pass = buildPassState();
    const compiled = pass.stub.counters.runtimeEffectMake;
    for (let i = 0; i < 100; i++) buildPassRun(pass);
    expect(pass.passes).toBe(5);
    expect(compiled).toBe(5);
    expect(pass.stub.counters.runtimeEffectMake).toBe(compiled);
  });

  test('tilemap drawInto queues the same culled set every frame from a warm pool', () => {
    const state = buildDrawState();
    drawRun(state);
    const first = state.queued;
    const allocs = state.batch.allocCount;
    for (let i = 0; i < 100; i++) {
      drawRun(state);
      expect(state.queued).toBe(first);
    }
    // 51 x 38 visible ground cells, plus the decor drawn over a quarter of them.
    expect(first).toBeGreaterThan(51 * 38);
    expect(first).toBeLessThan(51 * 38 * 1.5);
    expect(state.batch.allocCount).toBe(allocs);
    expect(state.batch.count).toBe(0);
  });

  test('the render system queues every sprite each frame from a warm pool', () => {
    const state = buildRenderSystemState({ name: 'smoke', count: 300, zLayers: 3, innerIters: 1 });
    renderSystemRun(state);
    const allocs = state.batch.allocCount;
    for (let i = 0; i < 100; i++) {
      renderSystemRun(state);
      expect(state.queued).toBe(300);
    }
    expect(state.batch.allocCount).toBe(allocs);
    expect(state.batch.count).toBe(0);
  });

  test('vec2 outputs are identical frame to frame', () => {
    const state = buildVec2State(64);
    vec2Run(state);
    const snapshot = JSON.stringify([state.desired, state.steer, state.next, state.side]);
    for (let i = 0; i < 10; i++) vec2Run(state);
    expect(JSON.stringify([state.desired, state.steer, state.next, state.side])).toBe(snapshot);
  });
});

describe('pathfinding fixtures', () => {
  // With no walls the two searches agree on the optimal diagonal. On the maze
  // they may not: JPS squeezes past a wall corner and A* refuses to (the
  // documented corner-cutting split in packages/pathfinding/README.md), so JPS
  // can only match or undercut A*. Either way the maze must force a far longer
  // route than the open diagonal, or the two rows are not measuring two ends of
  // the cost range.
  test('both searches route corner to corner on both layouts', () => {
    const cost = (algorithm: 'astar' | 'jps', layout: 'open' | 'maze'): number => {
      const state = buildSearchState(algorithm, layout);
      searchRun(state);
      expect(state.last).not.toBeNull();
      return state.last?.cost ?? Number.NaN;
    };
    const open = cost('astar', 'open');
    expect(open).toBeCloseTo(127 * Math.SQRT2, 6);
    expect(cost('jps', 'open')).toBeCloseTo(open, 6);

    const astarMaze = cost('astar', 'maze');
    const jpsMaze = cost('jps', 'maze');
    expect(astarMaze).toBeGreaterThan(open * 4);
    expect(jpsMaze).toBeGreaterThan(open * 4);
    expect(jpsMaze).toBeLessThanOrEqual(astarMaze);
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
