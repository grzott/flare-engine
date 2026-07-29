import {
  type AnySpriteEffect,
  createFrameRenderer,
  type Drawable,
  type FrameRenderer,
  outline,
  roofsCity,
  SpriteBatch,
  type SpriteDrawCommand,
  sortByDrawOrder,
  tint,
} from '@flare-engine/render';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { createCountingSkiaStub, makeStubImage, type SkiaStub } from './skia-stub.js';

const VIEW_W = 800;
const VIEW_H = 600;
const SPRITE = 16;

/**
 * Texture order within a batch. `interleaved` alternates textures per sprite,
 * which breaks the batch run on every command (run length 1) — the worst case,
 * and the only case the pre-2026-07 bench ever measured. `clustered` groups all
 * sprites of one texture together, which is what a z-sorted scene with a
 * handful of atlases actually produces and yields exactly one run per texture.
 */
export type TextureOrder = 'interleaved' | 'clustered';

type BatchImage = Parameters<SpriteBatch['drawRaw']>[0];

export type FlushScenario = {
  count: number;
  textures: number;
  order: TextureOrder;
  /** Fraction of commands with a non-zero rotation, in [0, 1]. */
  rotatedFraction: number;
  /** Number of distinct alpha values, laid out in equal contiguous blocks. */
  alphaRuns: number;
  effect?: AnySpriteEffect;
  stretch: boolean;
};

type FlushState = {
  batch: SpriteBatch;
  renderer: FrameRenderer;
  stub: SkiaStub;
  draw: (image: BatchImage, commands: SpriteDrawCommand[]) => void;
  images: BatchImage[];
  /** Per-command inputs, precomputed so the measured loop is engine work only. */
  imageOf: number[];
  xs: Float64Array;
  ys: Float64Array;
  rotations: Float64Array;
  alphas: Float64Array;
  count: number;
  effect: AnySpriteEffect | undefined;
  stretch: boolean;
};

const DEFAULT_SCENARIO: Omit<FlushScenario, 'count' | 'textures'> = {
  order: 'clustered',
  rotatedFraction: 0,
  alphaRuns: 1,
  stretch: false,
};

export function buildFlushState(scenario: FlushScenario, strict = false): FlushState {
  const session = createBenchSession({ seed: 0x50e7 });
  try {
    const { count, textures, order, rotatedFraction, alphaRuns, effect, stretch } = scenario;
    const stub = createCountingSkiaStub({ strict });
    const renderer = createFrameRenderer(stub.module);
    const images: BatchImage[] = [];
    for (let i = 0; i < textures; i++) images.push(makeStubImage(256, 256));

    const imageOf: number[] = new Array(count);
    const xs = new Float64Array(count);
    const ys = new Float64Array(count);
    const rotations = new Float64Array(count);
    const alphas = new Float64Array(count);
    const perTexture = Math.ceil(count / textures);
    const rotatedCount = Math.round(count * rotatedFraction);

    for (let i = 0; i < count; i++) {
      imageOf[i] =
        order === 'interleaved' ? i % textures : Math.min(textures - 1, Math.floor(i / perTexture));
      xs[i] = session.rng.float(0, VIEW_W - SPRITE);
      ys[i] = session.rng.float(0, VIEW_H - SPRITE);
      // Rotated commands are the FIRST `rotatedCount` of the run so the split is
      // exact rather than probabilistic — the allocation gate predicts the two
      // fillXforms branch counters from it.
      rotations[i] = i < rotatedCount ? 0.3 + (i % 7) * 0.11 : 0;
      alphas[i] = alphaRuns <= 1 ? 1 : 1 - Math.floor(i / Math.ceil(count / alphaRuns)) * 0.15;
    }

    const batch = new SpriteBatch();
    const draw = (image: BatchImage, commands: SpriteDrawCommand[]): void => {
      renderer.drawAtlas(image, commands);
    };

    return {
      batch,
      renderer,
      stub,
      draw,
      images,
      imageOf,
      xs,
      ys,
      rotations,
      alphas,
      count,
      effect,
      stretch,
    };
  } finally {
    session.end();
  }
}

export function flushRun(state: FlushState): void {
  const { batch, renderer, images, imageOf, xs, ys, rotations, alphas, count, effect, stretch } =
    state;
  renderer.beginFrame(VIEW_W, VIEW_H);
  for (let i = 0; i < count; i++) {
    batch.drawRaw(
      images[imageOf[i] as number] as BatchImage,
      0,
      0,
      SPRITE,
      SPRITE,
      xs[i] as number,
      ys[i] as number,
      SPRITE,
      SPRITE,
      effect,
      0,
      0,
      alphas[i] as number,
      rotations[i] as number,
      stretch,
    );
  }
  batch.flush(state.draw);
  renderer.endFrame();
}

type SortState = {
  items: { z: number }[];
  order: number[];
  jitter: number;
};

function buildSortState(n: number, jitter: number): SortState {
  const session = createBenchSession({ seed: 0x50e7 });
  try {
    const items: { z: number }[] = new Array(n);
    for (let i = 0; i < n; i++) items[i] = { z: i };
    // Swap indices are drawn once in setup, not per sample: drawing them inside
    // the measured region would time the RNG as well as the sort, and would make
    // the amount of disorder differ between samples.
    const order: number[] = new Array(jitter * 2);
    for (let k = 0; k < jitter * 2; k++) order[k] = session.rng.int(0, n - 1);
    return { items, order, jitter };
  } finally {
    session.end();
  }
}

function sortRun(state: SortState): void {
  const { items, order, jitter } = state;
  for (let k = 0; k < jitter; k++) {
    const i = order[k * 2] as number;
    const j = order[k * 2 + 1] as number;
    const tmp = items[i] as { z: number };
    items[i] = items[j] as { z: number };
    items[j] = tmp;
  }
  sortByDrawOrder<Drawable>(items);
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 } as const;
const SKY = { r: 0.2, g: 0.4, b: 0.8, a: 1 } as const;
const ROOF = { r: 0.3, g: 0.2, b: 0.25, a: 1 } as const;

/** The frozen flush matrix. Exported so the allocation gate drives the same states. */
export const FLUSH_SCENARIOS: readonly { name: string; innerIters: number; s: FlushScenario }[] = [
  // Sprite-count sweep, single atlas — the reference curve.
  {
    name: 'render.flush    100 sprites / 1 atlas',
    innerIters: 250,
    s: { ...DEFAULT_SCENARIO, count: 100, textures: 1 },
  },
  {
    name: 'render.flush    500 sprites / 1 atlas',
    innerIters: 55,
    s: { ...DEFAULT_SCENARIO, count: 500, textures: 1 },
  },
  {
    name: 'render.flush   1000 sprites / 1 atlas',
    innerIters: 26,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1 },
  },
  {
    name: 'render.flush   5000 sprites / 1 atlas',
    innerIters: 5,
    s: { ...DEFAULT_SCENARIO, count: 5000, textures: 1 },
  },
  // Multi-atlas: both orders, so batching is measured as well as its worst case.
  {
    name: 'render.flush    500 sprites / 4 atlas interleaved',
    innerIters: 26,
    s: { ...DEFAULT_SCENARIO, count: 500, textures: 4, order: 'interleaved' },
  },
  {
    name: 'render.flush    500 sprites / 4 atlas clustered',
    innerIters: 52,
    s: { ...DEFAULT_SCENARIO, count: 500, textures: 4, order: 'clustered' },
  },
  {
    name: 'render.flush   1000 sprites / 8 atlas interleaved',
    innerIters: 17,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 8, order: 'interleaved' },
  },
  {
    name: 'render.flush   1000 sprites / 8 atlas clustered',
    innerIters: 25,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 8, order: 'clustered' },
  },
  // The rotation branch inside fillXforms — the reason this suite now drives the
  // real frame renderer at all.
  {
    name: 'render.flush   1000 sprites / 50% rotated',
    innerIters: 25,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1, rotatedFraction: 0.5 },
  },
  {
    name: 'render.flush   1000 sprites / 100% rotated',
    innerIters: 20,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1, rotatedFraction: 1 },
  },
  // Batch-key fields that post-April features added and the bench never varied.
  {
    name: 'render.flush   1000 sprites / 4 alpha runs',
    innerIters: 28,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1, alphaRuns: 4 },
  },
  {
    name: 'render.flush   1000 sprites / tint effect',
    innerIters: 26,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1, effect: tint(WHITE, 0.5) },
  },
  {
    name: 'render.flush   1000 sprites / outline effect',
    innerIters: 14,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1, effect: outline(WHITE, 2) },
  },
  {
    name: 'render.flush   1000 sprites / stretch path',
    innerIters: 27,
    s: { ...DEFAULT_SCENARIO, count: 1000, textures: 1, stretch: true },
  },
  {
    name: 'render.flush   1000 sprites / zone-bg path',
    innerIters: 30,
    s: {
      ...DEFAULT_SCENARIO,
      count: 1000,
      textures: 1,
      effect: roofsCity({
        skyColor: SKY,
        roofColor: ROOF,
        resolutionW: VIEW_W,
        resolutionH: VIEW_H,
      }),
    },
  },
];

const SORT_SCENARIOS: readonly { n: number; jitter: number; innerIters: number }[] = [
  { n: 500, jitter: 0, innerIters: 1000 },
  { n: 500, jitter: 5, innerIters: 227 },
  { n: 1000, jitter: 10, innerIters: 54 },
];

export function renderBenches(overrides?: BenchOverrides): BenchStats[] {
  const out: BenchStats[] = [];

  for (const scenario of FLUSH_SCENARIOS) {
    out.push(
      runBench(
        {
          name: scenario.name,
          setup: () => buildFlushState(scenario.s),
          run: flushRun,
          innerIters: scenario.innerIters,
        },
        overrides,
      ),
    );
  }

  for (const { n, jitter, innerIters } of SORT_SCENARIOS) {
    out.push(
      runBench(
        {
          name: `render.sort    ${n.toString().padStart(4)} items (${jitter} swaps)`,
          setup: () => buildSortState(n, jitter),
          run: sortRun,
          innerIters,
        },
        overrides,
      ),
    );
  }

  return out;
}
