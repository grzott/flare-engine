import { applyBenchDevFlag } from './dev-flag.js';
import { buildState, frame, outOfBoundsCount } from './integration.bench.js';

/**
 * Isolated heap probe for one integration scenario.
 *
 * The previous instrument measured the heap in-process, after ~90 s of other
 * suites, with a 30-frame warm-up and a single forced GC. That is not a
 * retention measurement: under JSC `heapUsed` reports MarkedSpace *footprint*,
 * and a 30-frame warm-up snapshots the heap while it is still climbing toward
 * the plateau its allocation rate implies. The climb was then published as
 * "+15.7 / +33.4 / +31.1 KB per frame retained growth". Re-measured with a
 * long warm-up the same scenarios read -0.2 to +2.5 KB/frame, and every
 * structural invariant (`SpriteBatch.allocCount`, `ParticlePool.created`,
 * broadphase size) is flat — there was no retention to find.
 *
 * So this probe:
 *   1. runs in its own process, one scenario per process — no cross-suite
 *      garbage in the baseline;
 *   2. warms up until consecutive block deltas agree that the heap has reached
 *      its plateau, under a wall-clock budget rather than a frame count (a
 *      2000-entity frame costs ~50x a 500-entity one);
 *   3. reports the per-block deltas it actually measured, so a non-converged
 *      run is visible instead of averaged away;
 *   4. reports the structural counters alongside, because those — not
 *      `heapUsed` — are what can carry a zero-allocation claim.
 */

export type HeapProbeOptions = {
  entities: number;
  /** Hard ceiling on warm-up wall time. The exit condition is convergence. */
  warmupBudgetMs?: number;
  /** Hard ceiling on warm-up blocks, so a never-settling heap still terminates. */
  maxWarmupBlocks?: number;
  /** Frames per measured block. */
  blockFrames?: number;
  /** Number of measured blocks after warm-up. */
  blocks?: number;
  /** Forced GC rounds around each measured boundary. */
  gcRounds?: number;
};

export type HeapProbeResult = {
  name: string;
  entities: number;
  warmupFrames: number;
  converged: boolean;
  iterations: number;
  blocks: number;
  blockFrames: number;
  deltaBytes: number;
  bytesPerFrame: number;
  blockBytesPerFrame: number[];
  /** Noise floor of this configuration, in the same unit as bytesPerFrame. */
  resolutionBytesPerFrame: number;
  plateauHeapMB: number;
  spriteBatchAllocs: number;
  particlesCreated: number;
  outOfBounds: number;
};

const DEFAULTS = {
  // Generous, because it is a ceiling and not a target: the loop exits as soon
  // as two consecutive blocks are quiet. The previous 2.5 s budget was smaller
  // than ONE warm-up block at 2000 entities (~2.5 s), so that scenario could
  // never converge and published its warm-up climb — the exact artifact this
  // probe exists to retire.
  warmupBudgetMs: 60_000,
  maxWarmupBlocks: 24,
  blocks: 3,
  gcRounds: 8,
} as const;

/**
 * Block size is scaled by entity count so every scenario measures a comparable
 * amount of allocation work rather than a comparable number of frames: a
 * 2000-entity frame costs ~15x a 500-entity one, so a fixed 200-frame block
 * made the largest scenario dominate the whole capture. The floor keeps the
 * per-frame resolution meaningful — a block small enough that GC noise divides
 * into few frames cannot support a "0 B/frame" reading.
 */
function blockFramesFor(entities: number): number {
  return Math.min(400, Math.max(50, Math.round(100_000 / entities)));
}

/**
 * Observed spread of `heapUsed` across forced GCs at rest, in bytes. Divided by
 * the block length it gives the per-frame resolution of a row: a delta below it
 * means "under this instrument's resolution", never "exactly zero". Expressing
 * it per block rather than per frame is what makes a 50-frame block at 2000
 * entities honest instead of unreachable.
 */
const GC_NOISE_BYTES = 65_536;

function resolutionFor(blockFrames: number): number {
  return Math.max(512, GC_NOISE_BYTES / blockFrames);
}

function gc(rounds: number): void {
  for (let i = 0; i < rounds; i++) Bun.gc(true);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.5 * sorted.length) - 1));
  return sorted[idx] as number;
}

export function runHeapProbe(opts: HeapProbeOptions): HeapProbeResult {
  // Same configuration as the timed suites — see dev-flag.ts.
  applyBenchDevFlag();
  const entities = opts.entities;
  const warmupBudgetMs = opts.warmupBudgetMs ?? DEFAULTS.warmupBudgetMs;
  const blockFrames = opts.blockFrames ?? blockFramesFor(entities);
  const blocks = opts.blocks ?? DEFAULTS.blocks;
  const gcRounds = opts.gcRounds ?? DEFAULTS.gcRounds;
  const maxWarmupBlocks = opts.maxWarmupBlocks ?? DEFAULTS.maxWarmupBlocks;
  const resolutionBytesPerFrame = resolutionFor(blockFrames);

  const state = buildState(entities);

  // Warm up to the plateau: run blocks until two consecutive block deltas are
  // both under the noise floor, or the budget runs out.
  const started = performance.now();
  let warmupFrames = 0;
  let warmupBlocks = 0;
  let quiet = 0;
  let converged = false;
  gc(2);
  let mark = process.memoryUsage().heapUsed;
  // Convergence is the exit condition; the budget and the block ceiling are
  // only backstops. At least one block always runs, whatever the limits: the
  // first frame fills the sprite-command pool, and counting that fill as
  // measured allocation would report a one-time pool fill as steady state.
  do {
    for (let i = 0; i < blockFrames; i++) frame(state);
    warmupFrames += blockFrames;
    warmupBlocks++;
    gc(2);
    const now = process.memoryUsage().heapUsed;
    const perFrame = (now - mark) / blockFrames;
    mark = now;
    if (Math.abs(perFrame) < resolutionBytesPerFrame) {
      quiet++;
      if (quiet >= 2) {
        converged = true;
        break;
      }
    } else {
      quiet = 0;
    }
  } while (warmupBlocks < maxWarmupBlocks && performance.now() - started < warmupBudgetMs);

  const allocsBefore = state.batch.allocCount;
  const createdBefore = state.emitter.pool.created;

  gc(gcRounds);
  const before = process.memoryUsage().heapUsed;
  const blockBytesPerFrame: number[] = [];
  let prev = before;
  for (let b = 0; b < blocks; b++) {
    for (let i = 0; i < blockFrames; i++) frame(state);
    gc(gcRounds);
    const now = process.memoryUsage().heapUsed;
    blockBytesPerFrame.push((now - prev) / blockFrames);
    prev = now;
  }
  const after = prev;

  const iterations = blocks * blockFrames;

  return {
    name: `integration.heap  ${entities.toString().padStart(4)} entities`,
    entities,
    warmupFrames,
    converged,
    iterations,
    blocks,
    blockFrames,
    resolutionBytesPerFrame,
    deltaBytes: after - before,
    // Median of the block deltas, not the end-to-end delta: one block that
    // straddles a heap-growth step would otherwise set the published number.
    bytesPerFrame: median(blockBytesPerFrame),
    blockBytesPerFrame,
    plateauHeapMB: +(after / 1024 / 1024).toFixed(2),
    spriteBatchAllocs: state.batch.allocCount - allocsBefore,
    particlesCreated: state.emitter.pool.created - createdBefore,
    outOfBounds: outOfBoundsCount(state),
  };
}

function numericFlag(argv: string[], flag: string, fallback: number): number {
  const idx = argv.indexOf(flag);
  if (idx === -1) return fallback;
  const parsed = Number.parseInt(argv[idx + 1] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// CLI form — one scenario per process, one JSON line on stdout, no file writes
// of any kind. `index.ts` spawns this; nothing else may.
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const entities = numericFlag(argv, '--entities', 1000);
  const result = runHeapProbe({
    entities,
    warmupBudgetMs: numericFlag(argv, '--warmup-ms', DEFAULTS.warmupBudgetMs),
    maxWarmupBlocks: numericFlag(argv, '--max-warmup-blocks', DEFAULTS.maxWarmupBlocks),
    blockFrames: numericFlag(argv, '--block-frames', blockFramesFor(entities)),
    blocks: numericFlag(argv, '--blocks', DEFAULTS.blocks),
    gcRounds: numericFlag(argv, '--gc-rounds', DEFAULTS.gcRounds),
  });
  console.log(JSON.stringify(result));
}
