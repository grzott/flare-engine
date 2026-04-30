import type { PostFxController } from './postfx';

export interface BudgetSnapshot {
  draws: number;
  particles: number;
  postfx: number;
}

export const BUDGET_LIMITS = {
  draws: 920,
  particles: 480,
  postfx: 3,
} as const;

const BUDGET_DEBUG = true;

const _lastSnapshot: BudgetSnapshot = { draws: 0, particles: 0, postfx: 0 };

const FPS_RING_SIZE = 180;
const _fpsRing = new Float32Array(FPS_RING_SIZE);
let _fpsHead = 0;
let _fpsFilled = 0;
let _watchdogDropped = false;

export function recordBudget(s: BudgetSnapshot): void {
  _lastSnapshot.draws = s.draws;
  _lastSnapshot.particles = s.particles;
  _lastSnapshot.postfx = s.postfx;

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

export function checkFpsWatchdog(postfx: PostFxController): boolean {
  if (_fpsFilled < FPS_RING_SIZE) return false;
  if (_watchdogDropped) return false;
  if (getAvgFps() < 55) {
    _watchdogDropped = true;
    postfx.chain.setEnabled('chromatic-aberration', false);
    return true;
  }
  return false;
}
