/**
 * Pins the `__DEV__` configuration every capture is taken under.
 *
 * `false` is the right value: it is the React Native *release* configuration —
 * what a shipped game runs — and it leaves the diagnostic counters off, which
 * is the state their "cost only when armed" design assumes.
 *
 * **Why this is recorded rather than assumed.** Until 2026-07-29 the engine read
 * the dev flag as a bare identifier behind a `typeof` guard, once per sprite per
 * transform pass. JSC has no inline cache for an unresolvable global, so a bench
 * process that did not declare the flag measured a ~270 ns penalty per sprite
 * and published it as engine cost: the 1000-sprite flush row read ~412 µs
 * undeclared against ~55 µs declared. Measured here, 1e6 evaluations per
 * configuration:
 *
 *   typeof IDENT, global undeclared ....... 272.5 ns
 *   typeof IDENT, global declared false ..... 0.7 ns
 *   typeof IDENT, global declared true ...... 1.2 ns
 *   globalThis property read, absent ........ 0.5 ns
 *
 * PERF-10 moved the hot sites (`fillXforms` in frame-renderer.ts, `Pool.release`
 * in pool.ts) onto that last form, so the configuration no longer changes the
 * measurement. This module stays anyway, for two reasons: the flag still selects
 * whether the counters are armed, and a capture that cannot state which
 * configuration it ran under cannot be compared against one that can — the
 * provenance is the point, not the penalty.
 *
 * Line numbers are deliberately omitted here; they rot. See
 * docs/plans/perf-measurement-2026-07.md §11.10 and B28.
 */

export const BENCH_DEV_FLAG = false;

/**
 * Idempotent. Call before running or measuring anything; every bench entry
 * point does, and `assertDevFlagDefined` fails a capture that forgot.
 */
export function applyBenchDevFlag(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.__DEV__ !== 'boolean') g.__DEV__ = BENCH_DEV_FLAG;
}

export function devFlagState(): 'true' | 'false' | 'undeclared' {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.__DEV__ !== 'boolean') return 'undeclared';
  return g.__DEV__ ? 'true' : 'false';
}

/**
 * Fail-closed guard for the capture path. A run taken with `__DEV__`
 * undeclared is not comparable to any other run, so it must not reach
 * results/history.ndjson at all.
 */
export function assertDevFlagDefined(): void {
  if (devFlagState() === 'undeclared') {
    throw new Error(
      '[bench] __DEV__ is undeclared — every guarded counter site would cost ~270 ns per evaluation ' +
        'and the capture would publish a JSC deoptimisation as engine cost. Call applyBenchDevFlag() first.',
    );
  }
}
