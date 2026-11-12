/**
 * Pure-data math scenario matrix — no vector, transform or matrix instance, no
 * closure. Consumed by `../math.bench.ts`, which binds each row to the real
 * `Vec2`, `Transform2D` and `Mat3` namespaces of `@flare-engine/math`.
 *
 * `innerIters` puts one sample near 1.5 ms pinned to P-cores, the window the
 * other suites use; measured 2026-11-12 across five pinned processes.
 */
export type MathKind = 'vec2' | 'transform2d' | 'mat3';

export type MathScenario = {
  readonly name: string;
  readonly n: number;
  readonly kind: MathKind;
  readonly innerIters: number;
};

export const MATH_SCENARIOS: readonly MathScenario[] = [
  {
    name: 'math.vec2         1000 x 6 out-param ops',
    n: 1000,
    kind: 'vec2',
    innerIters: 25,
  },
  {
    name: 'math.transform2d  1000 points, local->world->local',
    n: 1000,
    kind: 'transform2d',
    innerIters: 68,
  },
  {
    name: 'math.mat3         1000 fromTransform x parent',
    n: 1000,
    kind: 'mat3',
    innerIters: 84,
  },
];
