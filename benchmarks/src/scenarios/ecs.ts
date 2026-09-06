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

/** A churn row additionally destroys and respawns `churn` entities per step. */
export type EcsChurnScenario = EcsScenario & { readonly churn: number };

/**
 * Churn sweep — steady population, `n / 20` entities destroyed and respawned
 * every step (5%, the shape a bullet-heavy shmup actually produces).
 *
 * `ECS_SCENARIOS` above measures steady-state iteration and is deliberately
 * frozen, so every published ECS number described the fast path while the path
 * a consumer reports as dominating its frame had none. These rows are additive
 * for exactly that reason: they must not perturb the control suite, which is
 * the reference that located the 2026-07 regression in `render` (XR-7).
 *
 * Churn is where `Query._remove` shows up. `innerIters` is sized for ~10 ms per
 * sample rather than the ~1-2 ms the other suites use: spawning re-allocates two
 * component payloads per entity, so these rows are GC-bound in a way the
 * steady-state ones are not, and short samples straddle collection pauses. At
 * 1-2 ms/sample the fold guard measured 19-27% run-to-run spread and correctly
 * refused the window; longer samples average the pauses out.
 */
const CHURN_SWEEP: readonly { readonly n: number; readonly innerIters: number }[] = [
  { n: 500, innerIters: 400 },
  { n: 1000, innerIters: 350 },
  { n: 2000, innerIters: 170 },
  { n: 5000, innerIters: 80 },
];

export const ECS_CHURN_SCENARIOS: readonly EcsChurnScenario[] = CHURN_SWEEP.map(
  ({ n, innerIters }) => ({
    name: `ecs.churn ${n.toString().padStart(4)} entities, 5%/step`,
    n,
    churn: Math.max(1, Math.floor(n / 20)),
    innerIters,
  }),
);
