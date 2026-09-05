/**
 * The exported source of truth for every microbench scenario: pure counts,
 * texture orders, rotated fractions, alpha runs, and effect *selections* — no
 * Skia handle, no engine instance, no closure over a runner. Each `*.bench.ts`
 * file binds these rows to a real runtime; a browser runner (apps/bench-web)
 * and later `bench-native` bind the same rows to their own.
 *
 * Kept independent of `scenario-contract.ts` (the frozen name registry): the
 * two agree by test (`tests/scenarios.test.ts`), not by import, so the
 * registry stays a pure name list with no executable dependency on this
 * module.
 */
import {
  ECS_CHURN_SCENARIOS,
  ECS_SCENARIOS,
  type EcsChurnScenario,
  type EcsScenario,
} from './ecs.js';
import { INTEGRATION_SCENARIOS, type IntegrationScenario, PARTICLE_COUNT } from './integration.js';
import { PARTICLES_SCENARIOS, type ParticlesKind, type ParticlesScenario } from './particles.js';
import { PHYSICS_SCENARIOS, type PhysicsDensity, type PhysicsScenario } from './physics.js';
import {
  FLUSH_SCENARIOS,
  type FlushScenario,
  type RenderEffectKey,
  SORT_SCENARIOS,
  type SortScenario,
  type TextureOrder,
} from './render.js';

export type {
  EcsChurnScenario,
  EcsScenario,
  FlushScenario,
  IntegrationScenario,
  ParticlesKind,
  ParticlesScenario,
  PhysicsDensity,
  PhysicsScenario,
  RenderEffectKey,
  SortScenario,
  TextureOrder,
};
export {
  ECS_CHURN_SCENARIOS,
  ECS_SCENARIOS,
  FLUSH_SCENARIOS,
  INTEGRATION_SCENARIOS,
  PARTICLE_COUNT,
  PARTICLES_SCENARIOS,
  PHYSICS_SCENARIOS,
  SORT_SCENARIOS,
};

type SuiteTitle = 'ECS' | 'Physics' | 'Particles' | 'Render' | 'Integration';

type NamedScenario = { readonly name: string };

/** One entry per suite title in `scenario-contract.ts`'s `EXPECTED_SUITE_TITLES`. */
export const SCENARIOS: Readonly<Record<SuiteTitle, readonly NamedScenario[]>> = {
  ECS: [...ECS_SCENARIOS, ...ECS_CHURN_SCENARIOS],
  Physics: PHYSICS_SCENARIOS,
  Particles: PARTICLES_SCENARIOS,
  Render: [...FLUSH_SCENARIOS, ...SORT_SCENARIOS],
  Integration: INTEGRATION_SCENARIOS,
};
