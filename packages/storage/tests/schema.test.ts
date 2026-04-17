import { describe, expect, test } from 'bun:test';
import { s } from '../src/schema.js';

describe('schema primitives', () => {
  test('string accepts strings, rejects others', () => {
    expect(s.string().parse('hi')).toBe('hi');
    expect(s.string().safeParse(1).ok).toBe(false);
    expect(() => s.string().parse(1)).toThrow();
  });

  test('number accepts numbers, rejects NaN and non-numbers', () => {
    expect(s.number().parse(42)).toBe(42);
    expect(s.number().parse(-0)).toBe(-0);
    expect(s.number().safeParse(Number.NaN).ok).toBe(false);
    expect(s.number().safeParse('1').ok).toBe(false);
  });

  test('boolean accepts true/false only', () => {
    expect(s.boolean().parse(true)).toBe(true);
    expect(s.boolean().parse(false)).toBe(false);
    expect(s.boolean().safeParse(0).ok).toBe(false);
  });

  test('literal matches exact value', () => {
    const lit = s.literal('x' as const);
    expect(lit.parse('x')).toBe('x');
    expect(lit.safeParse('y').ok).toBe(false);
  });
});

describe('schema optional/array/object/union', () => {
  test('optional accepts undefined or inner type', () => {
    const opt = s.optional(s.number());
    expect(opt.parse(undefined)).toBeUndefined();
    expect(opt.parse(7)).toBe(7);
    expect(opt.safeParse('x').ok).toBe(false);
  });

  test('array validates every element, rejects non-arrays', () => {
    const arr = s.array(s.number());
    expect(arr.parse([1, 2, 3])).toEqual([1, 2, 3]);
    expect(arr.parse([])).toEqual([]);
    expect(arr.safeParse('nope').ok).toBe(false);
    const r = arr.safeParse([1, 'bad', 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('[1]');
  });

  test('object validates each field and reports path', () => {
    const player = s.object({
      name: s.string(),
      hp: s.number(),
      items: s.array(s.string()),
    });
    const v = player.parse({ name: 'hero', hp: 10, items: ['sword'] });
    expect(v).toEqual({ name: 'hero', hp: 10, items: ['sword'] });

    const bad = player.safeParse({ name: 'hero', hp: 'ten', items: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('hp');
  });

  test('object rejects arrays and null', () => {
    const obj = s.object({ x: s.number() });
    expect(obj.safeParse([]).ok).toBe(false);
    expect(obj.safeParse(null).ok).toBe(false);
  });

  test('union matches any variant', () => {
    const u = s.union(s.string(), s.number());
    expect(u.parse('hi')).toBe('hi');
    expect(u.parse(1)).toBe(1);
    expect(u.safeParse(true).ok).toBe(false);
  });

  test('nested objects produce dotted error paths', () => {
    const nested = s.object({ inner: s.object({ count: s.number() }) });
    const r = nested.safeParse({ inner: { count: 'x' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('inner.count');
  });
});
