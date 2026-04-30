import { beforeEach, describe, expect, test } from 'bun:test';
import type { Effect } from '@flare-engine/postfx';
import { BUDGET_LIMITS, getBudgetSnapshot, recordBudget } from '../src/fx/budget';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

describe('frame-budget guards', () => {
  beforeEach(() => {
    recordBudget({ draws: 0, particles: 0, postfx: 0 });
  });

  test('BUDGET_LIMITS exports correct design targets', () => {
    expect(BUDGET_LIMITS.draws).toBe(920);
    expect(BUDGET_LIMITS.particles).toBe(480);
    expect(BUDGET_LIMITS.postfx).toBe(3);
  });

  test('recordBudget stores snapshot fields correctly', () => {
    recordBudget({ draws: 100, particles: 50, postfx: 2 });
    const snap = getBudgetSnapshot();
    expect(snap.draws).toBe(100);
    expect(snap.particles).toBe(50);
    expect(snap.postfx).toBe(2);
  });

  test('getBudgetSnapshot returns last recorded values', () => {
    recordBudget({ draws: 500, particles: 200, postfx: 1 });
    recordBudget({ draws: 800, particles: 300, postfx: 3 });
    const snap = getBudgetSnapshot();
    expect(snap.draws).toBe(800);
    expect(snap.particles).toBe(300);
    expect(snap.postfx).toBe(3);
  });

  test('subsequent recordBudget overwrites previous values', () => {
    recordBudget({ draws: 10, particles: 20, postfx: 1 });
    recordBudget({ draws: 42, particles: 0, postfx: 0 });
    expect(getBudgetSnapshot().draws).toBe(42);
  });

  test('chromatic-aberration disabled at rest — active postfx count stays at 3', () => {
    const postfx = createPanTvardowskiPostFx(null);
    const effects = postfx.chain.all();
    let active = 0;
    for (let i = 0; i < effects.length; i++) {
      if ((effects[i] as Effect | undefined)?.enabled) active += 1;
    }
    expect(active).toBe(3);
    expect(active).toBeLessThanOrEqual(BUDGET_LIMITS.postfx);
  });
});
