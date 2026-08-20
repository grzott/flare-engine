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
  /** See `PARTICLES_WARMUP_MS`. */
  readonly warmupMs: number;
};

/**
 * These rows are measurably steadier at a larger warm-up budget than the 300 ms default. Why is
 * not established — "they need longer to reach a steady JIT tier" was the working theory and the
 * 6000 ms result below contradicts it, so the constant is calibrated, not explained.
 *
 * Measured 2026-08-20 by sweeping the budget across fresh processes and counting how often a row
 * landed in its slow state. Unpinned, at the 300 ms default: 2/6 slow at 300 ms, 3/6 at 600 ms,
 * 2/6 at 1200 ms, 0/6 at 2500 ms for `5000 integrate-only`. Pinned to P-cores at 2500 ms, three of
 * the four integrate rows are stable across five runs — `500` 1.70-1.81, `1000` 3.40-3.59, `5000`
 * 16.98-17.87, all inside 1.06x.
 *
 * **More is not better, and this is the value that was measured best.** Raising the budget to
 * 6000 ms made every row worse, not better: `500` reopened to 1.71-2.10, `1000` to 3.57/4.19,
 * `5000` to 16.83/21.17. Whatever the two states are, they are not "not enough warm-up time", and
 * a larger number here is not a safer one.
 *
 * The budget is per scenario, so this costs ~2.5 s x 7 particle rows per capture.
 *
 * **Known limitation: `2000 integrate-only` is not fixed by this, or by anything else tried.** It
 * splits 6.7-7.1 vs 8.4-8.9 us and does so pinned, at every budget from 2500 to 6000 ms, and even
 * when it is the only scenario a freshly-started process ever runs. It is therefore not JIT
 * history, not core placement and not warm-up. Its working set is the one in this sweep that lands
 * near the L1d capacity boundary, which would make the cost depend on where the pool happens to be
 * allocated — a hypothesis, stated as one, and not yet tested. `bench:promote` refuses windows on
 * this row, which is the correct behaviour until the cause is known.
 */
export const PARTICLES_WARMUP_MS = 2500;

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
    warmupMs: PARTICLES_WARMUP_MS,
  })),
  ...EMIT_SWEEP.map(({ n, innerIters }) => ({
    name: `particles.update  ${n.toString().padStart(4)} emit+integrate`,
    n,
    kind: 'emit' as const,
    innerIters,
    warmupMs: PARTICLES_WARMUP_MS,
  })),
];
