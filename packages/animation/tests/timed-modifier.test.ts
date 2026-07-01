import { describe, expect, it } from 'bun:test';
import {
  applyModifier,
  createTimedModifier,
  isModifierActive,
  tickModifier,
} from '../src/timed-modifier.js';

describe('createTimedModifier', () => {
  it('throws when duration is zero', () => {
    expect(() => createTimedModifier(1, 0, (b, m) => b + m)).toThrow('duration must be > 0');
  });

  it('throws when duration is negative', () => {
    expect(() => createTimedModifier(1, -1, (b, m) => b + m)).toThrow('duration must be > 0');
  });

  it('creates modifier with correct fields', () => {
    const combine = (b: number, m: number) => b + m;
    const mod = createTimedModifier(5, 2, combine);
    expect(mod.value).toBe(5);
    expect(mod.remaining).toBe(2);
    expect(mod.combine).toBe(combine);
  });
});

describe('tickModifier', () => {
  it('decrements remaining by dt', () => {
    const mod = createTimedModifier(10, 1, (b, m) => b + m);
    tickModifier(mod, 0.4);
    expect(mod.remaining).toBeCloseTo(0.6, 10);
  });

  it('clamps remaining to 0 — never goes negative', () => {
    const mod = createTimedModifier(10, 0.5, (b, m) => b + m);
    tickModifier(mod, 1.5);
    expect(mod.remaining).toBe(0);
  });

  it('exactly at boundary remaining becomes 0', () => {
    const mod = createTimedModifier(10, 1, (b, m) => b + m);
    tickModifier(mod, 1);
    expect(mod.remaining).toBe(0);
  });
});

describe('isModifierActive', () => {
  it('returns true when remaining > 0', () => {
    const mod = createTimedModifier(1, 2, (b, m) => b + m);
    expect(isModifierActive(mod)).toBe(true);
  });

  it('returns false when remaining == 0', () => {
    const mod = createTimedModifier(1, 1, (b, m) => b + m);
    tickModifier(mod, 1);
    expect(isModifierActive(mod)).toBe(false);
  });
});

describe('applyModifier', () => {
  it('applies combine when active — additive numeric', () => {
    const mod = createTimedModifier(3, 2, (b: number, m: number) => b + m);
    expect(applyModifier(10, mod)).toBe(13);
  });

  it('returns base unchanged when expired (identity)', () => {
    const mod = createTimedModifier(3, 0.1, (b: number, m: number) => b + m);
    tickModifier(mod, 0.5);
    expect(applyModifier(10, mod)).toBe(10);
  });

  it('works with non-numeric T — string concat', () => {
    const mod = createTimedModifier('_suffix', 1, (b: string, m: string) => b + m);
    expect(applyModifier('hello', mod)).toBe('hello_suffix');
    tickModifier(mod, 2);
    expect(applyModifier('hello', mod)).toBe('hello');
  });
});
