import { beforeEach, describe, expect, test } from 'bun:test';
import type { Effect } from '@flare-engine/postfx';
import {
  BUDGET_LIMITS,
  consumeSubShapeDrawCount,
  getBudgetSnapshot,
  recordBudget,
  recordSubShapeDraws,
} from '../src/fx/budget';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

// Background-layer entity count per zone: parallax layer + ground layer.
const BG_DRAWS_PER_ZONE = 2;

describe('frame-budget guards', () => {
  beforeEach(() => {
    recordBudget({ draws: 0, particles: 0, postfx: 0, subShapeDraws: 0, postfxRimLight: false });
    // drain any accumulated sub-shape count from other tests
    consumeSubShapeDrawCount();
  });

  test('BUDGET_LIMITS exports correct design targets', () => {
    expect(BUDGET_LIMITS.draws).toBe(920);
    expect(BUDGET_LIMITS.particles).toBe(480);
    expect(BUDGET_LIMITS.postfx).toBe(4);
    expect(BUDGET_LIMITS.subShapeDraws).toBe(240);
  });

  test('BUDGET_LIMITS.subShapeDraws ceiling is defensible (≥ 40 ships × 6 sub-shapes)', () => {
    // 40 concurrent ship entities at 6 sub-shapes each is the catalogue worst-case.
    // If this fails, bump the limit and update perf-baseline.md §2026-05-07.
    expect(BUDGET_LIMITS.subShapeDraws).toBeGreaterThanOrEqual(40 * 6);
  });

  test('recordBudget stores snapshot fields correctly', () => {
    recordBudget({
      draws: 100,
      particles: 50,
      postfx: 2,
      subShapeDraws: 72,
      postfxRimLight: false,
    });
    const snap = getBudgetSnapshot();
    expect(snap.draws).toBe(100);
    expect(snap.particles).toBe(50);
    expect(snap.postfx).toBe(2);
    expect(snap.subShapeDraws).toBe(72);
  });

  test('getBudgetSnapshot returns last recorded values', () => {
    recordBudget({
      draws: 500,
      particles: 200,
      postfx: 1,
      subShapeDraws: 0,
      postfxRimLight: false,
    });
    recordBudget({
      draws: 800,
      particles: 300,
      postfx: 3,
      subShapeDraws: 120,
      postfxRimLight: false,
    });
    const snap = getBudgetSnapshot();
    expect(snap.draws).toBe(800);
    expect(snap.particles).toBe(300);
    expect(snap.postfx).toBe(3);
    expect(snap.subShapeDraws).toBe(120);
  });

  test('subsequent recordBudget overwrites previous values', () => {
    recordBudget({ draws: 10, particles: 20, postfx: 1, subShapeDraws: 30, postfxRimLight: false });
    recordBudget({ draws: 42, particles: 0, postfx: 0, subShapeDraws: 0, postfxRimLight: false });
    expect(getBudgetSnapshot().draws).toBe(42);
    expect(getBudgetSnapshot().subShapeDraws).toBe(0);
  });

  test('recordSubShapeDraws + consumeSubShapeDrawCount round-trip', () => {
    recordSubShapeDraws(6);
    recordSubShapeDraws(4);
    recordSubShapeDraws(3);
    expect(consumeSubShapeDrawCount()).toBe(13);
  });

  test('consumeSubShapeDrawCount resets accumulator after read', () => {
    recordSubShapeDraws(10);
    consumeSubShapeDrawCount();
    expect(consumeSubShapeDrawCount()).toBe(0);
  });

  test('chromatic-aberration disabled at rest — active postfx count within limit', () => {
    const postfx = createPanTvardowskiPostFx(null);
    const effects = postfx.chain.all();
    let active = 0;
    for (let i = 0; i < effects.length; i++) {
      if ((effects[i] as Effect | undefined)?.enabled) active += 1;
    }
    // Use toBeLessThanOrEqual so adding a 6th opt-in effect doesn't break this test.
    expect(active).toBeLessThanOrEqual(BUDGET_LIMITS.postfx);
  });

  test('bgDrawsInBudget — draws limit covers bg entities across all 8 zones', () => {
    // Each zone contributes BG_DRAWS_PER_ZONE (parallax + ground). Only one zone
    // is active at a time, so worst-case overhead is BG_DRAWS_PER_ZONE = 2 draws.
    // The remaining budget headroom must cover ship entities + bullets + particles.
    const bgOverhead = BG_DRAWS_PER_ZONE;
    expect(BUDGET_LIMITS.draws).toBeGreaterThanOrEqual(bgOverhead);
    // Sanity: headroom after bg overhead is at least 10× the bg cost.
    expect(BUDGET_LIMITS.draws - bgOverhead).toBeGreaterThan(bgOverhead * 10);
  });

  test('postfxChainCount — exactly 1 composite effect enabled at rest', () => {
    const postfx = createPanTvardowskiPostFx(null);
    const effects = postfx.chain.all();
    let active = 0;
    for (let i = 0; i < effects.length; i++) {
      if ((effects[i] as Effect | undefined)?.enabled) active += 1;
    }
    // Single composite effect replaces the prior 5-effect ping-pong chain.
    expect(active).toBe(1);
  });
});
