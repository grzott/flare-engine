/**
 * Pure-data particle-draw scenario matrix — no ParticleEmitter, batch or frame
 * renderer, no closure. Consumed by `../particles-draw.bench.ts`, which binds
 * each row to a saturated emitter drawn through `drawParticles`, a real
 * `SpriteBatch` and the frame renderer against the counting Skia stub.
 *
 * `innerIters` is an estimate aimed at the 1.5 ms sample the other suites use,
 * not a measurement: the row has not been timed on the pinned reference machine.
 * The first capture's sample-window warning says whether it needs retuning.
 */
export type ParticlesDrawScenario = {
  readonly name: string;
  /** Live particles drawn per frame. */
  readonly n: number;
  readonly innerIters: number;
};

export const PARTICLES_DRAW_SCENARIOS: readonly ParticlesDrawScenario[] = [
  {
    name: 'particles.draw  1000 coloured + fading / 1 atlas',
    n: 1000,
    innerIters: 20,
  },
];
