/**
 * Pins the `__DEV__` configuration every capture is taken under.
 *
 * This is not a detail. The engine guards its diagnostic counters with
 * `typeof __DEV__ !== 'undefined' && __DEV__` (frame-renderer.ts:413,:429 —
 * evaluated once per sprite per transform pass — and pool.ts:78, once per
 * released object). In JSC an *unresolvable* global identifier costs about
 * **270 ns per evaluation**; once the global exists, the same expression costs
 * **0.5 ns**. Measured on this machine, 1e6 evaluations per configuration:
 *
 *   typeof IDENT, global undeclared ....... 272.5 ns
 *   typeof IDENT, global declared false ..... 0.7 ns
 *   typeof IDENT, global declared true ...... 1.2 ns
 *   globalThis property read, absent ........ 0.5 ns
 *
 * Bun declares no `__DEV__`, so a bench process that does not set it measures
 * that ~270 ns penalty once per sprite and reports it as engine cost: the
 * 1000-sprite flush row reads ~412 µs undeclared versus ~55 µs declared. The
 * harness would be publishing a JSC deoptimisation as a render regression.
 *
 * `false` is the right value: it is the React Native *release* configuration —
 * what a shipped game runs — and it leaves the diagnostic counters off, which
 * is the state their "cost only when armed" design assumes.
 *
 * The engine-side defect this exposes (the guard should read a property off
 * `globalThis` rather than an unresolvable identifier, which is equally
 * toggleable at runtime and ~400x cheaper when absent) is its own row: see
 * docs/plans/perf-measurement-2026-07.md §11.10.
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
