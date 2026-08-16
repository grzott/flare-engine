/**
 * Pure-data ECS scenario matrix — no World, no query, no closure. Consumed by
 * `../ecs.bench.ts`, which binds each row to a real `World`.
 */
export type EcsScenario = {
  readonly name: string;
  readonly n: number;
  readonly innerIters: number;
};

const SWEEP: readonly { readonly n: number; readonly innerIters: number }[] = [
  { n: 500, innerIters: 240 },
  { n: 1000, innerIters: 83 },
  { n: 2000, innerIters: 40 },
  { n: 5000, innerIters: 16 },
];

export const ECS_SCENARIOS: readonly EcsScenario[] = SWEEP.map(({ n, innerIters }) => ({
  name: `ecs.step  ${n.toString().padStart(4)} entities (Pos+Vel)`,
  n,
  innerIters,
}));
