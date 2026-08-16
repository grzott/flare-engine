/**
 * Binds the render-suite scenario descriptors (`@flare-engine/benchmarks/scenarios`) to a real
 * CanvasKit instance and reports rAF-paced percentiles.
 *
 * Scope: the Render suite (`FLUSH_SCENARIOS` + `SORT_SCENARIOS`) only. The ECS / Physics /
 * Particles / Integration suites bind to `@flare-engine/ecs` / `@flare-engine/physics` /
 * `@flare-engine/particles`, none of which this app depends on — those suites measure engine
 * logic with no CanvasKit involvement, so a browser run of them would add nothing a Node run
 * doesn't already give honestly. "Real CanvasKit" is specifically about the render path.
 *
 * Two render targets, selected by the caller via `RenderTarget` (see `main.ts` for mode wiring):
 *
 *  - `createCpuRasterTarget` — an offscreen `CanvasKit.MakeSurface` (no `<canvas>`/WebGL surface).
 *    This is CanvasKit's CPU-backed raster surface by construction (its own type definitions say
 *    so), not merely software rendering forced by a launch flag. It removes GPU driver/compositor
 *    variance entirely rather than merely controlling for it — the strongest available form of
 *    "disable the GPU-variance sources you can control". `present()` is a no-op: the bitmap is
 *    never displayed, so there is nothing to flush.
 *  - `createGpuTarget` — a real on-screen `<canvas>` + WebGL surface via
 *    `@flare-engine/render-web`'s `createPostFxSurface` (passthrough `EffectChain`, so no shader
 *    passes run — just the scene snapshot + blit + flush every real consumer pays). This is the
 *    GPU-backed frame cost the CPU-raster lane above cannot measure by design; see
 *    `playwright.config.ts` for the launch-arg side of making this mode actually use hardware.
 */

import { DEFAULT_WARMUP_MS, P99_MIN_SAMPLES, percentile } from '@flare-engine/benchmarks/harness';
import {
  FLUSH_SCENARIOS,
  type FlushScenario,
  type RenderEffectKey,
  SORT_SCENARIOS,
  type SortScenario,
} from '@flare-engine/benchmarks/scenarios';
import { EffectChain } from '@flare-engine/postfx';
import {
  type AnySpriteEffect,
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
import { createPostFxSurface, createWebFrameRenderer } from '@flare-engine/render-web';
import { createBenchSession } from '@flare-engine/testing';
import type { CanvasKit, Canvas as CKCanvas, Image as CKImage, SkPicture } from 'canvaskit-wasm';

export { FLUSH_SCENARIOS, SORT_SCENARIOS };

/** The full, ordered list of Render-suite scenario names this runner covers. */
export const RENDER_SCENARIO_NAMES: readonly string[] = [
  ...FLUSH_SCENARIOS.map((s) => s.name),
  ...SORT_SCENARIOS.map((s) => s.name),
];

export type ScenarioResult = {
  readonly name: string;
  readonly samples: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
};

export const VIEW_W = 800;
export const VIEW_H = 600;
const SPRITE = 16;

/**
 * Where a frame's drawn content lands, and how it gets presented. `canvas` is where scenario
 * code draws each frame's `SkPicture`; `present()` is called once per simulated frame, after the
 * draw, so a GPU target's snapshot + blit + flush cost — the actual cost of getting pixels
 * on-screen — is inside the measured region exactly like a real consumer pays it every frame.
 */
export type RenderTarget = {
  readonly canvas: CKCanvas;
  present(): void;
  dispose(): void;
};

/** The CPU-raster target: an offscreen bitmap that is never displayed, so `present()` is a no-op
 *  — this preserves the CPU-raster lane's measured behaviour exactly as it was before GPU mode
 *  existed. */
export function createCpuRasterTarget(kit: CanvasKit): RenderTarget {
  const surface = kit.MakeSurface(VIEW_W, VIEW_H);
  if (surface === null) {
    throw new Error(`bench-web: CanvasKit.MakeSurface(${VIEW_W}, ${VIEW_H}) returned null`);
  }
  return {
    canvas: surface.getCanvas(),
    present: () => {},
    dispose: () => surface.delete(),
  };
}

/**
 * The GPU target: a real on-screen `<canvas>` backed by `@flare-engine/render-web`'s
 * `createPostFxSurface`, given a passthrough (empty) `EffectChain` so no shader pass runs — the
 * scene snapshot is blitted straight to the on-screen surface. Throws if WebGL is unavailable
 * (e.g. the launch args in `playwright.config.ts` failed to secure a GPU context) rather than
 * silently falling back to something CPU-backed, which would defeat the whole point of this mode.
 */
export function createGpuTarget(kit: CanvasKit, canvas: HTMLCanvasElement): RenderTarget {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const surface = createPostFxSurface(kit, canvas, new EffectChain());
  if (surface === null) {
    throw new Error('bench-web: createPostFxSurface returned null — WebGL context unavailable');
  }
  surface.clear([0, 0, 0]);
  const sceneCanvas = surface.sceneCanvas();
  if (sceneCanvas === null) {
    throw new Error('bench-web: GPU surface has no scene canvas immediately after creation');
  }
  return {
    canvas: sceneCanvas,
    present: () => {
      if (surface.isLost()) {
        throw new Error('bench-web: WebGL context lost mid-capture');
      }
      surface.composite(1);
      surface.flush();
    },
    dispose: () => surface.dispose(),
  };
}

const WHITE: SpriteColor = { r: 1, g: 1, b: 1, a: 1 };
const SKY: SpriteColor = { r: 0.2, g: 0.4, b: 0.8, a: 1 };
const ROOF: SpriteColor = { r: 0.3, g: 0.2, b: 0.25, a: 1 };

/**
 * Resolves a scenario's effect *selection* to a concrete effect instance — the web analog of
 * `render.bench.ts`'s `buildEffect`. Same keys, same parameters, so the two runners measure the
 * same work. Cannot import the Node version directly: `benchmarks`'s package exports only the
 * scenario data, harness, and contract modules, not its bench-runner internals.
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

/** A flat-colored 256x256 CanvasKit image — the web analog of `skia-stub.ts`'s `makeStubImage`. */
function makeSolidImage(kit: CanvasKit, w: number, h: number, index: number): CKImage {
  const surface = kit.MakeSurface(w, h);
  if (surface === null) {
    throw new Error(`bench-web: CanvasKit.MakeSurface(${w}, ${h}) returned null`);
  }
  // Cycle a handful of distinct colors so interleaved/clustered atlas order is visually
  // distinguishable if the destination surface is ever inspected; the value has no effect on
  // the measured work.
  const hues: readonly [number, number, number][] = [
    [0.8, 0.2, 0.2],
    [0.2, 0.7, 0.3],
    [0.2, 0.4, 0.9],
    [0.9, 0.8, 0.2],
    [0.6, 0.2, 0.8],
    [0.2, 0.8, 0.8],
    [0.9, 0.5, 0.2],
    [0.5, 0.5, 0.5],
  ];
  const [r, g, b] = hues[index % hues.length] as [number, number, number];
  surface.getCanvas().clear(kit.Color4f(r, g, b, 1));
  const image = surface.makeImageSnapshot();
  surface.delete();
  return image;
}

/** Delete a CanvasKit-backed WASM object if it exposes `delete()` — no-op otherwise. */
function deleteIfPossible(obj: unknown): void {
  const maybe = obj as { delete?: () => void } | null | undefined;
  if (maybe != null && typeof maybe.delete === 'function') maybe.delete();
}

type BatchImage = Parameters<SpriteBatch['drawRaw']>[0];

type FlushRunnerState = {
  readonly scenario: FlushScenario;
  readonly batch: SpriteBatch;
  readonly images: CKImage[];
  readonly imageOf: number[];
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  readonly rotations: Float64Array;
  readonly alphas: Float64Array;
  readonly count: number;
  readonly effect: AnySpriteEffect | undefined;
  readonly stretch: boolean;
};

/** Mirrors `render.bench.ts`'s `buildFlushState` exactly (same seed, same formulas) so both
 *  runners exercise byte-identical sprite positions/rotations/alphas per scenario. */
function buildFlushRunnerState(kit: CanvasKit, scenario: FlushScenario): FlushRunnerState {
  const session = createBenchSession({ seed: 0x50e7 });
  try {
    const { count, textures, order, rotatedFraction, alphaRuns, stretch } = scenario;
    const effect = buildEffect(scenario.effect);
    const images: CKImage[] = [];
    for (let i = 0; i < textures; i++) images.push(makeSolidImage(kit, 256, 256, i));

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
      rotations[i] = i < rotatedCount ? 0.3 + (i % 7) * 0.11 : 0;
      alphas[i] = alphaRuns <= 1 ? 1 : 1 - Math.floor(i / Math.ceil(count / alphaRuns)) * 0.15;
    }

    return {
      scenario,
      batch: new SpriteBatch(),
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

function disposeFlushRunnerState(state: FlushRunnerState): void {
  for (const image of state.images) deleteIfPossible(image);
}

/** One flush-and-present cycle, mirroring `render.bench.ts`'s `flushRun` plus presentation.
 *  `target.present()` runs every simulated frame, not once per rAF tick's `innerIters` batch —
 *  each `flushOnce` call is one full frame's worth of work, presentation included, matching what
 *  a real consumer pays per frame. */
function flushOnce(state: FlushRunnerState, renderer: FrameRenderer, target: RenderTarget): void {
  const { batch, images, imageOf, xs, ys, rotations, alphas, count, effect, stretch } = state;
  renderer.beginFrame(VIEW_W, VIEW_H);
  for (let i = 0; i < count; i++) {
    batch.drawRaw(
      images[imageOf[i] as number] as unknown as BatchImage,
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
  batch.flush((image: BatchImage, commands: SpriteDrawCommand[]) =>
    renderer.drawAtlas(image, commands),
  );
  const pic = renderer.endFrame();
  if (pic !== null) {
    target.canvas.drawPicture(pic as unknown as SkPicture);
    deleteIfPossible(pic);
  }
  target.present();
}

type SortRunnerState = {
  readonly items: { z: number }[];
  readonly order: number[];
  readonly jitter: number;
};

/** Mirrors `render.bench.ts`'s `buildSortState` exactly (same seed, same formula). */
function buildSortRunnerState(scenario: SortScenario): SortRunnerState {
  const { n, jitter } = scenario;
  const session = createBenchSession({ seed: 0x50e7 });
  try {
    const items: { z: number }[] = new Array(n);
    for (let i = 0; i < n; i++) items[i] = { z: i };
    const order: number[] = new Array(jitter * 2);
    for (let k = 0; k < jitter * 2; k++) order[k] = session.rng.int(0, n - 1);
    return { items, order, jitter };
  } finally {
    session.end();
  }
}

function sortOnce(state: SortRunnerState): void {
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

/**
 * Runs `work` once per `requestAnimationFrame` callback, recording the elapsed time between
 * consecutive callbacks as one sample — the actual browser frame-to-frame cost, not a synchronous
 * `performance.now()` bracket. Discards samples collected during the warm-up window.
 */
function sampleRafDeltas(
  work: () => void,
  minSamples: number,
  warmupMs: number,
): Promise<number[]> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    let lastTs: number | null = null;
    let warmupStart: number | null = null;
    let warmedUp = warmupMs <= 0;

    const tick = (ts: number): void => {
      if (!warmedUp) {
        if (warmupStart === null) warmupStart = ts;
        work();
        if (ts - warmupStart >= warmupMs) {
          warmedUp = true;
          lastTs = null;
        }
        requestAnimationFrame(tick);
        return;
      }
      if (lastTs !== null) samples.push(ts - lastTs);
      lastTs = ts;
      work();
      if (samples.length >= minSamples) {
        resolve(samples);
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function toResult(
  name: string,
  rafSamplesMs: readonly number[],
  innerIters: number,
): ScenarioResult {
  const perOp = rafSamplesMs.map((ms) => ms / innerIters).sort((a, b) => a - b);
  return {
    name,
    samples: perOp.length,
    p50Ms: percentile(perOp, 0.5),
    p95Ms: percentile(perOp, 0.95),
    p99Ms: percentile(perOp, 0.99),
  };
}

async function runFlushScenario(
  kit: CanvasKit,
  renderer: FrameRenderer,
  target: RenderTarget,
  scenario: FlushScenario,
): Promise<ScenarioResult> {
  const state = buildFlushRunnerState(kit, scenario);
  const innerIters = scenario.innerIters;
  try {
    const work = (): void => {
      for (let i = 0; i < innerIters; i++) flushOnce(state, renderer, target);
    };
    const rafSamplesMs = await sampleRafDeltas(work, P99_MIN_SAMPLES, DEFAULT_WARMUP_MS);
    return toResult(scenario.name, rafSamplesMs, innerIters);
  } finally {
    disposeFlushRunnerState(state);
  }
}

async function runSortScenario(scenario: SortScenario): Promise<ScenarioResult> {
  const state = buildSortRunnerState(scenario);
  const innerIters = scenario.innerIters;
  const work = (): void => {
    for (let i = 0; i < innerIters; i++) sortOnce(state);
  };
  const rafSamplesMs = await sampleRafDeltas(work, P99_MIN_SAMPLES, DEFAULT_WARMUP_MS);
  return toResult(scenario.name, rafSamplesMs, innerIters);
}

/** Fired after each scenario finishes, with the result just produced — lets a caller render
 *  progressively instead of waiting for the whole suite (an 18-scenario CanvasKit CPU-raster
 *  capture takes minutes; a human or a driver watching the page should see numbers as they land). */
export type RenderSuiteProgress = (done: number, total: number, result: ScenarioResult) => void;

/**
 * Runs every Render-suite scenario against real CanvasKit and returns one percentile record per
 * scenario, in `RENDER_SCENARIO_NAMES` order.
 *
 * `target` is caller-owned: build it with `createCpuRasterTarget` or `createGpuTarget` and
 * dispose it yourself once this resolves — ownership stays with whoever constructed it, matching
 * how `kit` and `onProgress` are already caller-supplied.
 */
export async function runRenderSuite(
  kit: CanvasKit,
  target: RenderTarget,
  onProgress?: RenderSuiteProgress,
): Promise<ScenarioResult[]> {
  // One long-lived FrameRenderer shared by every flush scenario, matching how a real game uses
  // it. createFrameRenderer has no dispose/teardown API (packages/render), so instantiating one
  // per scenario would multiply an unavoidable leak fifteen-fold for no benefit.
  const renderer = createWebFrameRenderer(kit);

  const results: ScenarioResult[] = [];
  const total = FLUSH_SCENARIOS.length + SORT_SCENARIOS.length;

  for (const scenario of FLUSH_SCENARIOS) {
    const result = await runFlushScenario(kit, renderer, target, scenario);
    results.push(result);
    onProgress?.(results.length, total, result);
  }
  for (const scenario of SORT_SCENARIOS) {
    const result = await runSortScenario(scenario);
    results.push(result);
    onProgress?.(results.length, total, result);
  }

  return results;
}
