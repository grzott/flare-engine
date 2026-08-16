/**
 * Pure-data integration-frame scenario matrix — no World, no CollisionWorld,
 * no ParticleEmitter, no closure. Consumed by `../integration.bench.ts`,
 * which binds each row to a real per-frame pipeline.
 */

/** Particles alive for every row — a suite-wide constant, not swept. */
export const PARTICLE_COUNT = 300;

export type IntegrationScenario = {
  readonly name: string;
  readonly n: number;
  readonly innerIters: number;
};

const SWEEP: readonly { readonly n: number; readonly innerIters: number }[] = [
  { n: 500, innerIters: 1 },
  { n: 1000, innerIters: 1 },
  { n: 2000, innerIters: 1 },
];

export const INTEGRATION_SCENARIOS: readonly IntegrationScenario[] = SWEEP.map(
  ({ n, innerIters }) => ({
    name: `integration.frame  ${n.toString().padStart(4)} entities + ${PARTICLE_COUNT}p`,
    n,
    innerIters,
  }),
);
