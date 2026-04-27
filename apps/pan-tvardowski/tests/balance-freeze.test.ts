import { describe, expect, test } from 'bun:test';
import { BALANCE_FROZEN_AT as GAMEPLAY_FROZEN } from '../src/config/gameplay';
import { BALANCE_FROZEN_AT as ZONES_FROZEN } from '../src/config/zones';

describe('balance freeze — M9.6 session #19', () => {
  test('gameplay.ts exports BALANCE_FROZEN_AT in YYYY-MM-DD form', () => {
    expect(GAMEPLAY_FROZEN).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('zones.ts exports BALANCE_FROZEN_AT in YYYY-MM-DD form', () => {
    expect(ZONES_FROZEN).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('all balance-protected files agree on the freeze date', () => {
    expect(GAMEPLAY_FROZEN).toBe(ZONES_FROZEN);
  });

  test('freeze date parses as a valid calendar date', () => {
    const parsed = new Date(`${GAMEPLAY_FROZEN}T00:00:00Z`);
    expect(Number.isFinite(parsed.getTime())).toBe(true);
    expect(parsed.toISOString().slice(0, 10)).toBe(GAMEPLAY_FROZEN);
  });
});
