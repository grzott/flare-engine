/**
 * Pure-data render scenario matrix — no SpriteBatch, no FrameRenderer, no Skia
 * handle, no constructed effect object. Consumed by `../render.bench.ts`,
 * which binds each row to a real frame renderer against a counting Skia stub,
 * and (later) by a web runner driving the same rows against real CanvasKit.
 */

/**
 * Texture order within a batch. `interleaved` alternates textures per sprite,
 * which breaks the batch run on every command (run length 1) — the worst
 * case. `clustered` groups all sprites of one texture together — the run
 * count equals the atlas count.
 */
export type TextureOrder = 'interleaved' | 'clustered';

/**
 * A render effect selected by name rather than by constructed instance. The
 * runner maps the key to a concrete `AnySpriteEffect` via the constructors in
 * `@flare-engine/render` — kept out of this module so every descriptor
 * survives a JSON round-trip with no runtime handle baked in.
 */
export type RenderEffectKey = 'tint' | 'outline' | 'roofsCity';

export type FlushScenario = {
  readonly name: string;
  readonly innerIters: number;
  readonly count: number;
  readonly textures: number;
  readonly order: TextureOrder;
  /** Fraction of commands with a non-zero rotation, in [0, 1]. */
  readonly rotatedFraction: number;
  /** Number of distinct alpha values, laid out in equal contiguous blocks. */
  readonly alphaRuns: number;
  readonly effect?: RenderEffectKey;
  readonly stretch: boolean;
};

export type SortScenario = {
  readonly name: string;
  readonly n: number;
  readonly jitter: number;
  readonly innerIters: number;
};

const DEFAULT: Omit<FlushScenario, 'name' | 'innerIters' | 'count' | 'textures'> = {
  order: 'clustered',
  rotatedFraction: 0,
  alphaRuns: 1,
  stretch: false,
};

/** The frozen flush matrix. Exported so the allocation gate drives the same states. */
export const FLUSH_SCENARIOS: readonly FlushScenario[] = [
  // Sprite-count sweep, single atlas — the reference curve.
  {
    ...DEFAULT,
    name: 'render.flush    100 sprites / 1 atlas',
    innerIters: 250,
    count: 100,
    textures: 1,
  },
  {
    ...DEFAULT,
    name: 'render.flush    500 sprites / 1 atlas',
    innerIters: 55,
    count: 500,
    textures: 1,
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / 1 atlas',
    innerIters: 26,
    count: 1000,
    textures: 1,
  },
  {
    ...DEFAULT,
    name: 'render.flush   5000 sprites / 1 atlas',
    innerIters: 5,
    count: 5000,
    textures: 1,
  },
  // Multi-atlas: both orders, so batching is measured as well as its worst case.
  {
    ...DEFAULT,
    name: 'render.flush    500 sprites / 4 atlas interleaved',
    innerIters: 26,
    count: 500,
    textures: 4,
    order: 'interleaved',
  },
  {
    ...DEFAULT,
    name: 'render.flush    500 sprites / 4 atlas clustered',
    innerIters: 52,
    count: 500,
    textures: 4,
    order: 'clustered',
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / 8 atlas interleaved',
    innerIters: 17,
    count: 1000,
    textures: 8,
    order: 'interleaved',
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / 8 atlas clustered',
    innerIters: 25,
    count: 1000,
    textures: 8,
    order: 'clustered',
  },
  // The rotation branch inside fillXforms — the reason this suite now drives the
  // real frame renderer at all.
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / 50% rotated',
    innerIters: 25,
    count: 1000,
    textures: 1,
    rotatedFraction: 0.5,
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / 100% rotated',
    innerIters: 20,
    count: 1000,
    textures: 1,
    rotatedFraction: 1,
  },
  // Batch-key fields that post-April features added and the bench never varied.
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / 4 alpha runs',
    innerIters: 28,
    count: 1000,
    textures: 1,
    alphaRuns: 4,
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / tint effect',
    innerIters: 26,
    count: 1000,
    textures: 1,
    effect: 'tint',
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / outline effect',
    innerIters: 14,
    count: 1000,
    textures: 1,
    effect: 'outline',
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / stretch path',
    innerIters: 27,
    count: 1000,
    textures: 1,
    stretch: true,
  },
  {
    ...DEFAULT,
    name: 'render.flush   1000 sprites / zone-bg path',
    innerIters: 30,
    count: 1000,
    textures: 1,
    effect: 'roofsCity',
  },
];

export const SORT_SCENARIOS: readonly SortScenario[] = [
  { name: 'render.sort     500 items (0 swaps)', n: 500, jitter: 0, innerIters: 1000 },
  { name: 'render.sort     500 items (5 swaps)', n: 500, jitter: 5, innerIters: 227 },
  { name: 'render.sort    1000 items (10 swaps)', n: 1000, jitter: 10, innerIters: 54 },
];
