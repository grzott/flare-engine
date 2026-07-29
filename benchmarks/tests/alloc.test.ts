import { describe, expect, test } from 'bun:test';
import { Pool } from '@flare-engine/core';
import { createFrameRenderer } from '@flare-engine/render';
import { allocRows } from '../src/alloc.js';
import { buildFlushState, flushRun } from '../src/render.bench.js';
import { findAllocViolations } from '../src/scenario-contract.js';
import { createCountingSkiaStub, KNOWN_SURFACE_MEMBERS } from '../src/skia-stub.js';

/**
 * The allocation gate. Unlike the timing suites these assertions have no
 * variance to tolerate: each number is an integer the draw path must reproduce
 * exactly, so this file is a real gate rather than a smoke test — it runs in CI
 * on every PR through `turbo test`.
 */

describe('draw-path allocation counters', () => {
  const rows = allocRows();

  test('every scenario in the frozen contract is measured', () => {
    expect(findAllocViolations(rows)).toEqual([]);
  });

  for (const row of rows) {
    test(`${row.scenario} allocates nothing and draws exactly what it claims`, () => {
      // The message carries the diff, so a failure names the counter and both
      // numbers instead of just "expected [] to equal [...]".
      expect(row.problems).toEqual([]);
    });
  }

  test('the counters are actually armed — a wrong expectation fails', () => {
    // Guards the gate against itself: if __DEV__ never reached the engine, or
    // the stub silently counted nothing, every row above would pass with zeros.
    const measured = rows.find((r) => r.scenario === 'alloc.render  1000 sprites / 1 atlas');
    expect(measured?.xformUnrotatedPerFrame).toBe(1000);
    expect(measured?.drawAtlasPerFrame).toBe(1);
  });

  test('interleaved and clustered multi-atlas orders really differ', () => {
    const interleaved = rows.find((r) => r.scenario.includes('8 atlas interleaved'));
    const clustered = rows.find((r) => r.scenario.includes('8 atlas clustered'));
    expect(interleaved?.drawAtlasPerFrame).toBe(1000);
    expect(clustered?.drawAtlasPerFrame).toBe(8);
  });
});

describe('pool counters can actually move', () => {
  // The alloc rows assert `particleFactoryCalls === 0`, which holds by
  // construction there (ParticlePool prewarms to capacity and the emitter only
  // uses the capped tryAcquire). Without this test that assertion would be
  // indistinguishable from a counter that never counts anything.
  test('Pool.created grows the moment the pool is driven past its prewarmed set', () => {
    const pool = new Pool(() => ({ v: 0 }));
    expect(pool.created).toBe(0);
    const a = pool.acquire();
    const b = pool.acquire();
    expect(pool.created).toBe(2);
    pool.release(a);
    pool.release(b);
    pool.acquire();
    expect(pool.created).toBe(2);
  });
});

describe('counting Skia stub', () => {
  test('strict mode throws on a draw-surface member it does not know', () => {
    const stub = createCountingSkiaStub({ strict: true });
    const recorder = stub.module.PictureRecorder();
    const surface = recorder.beginRecording(
      stub.module.XYWHRect(0, 0, 10, 10),
    ) as unknown as Record<string, unknown>;
    expect(() => surface.drawCircle).toThrow(/unknown draw-surface member "drawCircle"/);
  });

  test('non-strict mode returns undefined for the same member', () => {
    const stub = createCountingSkiaStub();
    const recorder = stub.module.PictureRecorder();
    const surface = recorder.beginRecording(
      stub.module.XYWHRect(0, 0, 10, 10),
    ) as unknown as Record<string, unknown>;
    expect(surface.drawCircle).toBeUndefined();
  });

  test('the transform setters really write — a no-op stub would measure nothing', () => {
    const stub = createCountingSkiaStub();
    const xform = stub.module.RSXform(1, 0, 0, 0);
    xform.set(2, 3, 4, 5);
    expect([xform.scos, xform.ssin, xform.tx, xform.ty]).toEqual([2, 3, 4, 5]);
    const rect = stub.module.XYWHRect(0, 0, 0, 0);
    rect.setXYWH(1, 2, 3, 4);
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([1, 2, 3, 4]);
  });

  test('constructing a frame renderer costs exactly three factory calls', () => {
    const stub = createCountingSkiaStub();
    createFrameRenderer(stub.module);
    expect(stub.counters.paint).toBe(1);
    expect(stub.counters.pictureRecorder).toBe(1);
    expect(stub.counters.xywhRect).toBe(1);
    expect(stub.counters.rsxform).toBe(0);
  });

  test('the frozen member list matches the surface it guards', () => {
    // If these drift apart the strict guard either throws on a member the stub
    // implements, or (worse) waves through one it does not measure.
    const stub = createCountingSkiaStub();
    const surface = stub.module
      .PictureRecorder()
      .beginRecording(stub.module.XYWHRect(0, 0, 1, 1)) as unknown as Record<string, unknown>;
    expect([...KNOWN_SURFACE_MEMBERS].sort()).toEqual(Object.keys(surface).sort());
  });

  test('pool growth stops after the first frame at a given sprite count', () => {
    const state = buildFlushState({
      count: 64,
      textures: 1,
      order: 'clustered',
      rotatedFraction: 0,
      alphaRuns: 1,
      stretch: false,
    });
    flushRun(state);
    const afterFirst = state.stub.counters.xywhRect + state.stub.counters.rsxform;
    expect(afterFirst).toBeGreaterThan(0);
    state.stub.reset();
    for (let i = 0; i < 5; i++) flushRun(state);
    expect(state.stub.counters.xywhRect).toBe(0);
    expect(state.stub.counters.rsxform).toBe(0);
  });
});
