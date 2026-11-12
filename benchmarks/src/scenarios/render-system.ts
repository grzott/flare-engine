/**
 * Pure-data render-system scenario matrix — no World, query, batch or system
 * instance, no closure. Consumed by `../render-system.bench.ts`, which binds
 * each row to a real `World` drawn through `createRenderSystem`.
 *
 * `innerIters` is an estimate aimed at the 1.5 ms sample the other suites use,
 * not a measurement: the row has not been timed on the pinned reference machine.
 * The first capture's sample-window warning says whether it needs retuning.
 */
export type RenderSystemScenario = {
  readonly name: string;
  readonly count: number;
  /** Distinct `z` values, assigned round-robin in spawn order. */
  readonly zLayers: number;
  readonly innerIters: number;
};

export const RENDER_SYSTEM_SCENARIOS: readonly RenderSystemScenario[] = [
  {
    name: 'render.system  1000 sprites / 3 z layers interleaved',
    count: 1000,
    zLayers: 3,
    innerIters: 22,
  },
];
