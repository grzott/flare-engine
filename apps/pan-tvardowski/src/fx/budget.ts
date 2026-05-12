import type { PostFxController } from './postfx';

export interface BudgetSnapshot {
  draws: number;
  particles: number;
  postfx: number;
  subShapeDraws: number;
}

export const BUDGET_LIMITS = {
  // +2 bg entities per zone (parallax + ground layer), worst-case Z1-Z8 = 2 draws.
  draws: 920,
  particles: 480,
  postfx: 3,
  // 40 concurrent ship entities × 6 sub-shapes max (hull + 4 weapons + engine).
  // Derived from catalogue worst-case (Boruta/Lucyper: 6 sub-shapes each).
  // Revisit if a future zone adds a 7th-sub-shape boss.
  subShapeDraws: 240,
} as const;

const BUDGET_DEBUG = true;

const _lastSnapshot: BudgetSnapshot = { draws: 0, particles: 0, postfx: 0, subShapeDraws: 0 };

const FPS_RING_SIZE = 180;
const _fpsRing = new Float32Array(FPS_RING_SIZE);
let _fpsHead = 0;
let _fpsFilled = 0;
let _watchdogDropped = false;

export function recordBudget(s: BudgetSnapshot): void {
  _lastSnapshot.draws = s.draws;
  _lastSnapshot.particles = s.particles;
  _lastSnapshot.postfx = s.postfx;
  _lastSnapshot.subShapeDraws = s.subShapeDraws;

  if (BUDGET_DEBUG) {
    if (s.draws > BUDGET_LIMITS.draws) {
      console.warn(`[budget] draws over limit: ${s.draws} > ${BUDGET_LIMITS.draws}`);
    }
    if (s.particles > BUDGET_LIMITS.particles) {
      console.warn(`[budget] particles over limit: ${s.particles} > ${BUDGET_LIMITS.particles}`);
    }
    if (s.postfx > BUDGET_LIMITS.postfx) {
      console.warn(`[budget] postfx over limit: ${s.postfx} > ${BUDGET_LIMITS.postfx}`);
    }
    if (s.subShapeDraws > BUDGET_LIMITS.subShapeDraws) {
      console.warn(
        `[budget] subShapeDraws over limit: ${s.subShapeDraws} > ${BUDGET_LIMITS.subShapeDraws}`,
      );
    }
  }
}

export function getBudgetSnapshot(): Readonly<BudgetSnapshot> {
  return _lastSnapshot;
}

export function recordFrameTime(dtSec: number): void {
  _fpsRing[_fpsHead] = dtSec;
  _fpsHead = (_fpsHead + 1) % FPS_RING_SIZE;
  if (_fpsFilled < FPS_RING_SIZE) _fpsFilled += 1;
}

export function getAvgFps(): number {
  if (_fpsFilled < FPS_RING_SIZE) return 0;
  let sum = 0;
  for (let i = 0; i < FPS_RING_SIZE; i++) {
    sum += _fpsRing[i] ?? 0;
  }
  const avgDt = sum / FPS_RING_SIZE;
  return avgDt > 0 ? 1 / avgDt : 0;
}

export function resetFpsRing(): void {
  _fpsHead = 0;
  _fpsFilled = 0;
  _watchdogDropped = false;
  _fpsRing.fill(0);
}

/** Accumulates sub-shape logical draw count for the current frame. */
let _subShapeAccum = 0;

/**
 * Add `count` sub-shape logical draws to the current frame's accumulator.
 * Called once per ship entity each frame from play.ts. Zero-alloc.
 */
export function recordSubShapeDraws(count: number): void {
  _subShapeAccum += count;
}

/**
 * Read and reset the sub-shape accumulator. Call once per frame in the
 * budget block to drain the value into `BudgetSnapshot.subShapeDraws`.
 */
export function consumeSubShapeDrawCount(): number {
  const v = _subShapeAccum;
  _subShapeAccum = 0;
  return v;
}

export function checkFpsWatchdog(postfx: PostFxController): boolean {
  if (_fpsFilled < FPS_RING_SIZE) return false;
  if (_watchdogDropped) return false;
  if (getAvgFps() < 55) {
    _watchdogDropped = true;
    postfx.chain.setEnabled('chromatic-aberration', false);
    postfx.chain.setEnabled('crt', false);
    return true;
  }
  return false;
}
