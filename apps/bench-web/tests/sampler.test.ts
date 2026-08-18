import { describe, expect, it } from 'bun:test';
import { type SamplerDeps, sampleBatches } from '../src/sampler.js';

/**
 * A deterministic stand-in for the browser: `now()` reads a clock that only `work()` advances, and
 * `schedule()` runs the callback immediately with a timestamp that advances by one vsync interval.
 *
 * This is what makes the quantization regression below provable rather than plausible — the fake
 * frame clock ticks in exact 16.667 ms steps, the same thing the real rAF timestamp does, so a
 * sampler that derives cost from frame deltas produces the artifact here too.
 */
const VSYNC_MS = 1000 / 60;

function makeDeps(costPerOpMs: number): {
  readonly deps: SamplerDeps;
  readonly work: () => void;
  readonly opsRun: () => number;
} {
  let clock = 0;
  let frameTs = 0;
  let ops = 0;
  return {
    deps: {
      now: () => clock,
      schedule: (cb) => {
        frameTs += VSYNC_MS;
        queueMicrotask(() => {
          cb(frameTs);
        });
      },
    },
    work: () => {
      ops++;
      clock += costPerOpMs;
    },
    opsRun: () => ops,
  };
}

const OPTS = { minSamples: 5, warmupMs: 0, targetBatchMs: 20, label: 'test' };

describe('sampleBatches — known-answer recovery', () => {
  it('recovers a synthetic per-op cost that is far below one vsync interval', async () => {
    const { deps, work } = makeDeps(0.004);
    const samples = await sampleBatches(work, OPTS, deps);

    expect(samples).toHaveLength(5);
    for (const s of samples) {
      // The oracle: work costs exactly 0.004 ms per call, so that is what must come back —
      // 0.004 ms is 1/4167th of a vsync interval, precisely the regime the old sampler could
      // not represent at all.
      expect(s.perOpMs).toBeCloseTo(0.004, 6);
    }
  });

  it('recovers a per-op cost larger than one vsync interval', async () => {
    const { deps, work } = makeDeps(25);
    const samples = await sampleBatches(work, OPTS, deps);
    for (const s of samples) expect(s.perOpMs).toBeCloseTo(25, 6);
  });
});

describe('sampleBatches — vsync quantization regression', () => {
  it('does not produce values quantized to the frame clock', async () => {
    const costPerOpMs = 0.004;
    const { deps, work } = makeDeps(costPerOpMs);
    const samples = await sampleBatches(work, OPTS, deps);

    for (const s of samples) {
      // The defect this replaces: cost derived from frame-to-frame deltas can only ever be an
      // integer multiple of VSYNC_MS divided by the ops in the batch. Assert the measurement is
      // NOT such a multiple — with a true cost of 0.004 ms and ~5000 ops per batch, a quantized
      // reading would land on a multiple of 16.667/ops and miss the real value entirely.
      const quantum = VSYNC_MS / s.ops;
      const k = s.perOpMs / quantum;
      expect(Math.abs(k - Math.round(k))).toBeGreaterThan(0.01);
    }
  });
});

describe('sampleBatches — batch sizing', () => {
  it('fills each batch to the target window before recording it', async () => {
    const { deps, work } = makeDeps(0.004);
    const samples = await sampleBatches(work, OPTS, deps);
    for (const s of samples) {
      expect(s.elapsedMs).toBeGreaterThanOrEqual(OPTS.targetBatchMs);
      expect(s.ops).toBeGreaterThan(1);
    }
  });

  it('runs a single op per batch when one op already exceeds the window', async () => {
    const { deps, work } = makeDeps(50);
    const samples = await sampleBatches(work, OPTS, deps);
    for (const s of samples) expect(s.ops).toBe(1);
  });
});

describe('sampleBatches — fail-closed', () => {
  it('refuses a batch whose clock never advances instead of reporting zero cost', async () => {
    const { deps, work } = makeDeps(0);
    await expect(sampleBatches(work, OPTS, deps)).rejects.toThrow(/could not be measured/i);
  });

  it('names the scenario in the refusal', async () => {
    const { deps, work } = makeDeps(0);
    await expect(
      sampleBatches(work, { ...OPTS, label: 'render.flush 1000' }, deps),
    ).rejects.toThrow(/render\.flush 1000/);
  });
});

describe('sampleBatches — warm-up', () => {
  it('discards warm-up work and records only post-warm-up batches', async () => {
    const { deps, work, opsRun } = makeDeps(0.004);
    const samples = await sampleBatches(work, { ...OPTS, warmupMs: 100 }, deps);

    expect(samples).toHaveLength(5);
    // Warm-up ran real work that must not appear in any sample: total ops executed exceeds the
    // ops accounted for by the recorded batches.
    const accounted = samples.reduce((n, s) => n + s.ops, 0);
    expect(opsRun()).toBeGreaterThan(accounted);
  });
});
