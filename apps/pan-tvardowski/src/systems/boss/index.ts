/**
 * Boss system barrel. Per-boss logic lives in sibling modules
 * (`smok.ts`, `wodnik.ts`, …); the FSM itself is pattern-agnostic.
 * Adding a new boss is: (1) add a `PhaseScript` file, (2) register it in
 * `registry.ts`.
 */
export { clearBossFsms, computeBossStatus, updateBoss } from './fsm';
export type { BossCtx, BossDeps, BossStatus, PhaseScript } from './types';
