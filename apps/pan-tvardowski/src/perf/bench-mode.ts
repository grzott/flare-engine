/**
 * Bench mode — activated by `pantvardowski://bench/<id>` deep link or
 * `BENCH_MODE=1` env baked at EAS build time (E5).
 *
 * When active:
 *   - mulberry32 seeded RNG replaces Math.random globally
 *   - audio is muted (callers check isBenchAudioMuted())
 *   - save persistence is skipped (callers check isBenchSaveMuted())
 *   - intros / dialogue are bypassed (callers check isBenchDialogueBypassed())
 *   - BENCH_DONE sentinel becomes visible after the scenario completes
 *
 * Design: Option A (monkey-patch Math.random). The original is captured once
 * and restored by deactivateBenchMode() so other tests / runs are unaffected.
 */

export type BenchScenarioId = string;

interface BenchState {
  active: boolean;
  scenarioId: BenchScenarioId;
  done: boolean;
  seed: number;
  rngState: number;
}

const _state: BenchState = {
  active: false,
  scenarioId: '',
  done: false,
  seed: 0,
  rngState: 0,
};

/** Captured original Math.random, restored on deactivate. */
let _originalRandom: (() => number) | null = null;

// ---------------------------------------------------------------------------
// mulberry32 — fast, seedable, period ~2^32
// ---------------------------------------------------------------------------

/** Advance the mulberry32 state and return a float in [0, 1). */
function mulberry32(stateRef: BenchState): number {
  let s = stateRef.rngState + 0x6d2b79f5;
  stateRef.rngState = s;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Activate bench mode for the given scenario.
 * Seed defaults to a stable value derived from the scenario id so that the
 * same scenario always produces the same RNG sequence.
 */
export function activateBenchMode(scenarioId: BenchScenarioId, seed?: number): void {
  _state.active = true;
  _state.scenarioId = scenarioId;
  _state.done = false;

  const s = seed ?? stableHashScenarioId(scenarioId);
  _state.seed = s;
  _state.rngState = s >>> 0;

  if (_originalRandom === null) {
    _originalRandom = Math.random;
    Math.random = () => mulberry32(_state);
  }
}

/** Deactivate bench mode and restore Math.random to the platform original. */
export function deactivateBenchMode(): void {
  _state.active = false;
  _state.scenarioId = '';
  _state.done = false;
  _state.seed = 0;
  _state.rngState = 0;

  if (_originalRandom !== null) {
    Math.random = _originalRandom;
    _originalRandom = null;
  }
}

/**
 * Mark the scenario as complete.  The BENCH_DONE sentinel becomes visible
 * on the next render cycle (Maestro assertVisible target).
 */
export function markBenchDone(): void {
  if (!_state.active) return;
  _state.done = true;
}

/** True while bench mode is active. */
export function isBenchActive(): boolean {
  return _state.active;
}

/** True after markBenchDone() is called. */
export function isBenchDone(): boolean {
  return _state.done;
}

/** The scenario id passed to activateBenchMode. Empty string when inactive. */
export function getBenchScenarioId(): BenchScenarioId {
  return _state.scenarioId;
}

/** When active, callers should skip audio playback. */
export function isBenchAudioMuted(): boolean {
  return _state.active;
}

/** When active, callers should skip writing to persistent storage. */
export function isBenchSaveMuted(): boolean {
  return _state.active;
}

/** When active, intro scenes and dialogue overlays are bypassed immediately. */
export function isBenchDialogueBypassed(): boolean {
  return _state.active;
}

/**
 * Reset internal state for tests.
 * Restores Math.random if it was patched.
 * @internal
 */
export function _resetBenchModeForTest(): void {
  deactivateBenchMode();
}

// ---------------------------------------------------------------------------
// Env-boot: honor EXPO_PUBLIC_BENCH_MODE=1 baked at EAS build time (E5).
// The scenario id in this case is 'env-boot'; E5 will override via deep link
// after activation to select the specific scenario.
// ---------------------------------------------------------------------------

/* c8 ignore next 6 — env injection is EAS/Metro, not testable in unit env */
if (
  typeof process !== 'undefined' &&
  process.env.EXPO_PUBLIC_BENCH_MODE === '1' &&
  !_state.active
) {
  activateBenchMode('env-boot');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic djb2-style hash of the scenario id string.
 * Produces a stable u32 seed without depending on platform crypto.
 */
function stableHashScenarioId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (((h << 5) + h) ^ id.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}
