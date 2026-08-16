/**
 * Pure-data physics scenario matrix — no CollisionWorld, no closure. Consumed
 * by `../physics.bench.ts`, which binds each row to a real `CollisionWorld`.
 */
export type PhysicsDensity = 'sparse' | 'dense';

export type PhysicsScenario = {
  readonly name: string;
  readonly n: number;
  readonly density: PhysicsDensity;
  readonly innerIters: number;
};

const SWEEP: readonly {
  readonly n: number;
  readonly density: PhysicsDensity;
  readonly innerIters: number;
}[] = [
  { n: 100, density: 'sparse', innerIters: 28 },
  { n: 100, density: 'dense', innerIters: 18 },
  { n: 500, density: 'sparse', innerIters: 1 },
  { n: 500, density: 'dense', innerIters: 1 },
  { n: 1000, density: 'sparse', innerIters: 1 },
  { n: 1000, density: 'dense', innerIters: 1 },
];

export const PHYSICS_SCENARIOS: readonly PhysicsScenario[] = SWEEP.map(
  ({ n, density, innerIters }) => ({
    name: `physics.step  ${n.toString().padStart(4)} AABB ${density === 'sparse' ? 'sparse' : 'dense '}`,
    n,
    density,
    innerIters,
  }),
);
