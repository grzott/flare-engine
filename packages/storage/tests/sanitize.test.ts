import { describe, expect, test } from 'bun:test';
import { san } from '../src/sanitize.js';

describe('san.string', () => {
  const s = san.string('fallback');

  test('returns string input unchanged', () => {
    expect(s('hello')).toBe('hello');
    expect(s('')).toBe('');
  });

  test('returns fallback for non-string input', () => {
    expect(s(42)).toBe('fallback');
    expect(s(null)).toBe('fallback');
    expect(s(undefined)).toBe('fallback');
    expect(s(true)).toBe('fallback');
    expect(s({})).toBe('fallback');
  });
});

describe('san.number', () => {
  const n = san.number(-1);

  test('returns finite number input unchanged', () => {
    expect(n(0)).toBe(0);
    expect(n(3.14)).toBe(3.14);
    expect(n(-99)).toBe(-99);
  });

  test('returns fallback for NaN', () => {
    expect(n(Number.NaN)).toBe(-1);
  });

  test('returns fallback for Infinity', () => {
    expect(n(Number.POSITIVE_INFINITY)).toBe(-1);
    expect(n(Number.NEGATIVE_INFINITY)).toBe(-1);
  });

  test('returns fallback for non-number input', () => {
    expect(n('5')).toBe(-1);
    expect(n(null)).toBe(-1);
    expect(n(undefined)).toBe(-1);
    expect(n(true)).toBe(-1);
  });
});

describe('san.boolean', () => {
  const b = san.boolean(false);

  test('passes true and false through', () => {
    expect(b(true)).toBe(true);
    expect(b(false)).toBe(false);
  });

  test('returns fallback for non-boolean', () => {
    expect(b(0)).toBe(false);
    expect(b(1)).toBe(false);
    expect(b('true')).toBe(false);
    expect(b(null)).toBe(false);
    expect(b(undefined)).toBe(false);
  });
});

describe('san.literal', () => {
  const options = ['a', 'b', 'c'] as const;
  const l = san.literal(options, 'a');

  test('passes known values through', () => {
    expect(l('a')).toBe('a');
    expect(l('b')).toBe('b');
    expect(l('c')).toBe('c');
  });

  test('returns fallback for unknown value', () => {
    expect(l('d')).toBe('a');
    expect(l('')).toBe('a');
    expect(l(null)).toBe('a');
    expect(l(undefined)).toBe('a');
    expect(l(42)).toBe('a');
  });

  test('works with numeric literals', () => {
    const nums = [1, 2, 3] as const;
    const ln = san.literal(nums, 1);
    expect(ln(2)).toBe(2);
    expect(ln(99)).toBe(1);
  });
});

describe('san.object', () => {
  const schema = san.object({
    name: san.string('unknown'),
    score: san.number(0),
    active: san.boolean(false),
  });

  test('applies each field sanitizer to a valid object', () => {
    expect(schema({ name: 'Alice', score: 100, active: true })).toEqual({
      name: 'Alice',
      score: 100,
      active: true,
    });
  });

  test('uses field fallbacks for missing fields', () => {
    expect(schema({})).toEqual({ name: 'unknown', score: 0, active: false });
  });

  test('uses field fallbacks for invalid field values', () => {
    expect(schema({ name: 42, score: 'bad', active: 1 })).toEqual({
      name: 'unknown',
      score: 0,
      active: false,
    });
  });

  test('drops extra fields not in shape', () => {
    const result = schema({ name: 'Bob', score: 5, active: true, extra: 'ignored' });
    expect(result).toEqual({ name: 'Bob', score: 5, active: true });
    expect('extra' in result).toBe(false);
  });

  test('non-object input returns all-defaults object', () => {
    expect(schema(null)).toEqual({ name: 'unknown', score: 0, active: false });
    expect(schema(undefined)).toEqual({ name: 'unknown', score: 0, active: false });
    expect(schema('string')).toEqual({ name: 'unknown', score: 0, active: false });
    expect(schema(42)).toEqual({ name: 'unknown', score: 0, active: false });
    expect(schema([])).toEqual({ name: 'unknown', score: 0, active: false });
  });

  test('partial input: present fields pass, absent fields default', () => {
    expect(schema({ name: 'Carol' })).toEqual({ name: 'Carol', score: 0, active: false });
  });
});

describe('san.clamped', () => {
  const c = san.clamped(50, 0, 100);

  test('passes in-range value through', () => {
    expect(c(0)).toBe(0);
    expect(c(50)).toBe(50);
    expect(c(100)).toBe(100);
  });

  test('clamps below min to min', () => {
    expect(c(-10)).toBe(0);
  });

  test('clamps above max to max', () => {
    expect(c(200)).toBe(100);
  });

  test('returns fallback for non-number', () => {
    expect(c(null)).toBe(50);
    expect(c('5')).toBe(50);
    expect(c(undefined)).toBe(50);
  });

  test('returns fallback for NaN / Infinity', () => {
    expect(c(Number.NaN)).toBe(50);
    expect(c(Number.POSITIVE_INFINITY)).toBe(50);
  });
});

describe('san.pipe', () => {
  test('chains sanitizer with a transform', () => {
    const intSanitizer = san.pipe(san.number(0), Math.floor);
    expect(intSanitizer(3.9)).toBe(3);
    expect(intSanitizer(3.1)).toBe(3);
    expect(intSanitizer('bad')).toBe(0);
  });

  test('deduplication via pipe', () => {
    const deduped = san.pipe(san.array(san.string('')), (arr) =>
      arr.filter((v, i) => arr.indexOf(v) === i),
    );
    expect(deduped(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('san.array', () => {
  const a = san.array(san.number(0));

  test('transforms each element via item sanitizer', () => {
    expect(a([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('uses item fallback for invalid elements', () => {
    expect(a([1, 'bad', null])).toEqual([1, 0, 0]);
  });

  test('returns [] for non-array input', () => {
    expect(a(null)).toEqual([]);
    expect(a(undefined)).toEqual([]);
    expect(a('hello')).toEqual([]);
    expect(a({})).toEqual([]);
  });

  test('returns [] for empty array', () => {
    expect(a([])).toEqual([]);
  });
});

describe('san.arrayOf', () => {
  function isString(v: unknown): v is string {
    return typeof v === 'string';
  }

  const a = san.arrayOf(isString);

  test('keeps elements that pass the guard', () => {
    expect(a(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  test('drops elements that fail the guard', () => {
    expect(a(['a', 42, null, 'b', undefined, {}])).toEqual(['a', 'b']);
  });

  test('returns [] for non-array input', () => {
    expect(a(null)).toEqual([]);
    expect(a(undefined)).toEqual([]);
    expect(a(42)).toEqual([]);
  });

  test('returns [] when all elements fail', () => {
    expect(a([1, 2, 3])).toEqual([]);
  });

  test('returns [] for empty array', () => {
    expect(a([])).toEqual([]);
  });

  test('works with numeric guard', () => {
    function isFiniteNum(v: unknown): v is number {
      return typeof v === 'number' && Number.isFinite(v);
    }
    const nums = san.arrayOf(isFiniteNum);
    expect(nums([1, 'bad', 2, Number.NaN, 3])).toEqual([1, 2, 3]);
  });
});

describe('san composition — dirty save blob scenario', () => {
  type Status = 'active' | 'inactive';

  function isStatus(v: unknown): v is Status {
    return v === 'active' || v === 'inactive';
  }

  function isPositiveInt(v: unknown): v is number {
    return typeof v === 'number' && Number.isFinite(v) && v > 0 && Number.isInteger(v);
  }

  const parseProfile = san.object({
    name: san.string('anonymous'),
    level: san.pipe(san.clamped(1, 1, 99), Math.floor),
    status: san.literal(['active', 'inactive'] as const, 'inactive'),
    tags: san.arrayOf(isStatus),
    scores: san.arrayOf(isPositiveInt),
  });

  test('sanitizes a clean input end-to-end', () => {
    const result = parseProfile({
      name: 'Hero',
      level: 5,
      status: 'active',
      tags: ['active', 'inactive'],
      scores: [10, 20, 30],
    });
    expect(result).toEqual({
      name: 'Hero',
      level: 5,
      status: 'active',
      tags: ['active', 'inactive'],
      scores: [10, 20, 30],
    });
  });

  test('sanitizes a dirty blob — drops invalid, clamps, defaults', () => {
    const result = parseProfile({
      name: 42,
      level: 150.9,
      status: 'deleted',
      tags: ['active', 'unknown', null, 'inactive'],
      scores: [10, -5, 20, 'bad', Number.NaN, 0],
      extra: 'ignored',
    });
    expect(result.name).toBe('anonymous');
    expect(result.level).toBe(99);
    expect(result.status).toBe('inactive');
    expect(result.tags).toEqual(['active', 'inactive']);
    expect(result.scores).toEqual([10, 20]);
    expect('extra' in result).toBe(false);
  });

  test('null input returns all-defaults', () => {
    const result = parseProfile(null);
    expect(result).toEqual({
      name: 'anonymous',
      level: 1,
      status: 'inactive',
      tags: [],
      scores: [],
    });
  });
});
