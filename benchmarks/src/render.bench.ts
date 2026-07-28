import { SeededRNG } from '@flare-engine/math';
import { type Drawable, SpriteBatch, sortByDrawOrder } from '@flare-engine/render';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';

interface SkImageStub {
  width(): number;
  height(): number;
}

function makeImage(w: number, h: number): SkImageStub {
  return { width: () => w, height: () => h };
}

type BatchState = {
  batch: SpriteBatch;
  images: SkImageStub[];
  drawAtlas: () => void;
  count: number;
  uniqueTextures: number;
};

function buildBatchState(count: number, uniqueTextures: number): BatchState {
  const images: SkImageStub[] = [];
  for (let i = 0; i < uniqueTextures; i++) images.push(makeImage(256, 256));
  return {
    batch: new SpriteBatch(),
    images,
    drawAtlas: () => {},
    count,
    uniqueTextures,
  };
}

function batchRun(state: BatchState): void {
  const { batch, images, drawAtlas, count, uniqueTextures } = state;
  for (let i = 0; i < count; i++) {
    const img = images[i % uniqueTextures]!;
    batch.drawRaw(
      img as unknown as Parameters<typeof batch.drawRaw>[0],
      0,
      0,
      16,
      16,
      (i * 7) % 800,
      (i * 11) % 600,
      16,
      16,
    );
  }
  batch.flush(drawAtlas);
}

type SortState = {
  items: { z: number }[];
  rng: SeededRNG;
  jitter: number;
};

function buildSortState(n: number, jitter: number): SortState {
  const rng = new SeededRNG(0x50e7);
  const items: { z: number }[] = new Array(n);
  for (let i = 0; i < n; i++) items[i] = { z: i };
  return { items, rng, jitter };
}

function sortRun(state: SortState): void {
  const { items, rng, jitter } = state;
  if (jitter > 0) {
    for (let k = 0; k < jitter; k++) {
      const i = rng.int(0, items.length - 1);
      const j = rng.int(0, items.length - 1);
      const tmp = items[i] as { z: number };
      items[i] = items[j] as { z: number };
      items[j] = tmp;
    }
  }
  sortByDrawOrder<Drawable>(items);
}

export function renderBenches(overrides?: BenchOverrides): BenchStats[] {
  const out: BenchStats[] = [];

  for (const { n, tx } of [
    { n: 100, tx: 1 },
    { n: 500, tx: 1 },
    { n: 1000, tx: 1 },
    { n: 500, tx: 4 },
    { n: 1000, tx: 8 },
  ]) {
    out.push(
      runBench(
        {
          name: `render.flush   ${n.toString().padStart(4)} sprites / ${tx} atlas`,
          setup: () => buildBatchState(n, tx),
          run: batchRun,
          innerIters: n >= 1000 ? 100 : 300,
          samples: 30,
        },
        overrides,
      ),
    );
  }

  for (const { n, j } of [
    { n: 500, j: 0 },
    { n: 500, j: 5 },
    { n: 1000, j: 10 },
  ]) {
    out.push(
      runBench(
        {
          name: `render.sort    ${n.toString().padStart(4)} items (${j} swaps)`,
          setup: () => buildSortState(n, j),
          run: sortRun,
          innerIters: 500,
          samples: 30,
        },
        overrides,
      ),
    );
  }

  return out;
}
