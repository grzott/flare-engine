import { describe, expect, it } from 'bun:test';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import type { HullPresetId } from '../src/visual-spec/types';

const ALL_IDS: HullPresetId[] = [
  'triangle',
  'circle',
  'square',
  'half-circle',
  'quarter-moon',
  'eighth-moon',
  'trapeze',
  'two-triangles',
  'donut',
  'half-donut',
];

describe('HULL_PRESETS', () => {
  it('has exactly 10 entries, one per HullPresetId', () => {
    const keys = Object.keys(HULL_PRESETS);
    expect(keys.length).toBe(10);
    for (const id of ALL_IDS) {
      expect(HULL_PRESETS[id]).toBeDefined();
      expect(HULL_PRESETS[id].id).toBe(id);
    }
  });

  it('every preset shapes array is non-empty', () => {
    for (const id of ALL_IDS) {
      expect(HULL_PRESETS[id].shapes.length).toBeGreaterThan(0);
    }
  });

  it('every weaponHooks.one has x and y as finite numbers', () => {
    for (const id of ALL_IDS) {
      const { one } = HULL_PRESETS[id].weaponHooks;
      expect(Number.isFinite(one.x)).toBe(true);
      expect(Number.isFinite(one.y)).toBe(true);
    }
  });

  it('weaponHooks.two is a tuple of 2 Pos with symmetric x (left = -right ±0.01)', () => {
    for (const id of ALL_IDS) {
      const [left, right] = HULL_PRESETS[id].weaponHooks.two;
      expect(Number.isFinite(left.x)).toBe(true);
      expect(Number.isFinite(left.y)).toBe(true);
      expect(Number.isFinite(right.x)).toBe(true);
      expect(Number.isFinite(right.y)).toBe(true);
      expect(Math.abs(left.x + right.x)).toBeLessThanOrEqual(0.01);
    }
  });

  it('engineHook.y is negative for all presets; engineOverflow in [0, 1]', () => {
    for (const id of ALL_IDS) {
      const preset = HULL_PRESETS[id];
      expect(preset.engineHook.y).toBeLessThan(0);
      expect(preset.engineOverflow).toBeGreaterThanOrEqual(0);
      expect(preset.engineOverflow).toBeLessThanOrEqual(1);
    }
  });
});
