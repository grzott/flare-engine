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
import { ANIMATION_SCENARIOS, type AnimationKind, type AnimationScenario } from './animation.js';
import {
  ECS_CHURN_SCENARIOS,
  ECS_SCENARIOS,
  type EcsChurnScenario,
  type EcsScenario,
} from './ecs.js';
import { INTEGRATION_SCENARIOS, type IntegrationScenario, PARTICLE_COUNT } from './integration.js';
import { MATH_SCENARIOS, type MathKind, type MathScenario } from './math.js';
import { PARTICLES_SCENARIOS, type ParticlesKind, type ParticlesScenario } from './particles.js';
import {
  PATHFINDING_SCENARIOS,
  type PathfindingAlgorithm,
  type PathfindingLayout,
  type PathfindingScenario,
} from './pathfinding.js';
import { PHYSICS_SCENARIOS, type PhysicsDensity, type PhysicsScenario } from './physics.js';
import { POSTFX_SCENARIOS, type PostFxKind, type PostFxScenario } from './postfx.js';
import {
  FLUSH_SCENARIOS,
  type FlushScenario,
  type RenderEffectKey,
  SORT_SCENARIOS,
  type SortScenario,
  type TextureOrder,
} from './render.js';
import { RENDER_SYSTEM_SCENARIOS, type RenderSystemScenario } from './render-system.js';
import { TILEMAP_SCENARIOS, type TilemapKind, type TilemapScenario } from './tilemap.js';

export type {
  AnimationKind,
  AnimationScenario,
  EcsChurnScenario,
  EcsScenario,
  FlushScenario,
  IntegrationScenario,
  MathKind,
  MathScenario,
  ParticlesKind,
  ParticlesScenario,
  PathfindingAlgorithm,
  PathfindingLayout,
  PathfindingScenario,
  PhysicsDensity,
  PhysicsScenario,
  PostFxKind,
  PostFxScenario,
  RenderEffectKey,
  RenderSystemScenario,
  SortScenario,
  TextureOrder,
  TilemapKind,
  TilemapScenario,
};
export {
  ANIMATION_SCENARIOS,
  ECS_CHURN_SCENARIOS,
  ECS_SCENARIOS,
  FLUSH_SCENARIOS,
  INTEGRATION_SCENARIOS,
  MATH_SCENARIOS,
  PARTICLE_COUNT,
  PARTICLES_SCENARIOS,
  PATHFINDING_SCENARIOS,
  PHYSICS_SCENARIOS,
  POSTFX_SCENARIOS,
  RENDER_SYSTEM_SCENARIOS,
  SORT_SCENARIOS,
  TILEMAP_SCENARIOS,
};

type SuiteTitle =
  | 'ECS'
  | 'Physics'
  | 'Particles'
  | 'Render'
  | 'Integration'
  | 'Animation'
  | 'PostFx'
  | 'Tilemap'
  | 'Pathfinding'
  | 'Math'
  | 'RenderSystem';

type NamedScenario = { readonly name: string };

/** One entry per suite title in `scenario-contract.ts`'s `EXPECTED_SUITE_TITLES`. */
export const SCENARIOS: Readonly<Record<SuiteTitle, readonly NamedScenario[]>> = {
  ECS: [...ECS_SCENARIOS, ...ECS_CHURN_SCENARIOS],
  Physics: PHYSICS_SCENARIOS,
  Particles: PARTICLES_SCENARIOS,
  Render: [...FLUSH_SCENARIOS, ...SORT_SCENARIOS],
  Integration: INTEGRATION_SCENARIOS,
  Animation: ANIMATION_SCENARIOS,
  PostFx: POSTFX_SCENARIOS,
  Tilemap: TILEMAP_SCENARIOS,
  Pathfinding: PATHFINDING_SCENARIOS,
  Math: MATH_SCENARIOS,
  RenderSystem: RENDER_SYSTEM_SCENARIOS,
};
