import { describe, expect, test } from 'bun:test';
import { formatMessage } from '../src/format.js';

describe('formatMessage', () => {
  test('literal text passes through unchanged', () => {
    expect(formatMessage('hello world', {}, 'en')).toBe('hello world');
  });

  test('simple interpolation', () => {
    expect(formatMessage('Hi, {name}!', { name: 'Ada' }, 'en')).toBe('Hi, Ada!');
  });

  test('missing variables render empty', () => {
    expect(formatMessage('A{x}B', {}, 'en')).toBe('AB');
  });

  test('numbers render via String()', () => {
    expect(formatMessage('{n} points', { n: 42 }, 'en')).toBe('42 points');
  });

  test('plural: English one vs other', () => {
    const tpl = 'You have {count, plural, =0 {no items} one {# item} other {# items}}.';
    expect(formatMessage(tpl, { count: 0 }, 'en')).toBe('You have no items.');
    expect(formatMessage(tpl, { count: 1 }, 'en')).toBe('You have 1 item.');
    expect(formatMessage(tpl, { count: 5 }, 'en')).toBe('You have 5 items.');
  });

  test('plural: Polish few vs many', () => {
    const tpl = '{count, plural, one {# jabłko} few {# jabłka} many {# jabłek}}';
    expect(formatMessage(tpl, { count: 1 }, 'pl')).toBe('1 jabłko');
    expect(formatMessage(tpl, { count: 3 }, 'pl')).toBe('3 jabłka');
    expect(formatMessage(tpl, { count: 5 }, 'pl')).toBe('5 jabłek');
  });

  test('plural falls back to `other` when category is missing', () => {
    const tpl = '{n, plural, other {#}}';
    expect(formatMessage(tpl, { n: 7 }, 'en')).toBe('7');
  });

  test('nested interpolation inside a plural branch', () => {
    const tpl = '{count, plural, one {one {name}} other {many {name}s}}';
    expect(formatMessage(tpl, { count: 1, name: 'apple' }, 'en')).toBe('one apple');
    expect(formatMessage(tpl, { count: 5, name: 'apple' }, 'en')).toBe('many apples');
  });

  test('malformed placeholder emits remainder literally', () => {
    expect(formatMessage('hi {name', { name: 'x' }, 'en')).toBe('hi {name');
  });

  test('unknown formatter falls back to raw var substitution', () => {
    expect(formatMessage('{n, number, usd}', { n: 5 }, 'en')).toBe('5');
  });
});
