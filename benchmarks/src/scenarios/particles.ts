/**
 * Pure-data particle scenario matrix — no ParticleEmitter, no closure.
 * Consumed by `../particles.bench.ts`, which binds each row to a real emitter
 * (`kind: 'integrate'` -> a burst-then-steady emitter, `kind: 'emit'` -> a
 * saturated streaming emitter).
 */
export type ParticlesKind = 'integrate' | 'emit';

export type ParticlesScenario = {
  readonly name: string;
  readonly n: number;
  readonly kind: ParticlesKind;
  readonly innerIters: number;
};

const INTEGRATE_SWEEP: readonly { readonly n: number; readonly innerIters: number }[] = [
  { n: 500, innerIters: 360 },
  { n: 1000, innerIters: 205 },
  { n: 2000, innerIters: 115 },
  { n: 5000, innerIters: 43 },
];

const EMIT_SWEEP: readonly { readonly n: number; readonly innerIters: number }[] = [
  { n: 500, innerIters: 155 },
  { n: 1000, innerIters: 95 },
  { n: 2000, innerIters: 39 },
];

export const PARTICLES_SCENARIOS: readonly ParticlesScenario[] = [
  ...INTEGRATE_SWEEP.map(({ n, innerIters }) => ({
    name: `particles.update  ${n.toString().padStart(4)} integrate-only`,
    n,
    kind: 'integrate' as const,
    innerIters,
  })),
  ...EMIT_SWEEP.map(({ n, innerIters }) => ({
    name: `particles.update  ${n.toString().padStart(4)} emit+integrate`,
    n,
    kind: 'emit' as const,
    innerIters,
  })),
];
