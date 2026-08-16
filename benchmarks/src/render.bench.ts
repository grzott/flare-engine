import {
  type AnySpriteEffect,
  createFrameRenderer,
  type Drawable,
  type FrameRenderer,
  outline,
  roofsCity,
  SpriteBatch,
  type SpriteColor,
  type SpriteDrawCommand,
  sortByDrawOrder,
  tint,
} from '@flare-engine/render';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import {
  FLUSH_SCENARIOS,
  type FlushScenario,
  type RenderEffectKey,
  SORT_SCENARIOS,
} from './scenarios/render.js';
import { createCountingSkiaStub, makeStubImage, type SkiaStub } from './skia-stub.js';

export type { FlushScenario };

const VIEW_W = 800;
const VIEW_H = 600;
const SPRITE = 16;

type BatchImage = Parameters<SpriteBatch['drawRaw']>[0];

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

const WHITE: SpriteColor = { r: 1, g: 1, b: 1, a: 1 };
const SKY: SpriteColor = { r: 0.2, g: 0.4, b: 0.8, a: 1 };
const ROOF: SpriteColor = { r: 0.3, g: 0.2, b: 0.25, a: 1 };

/**
 * Resolves a scenario's effect *selection* to a concrete effect instance. Kept
 * here, not in `scenarios/render.ts`: constructing an `AnySpriteEffect` is
 * runtime work, and the scenario module stays pure data.
 */
function buildEffect(key: RenderEffectKey | undefined): AnySpriteEffect | undefined {
  switch (key) {
    case undefined:
      return undefined;
    case 'tint':
      return tint(WHITE, 0.5);
    case 'outline':
      return outline(WHITE, 2);
    case 'roofsCity':
      return roofsCity({
        skyColor: SKY,
        roofColor: ROOF,
        resolutionW: VIEW_W,
        resolutionH: VIEW_H,
      });
  }
}

export function buildFlushState(scenario: FlushScenario, strict = false): FlushState {
  const session = createBenchSession({ seed: 0x50e7 });
  try {
    const { count, textures, order, rotatedFraction, alphaRuns, stretch } = scenario;
    const effect = buildEffect(scenario.effect);
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

export { FLUSH_SCENARIOS };

export function renderBenches(overrides?: BenchOverrides): BenchStats[] {
  const out: BenchStats[] = [];

  for (const scenario of FLUSH_SCENARIOS) {
    out.push(
      runBench(
        {
          name: scenario.name,
          setup: () => buildFlushState(scenario),
          run: flushRun,
          innerIters: scenario.innerIters,
        },
        overrides,
      ),
    );
  }

  for (const { name, n, jitter, innerIters } of SORT_SCENARIOS) {
    out.push(
      runBench(
        {
          name,
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
