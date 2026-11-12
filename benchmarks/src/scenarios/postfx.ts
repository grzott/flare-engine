/**
 * Pure-data post-processing scenario matrix — no chain, controller, runtime or
 * Skia handle, no closure. Consumed by `../postfx.bench.ts`, which binds each
 * row to a real `@flare-engine/postfx` stack and, for `buildPass`, the counting
 * Skia stub.
 *
 * `innerIters` puts one sample near 1.5 ms pinned to P-cores, the window the
 * other suites use; measured 2026-11-12 across five pinned processes.
 */
export type PostFxKind = 'update' | 'enabled' | 'buildPass';

export type PostFxScenario = {
  readonly name: string;
  readonly kind: PostFxKind;
  readonly innerIters: number;
};

export const POSTFX_SCENARIOS: readonly PostFxScenario[] = [
  {
    name: 'postfx.update       5 live: flash + 4 timed',
    kind: 'update',
    innerIters: 21000,
  },
  {
    name: 'postfx.enabled      8 effects, 5 enabled',
    kind: 'enabled',
    innerIters: 33000,
  },
  {
    name: 'postfx.buildPass    8 effects, 5 enabled',
    kind: 'buildPass',
    innerIters: 6000,
  },
];
