import { createFrameBudget } from '@flare-engine/debug';
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
  // 4 enabled effects per zone: vignette + bloom + grayscale-flash + weather-X.
  postfx: 4,
  // 40 concurrent ship entities × 6 sub-shapes max (hull + 4 weapons + engine).
  // Derived from catalogue worst-case (Boruta/Lucyper: 6 sub-shapes each).
  // Revisit if a future zone adds a 7th-sub-shape boss.
  subShapeDraws: 240,
} as const;

const _budget = createFrameBudget({
  limits: { ...BUDGET_LIMITS },
  fpsThreshold: 55,
  ringSize: 180,
  debug: true,
});

const _lastSnapshot: BudgetSnapshot = {
  draws: 0,
  particles: 0,
  postfx: 0,
  subShapeDraws: 0,
};
let _watchdogDropped = false;

export function recordBudget(s: BudgetSnapshot): void {
  _lastSnapshot.draws = s.draws;
  _lastSnapshot.particles = s.particles;
  _lastSnapshot.postfx = s.postfx;
  _lastSnapshot.subShapeDraws = s.subShapeDraws;
  _budget.recordCounters({
    draws: s.draws,
    particles: s.particles,
    postfx: s.postfx,
    subShapeDraws: s.subShapeDraws,
  });
}

export function getBudgetSnapshot(): Readonly<BudgetSnapshot> {
  return _lastSnapshot;
}

export function recordFrameTime(dtSec: number): void {
  _budget.recordFrame(dtSec);
}

export function getAvgFps(): number {
  return _budget.getAvgFps();
}

export function resetFpsRing(): void {
  _watchdogDropped = false;
  _budget.resetFpsRing();
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
  if (_watchdogDropped) return false;
  if (_budget.getAvgFps() === 0) return false;
  if (_budget.getAvgFps() < 55) {
    _watchdogDropped = true;
    postfx.chain.setEnabled('chromatic-aberration', false);
    postfx.chain.setEnabled('crt', false);
    return true;
  }
  return false;
}
