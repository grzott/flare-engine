import { getXformCounters, resetXformCounters } from '@flare-engine/render';
import { applyBenchDevFlag, BENCH_DEV_FLAG } from './dev-flag.js';
import { buildState, frame } from './integration.bench.js';
import { buildFlushState, FLUSH_SCENARIOS, flushRun } from './render.bench.js';
import { cachedFactoryCalls, perFrameFactoryCalls, type SkiaStub } from './skia-stub.js';

/**
 * Exact allocation accounting for the draw path.
 *
 * This is the honest half of the zero-allocation claim. A heap delta cannot
 * carry it: under JSC `process.memoryUsage().heapUsed` reports block footprint,
 * so it moves with GC scheduling and says nothing about whether a given frame
 * allocated. Integer counters can: the sprite-command pool reports every miss,
 * `Pool.created` reports every factory call behind the particle pool, and the
 * injected Skia stub reports every object the frame renderer asked Skia to
 * build. In steady state all three must be exactly zero, and the transform
 * counters must match a number predicted from the scenario rather than merely
 * being "low".
 *
 * What these counters provably cannot see: allocations inside the engine that
 * pass through neither pool nor injected factory — the cached slices at
 * frame-renderer.ts:386-398 are the known example. The isolated heap probe
 * stays as the whole-heap backstop for exactly that gap.
 *
 * One honest caveat about `particleFactoryCalls`: `ParticlePool` prewarms to
 * capacity and the emitter only ever uses the capped `tryAcquire()`, so in
 * THESE scenarios the counter cannot move — the row asserts an invariant rather
 * than catching drift. It is kept because the invariant is worth pinning (an
 * emitter that switched to uncapped `acquire()`, or a pool that stopped
 * prewarming, would move it), and `alloc.test.ts` proves the counter is live by
 * driving a Pool past its prewarmed set directly.
 */

export type AllocRow = {
  scenario: string;
  frames: number;
  /** Sprite-command pool misses across the measured frames. Steady state: 0. */
  poolMisses: number;
  /** `Pool.created` growth behind the particle pool. Steady state: 0. */
  particleFactoryCalls: number;
  /** Skia factory calls the renderer caches forever. Steady state: 0. */
  cachedFactoryCalls: number;
  /** Skia calls the renderer repeats every frame by design, per frame. */
  perFrameFactoryCalls: number;
  drawAtlasPerFrame: number;
  drawImageRectPerFrame: number;
  drawRectPerFrame: number;
  xformUnrotatedPerFrame: number;
  xformRotatedPerFrame: number;
  expected: {
    perFrameFactoryCalls: number;
    drawAtlasPerFrame: number;
    drawImageRectPerFrame: number;
    drawRectPerFrame: number;
    xformUnrotatedPerFrame: number;
    xformRotatedPerFrame: number;
  };
  /** Empty when the row satisfies the gate. */
  problems: string[];
};

const FLUSH_SCENARIO_BY_NAME = new Map(FLUSH_SCENARIOS.map((entry) => [entry.name, entry.s]));

const FRAMES = 20;
const WARMUP_FRAMES = 5;

function withDev<T>(fn: () => T): T {
  applyBenchDevFlag();
  const g = globalThis as Record<string, unknown>;
  const previous = g.__DEV__;
  g.__DEV__ = true;
  try {
    return fn();
  } finally {
    // Restore to a boolean, never to `undefined`: deleting the global puts
    // every later guard evaluation in this process back on JSC's ~270 ns
    // unresolvable-identifier path (dev-flag.ts).
    g.__DEV__ = typeof previous === 'boolean' ? previous : BENCH_DEV_FLAG;
  }
}

type Measured = {
  stub: SkiaStub;
  poolMisses: number;
  particleFactoryCalls: number;
};

function finish(
  scenario: string,
  m: Measured,
  expected: AllocRow['expected'],
  frames: number,
): AllocRow {
  const c = m.stub.counters;
  const xf = getXformCounters();
  const row: AllocRow = {
    scenario,
    frames,
    poolMisses: m.poolMisses,
    particleFactoryCalls: m.particleFactoryCalls,
    cachedFactoryCalls: cachedFactoryCalls(c),
    perFrameFactoryCalls: perFrameFactoryCalls(c) / frames,
    drawAtlasPerFrame: c.drawAtlas / frames,
    drawImageRectPerFrame: c.drawImageRect / frames,
    drawRectPerFrame: c.drawRect / frames,
    xformUnrotatedPerFrame: xf.unrotated / frames,
    xformRotatedPerFrame: xf.rotated / frames,
    expected,
    problems: [],
  };

  const check = (label: string, actual: number, want: number): void => {
    if (actual !== want) row.problems.push(`${label}: ${actual}, expected ${want}`);
  };
  check('pool misses', row.poolMisses, 0);
  check('particle factory calls', row.particleFactoryCalls, 0);
  check('cached Skia factory calls', row.cachedFactoryCalls, 0);
  check('Skia calls per frame', row.perFrameFactoryCalls, expected.perFrameFactoryCalls);
  check('drawAtlas per frame', row.drawAtlasPerFrame, expected.drawAtlasPerFrame);
  check('drawImageRect per frame', row.drawImageRectPerFrame, expected.drawImageRectPerFrame);
  check('drawRect per frame', row.drawRectPerFrame, expected.drawRectPerFrame);
  check('unrotated xforms per frame', row.xformUnrotatedPerFrame, expected.xformUnrotatedPerFrame);
  check('rotated xforms per frame', row.xformRotatedPerFrame, expected.xformRotatedPerFrame);

  return row;
}

/**
 * Named flush scenarios measured by the gate, keyed to the entry in
 * FLUSH_SCENARIOS they mirror, plus the exact counts each must produce.
 */
const FLUSH_GATES: readonly {
  scenario: string;
  flushName: string;
  expected: AllocRow['expected'];
}[] = [
  {
    scenario: 'alloc.render  1000 sprites / 1 atlas',
    flushName: 'render.flush   1000 sprites / 1 atlas',
    expected: {
      perFrameFactoryCalls: 0,
      drawAtlasPerFrame: 1,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 1000,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / 100% rotated',
    flushName: 'render.flush   1000 sprites / 100% rotated',
    expected: {
      perFrameFactoryCalls: 0,
      drawAtlasPerFrame: 1,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 0,
      xformRotatedPerFrame: 1000,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / 8 atlas interleaved',
    flushName: 'render.flush   1000 sprites / 8 atlas interleaved',
    // Run length 1: every adjacent sprite breaks the batch, so the run count
    // equals the command count. This is the row that proves the multi-atlas
    // scenarios measure what their names claim.
    expected: {
      perFrameFactoryCalls: 0,
      drawAtlasPerFrame: 1000,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 1000,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / 8 atlas clustered',
    flushName: 'render.flush   1000 sprites / 8 atlas clustered',
    expected: {
      perFrameFactoryCalls: 0,
      drawAtlasPerFrame: 8,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 1000,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / 4 alpha runs',
    flushName: 'render.flush   1000 sprites / 4 alpha runs',
    expected: {
      perFrameFactoryCalls: 0,
      drawAtlasPerFrame: 4,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 1000,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / tint effect',
    flushName: 'render.flush   1000 sprites / tint effect',
    // One MakeBlend per drawAtlas, forever — the colour filter is rebuilt every
    // call by design (frame-renderer.ts:434-439).
    expected: {
      perFrameFactoryCalls: 1,
      drawAtlasPerFrame: 1,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 1000,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / outline effect',
    flushName: 'render.flush   1000 sprites / outline effect',
    // 8 offset passes + 1 main pass: 9 drawAtlas calls and 9 transform writes
    // per command. One MakeBlend for the whole run, not one per pass.
    expected: {
      perFrameFactoryCalls: 1,
      drawAtlasPerFrame: 9,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 9000,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / stretch path',
    flushName: 'render.flush   1000 sprites / stretch path',
    // drawImageRect per command, and no transform build at all.
    expected: {
      perFrameFactoryCalls: 0,
      drawAtlasPerFrame: 0,
      drawImageRectPerFrame: 1000,
      drawRectPerFrame: 0,
      xformUnrotatedPerFrame: 0,
      xformRotatedPerFrame: 0,
    },
  },
  {
    scenario: 'alloc.render  1000 sprites / zone-bg path',
    flushName: 'render.flush   1000 sprites / zone-bg path',
    // drawRect per command plus one makeShader per drawAtlas call.
    expected: {
      perFrameFactoryCalls: 1,
      drawAtlasPerFrame: 0,
      drawImageRectPerFrame: 0,
      drawRectPerFrame: 1000,
      xformUnrotatedPerFrame: 0,
      xformRotatedPerFrame: 0,
    },
  },
];

export function allocRows(): AllocRow[] {
  return withDev(() => {
    const rows: AllocRow[] = [];

    for (const gate of FLUSH_GATES) {
      const scenario = FLUSH_SCENARIO_BY_NAME.get(gate.flushName);
      if (scenario === undefined) {
        throw new Error(
          `[alloc gate] no flush scenario named "${gate.flushName}" — the gate and the bench matrix have drifted apart.`,
        );
      }
      const state = buildFlushState(scenario, true);
      for (let i = 0; i < WARMUP_FRAMES; i++) flushRun(state);
      const missesBefore = state.batch.allocCount;
      state.stub.reset();
      resetXformCounters();
      for (let i = 0; i < FRAMES; i++) flushRun(state);
      rows.push(
        finish(
          gate.scenario,
          {
            stub: state.stub,
            poolMisses: state.batch.allocCount - missesBefore,
            particleFactoryCalls: 0,
          },
          gate.expected,
          FRAMES,
        ),
      );
    }

    for (const entities of [500, 1000]) {
      const state = buildState(entities, true);
      for (let i = 0; i < WARMUP_FRAMES; i++) frame(state);
      const missesBefore = state.batch.allocCount;
      const createdBefore = state.emitter.pool.created;
      state.stub.reset();
      resetXformCounters();
      for (let i = 0; i < FRAMES; i++) frame(state);
      rows.push(
        finish(
          `alloc.frame   ${entities.toString().padStart(4)} entities + 300p`,
          {
            stub: state.stub,
            poolMisses: state.batch.allocCount - missesBefore,
            particleFactoryCalls: state.emitter.pool.created - createdBefore,
          },
          {
            perFrameFactoryCalls: 0,
            drawAtlasPerFrame: 1,
            drawImageRectPerFrame: 0,
            drawRectPerFrame: 0,
            xformUnrotatedPerFrame: entities,
            xformRotatedPerFrame: 0,
          },
          FRAMES,
        ),
      );
    }

    return rows;
  });
}
