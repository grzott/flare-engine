/**
 * Pure-data baked-shape draw scenario matrix — no atlas, batch or frame
 * renderer, no closure. Consumed by `../shapes-draw.bench.ts`, which binds each
 * row to a shape atlas baked once against a no-op Skia and drawn through
 * `drawBakedShape`, a real `SpriteBatch` and the frame renderer against the
 * counting Skia stub.
 *
 * `innerIters` is an estimate aimed at the 1.5 ms sample the other suites use,
 * not a measurement: the row has not been timed on the pinned reference machine.
 * The first capture's sample-window warning says whether it needs retuning.
 */
export type ShapesDrawScenario = {
  readonly name: string;
  /** Baked instances drawn per frame. */
  readonly n: number;
  /** Distinct specs in the atlas; instance `i` draws spec `i % specs`. */
  readonly specs: number;
  readonly innerIters: number;
};

export const SHAPES_DRAW_SCENARIOS: readonly ShapesDrawScenario[] = [
  {
    name: 'shapes.draw  1000 baked instances / 8 specs / 1 atlas',
    n: 1000,
    specs: 8,
    innerIters: 20,
  },
];
