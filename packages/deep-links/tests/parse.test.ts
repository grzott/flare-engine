import { describe, expect, test } from 'bun:test';
import { parseUrl } from '../src/parse.js';

describe('parseUrl', () => {
  test('returns null for empty', () => {
    expect(parseUrl('')).toBeNull();
  });

  test('scheme + host + path + query', () => {
    const p = parseUrl('flare://open/bench/42?mode=free&debug=1');
    expect(p?.scheme).toBe('flare');
    expect(p?.host).toBe('open');
    expect(p?.segments).toEqual(['bench', '42']);
    expect(p?.query).toEqual({ mode: 'free', debug: '1' });
  });

  test('relative /path?q=1', () => {
    const p = parseUrl('/shop/swords?sort=price');
    expect(p?.scheme).toBeNull();
    expect(p?.host).toBeNull();
    expect(p?.segments).toEqual(['shop', 'swords']);
    expect(p?.query).toEqual({ sort: 'price' });
  });

  test('percent-decodes and handles + as space', () => {
    const p = parseUrl('/q?name=Ada+Lovelace&emoji=%F0%9F%9A%80');
    expect(p?.query.name).toBe('Ada Lovelace');
    expect(p?.query.emoji).toBe('🚀');
  });

  test('strips fragment', () => {
    const p = parseUrl('/path?x=1#section');
    expect(p?.query).toEqual({ x: '1' });
  });

  test('value-less query param becomes empty string', () => {
    const p = parseUrl('/p?flag');
    expect(p?.query).toEqual({ flag: '' });
  });

  test('scheme://host with no path uses /', () => {
    const p = parseUrl('flare://home');
    expect(p?.host).toBe('home');
    expect(p?.segments).toEqual([]);
  });
});
