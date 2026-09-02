import { describe, expect, test } from 'bun:test';
import { parseUrl } from '../src/parse.js';

describe('parseUrl', () => {
  test('returns null for empty', () => {
    expect(parseUrl('')).toBeNull();
  });

  test('custom scheme: entire post-:// remainder is path', () => {
    const p = parseUrl('flare://open/bench/42?mode=free&debug=1');
    expect(p?.scheme).toBe('flare');
    expect(p?.host).toBe('');
    expect(p?.segments).toEqual(['open', 'bench', '42']);
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

  test('custom scheme with single segment: host is empty, segment is captured', () => {
    const p = parseUrl('flare://home');
    expect(p?.host).toBe('');
    expect(p?.segments).toEqual(['home']);
  });

  test('custom scheme: myapp://zone/4', () => {
    const p = parseUrl('myapp://zone/4');
    expect(p?.scheme).toBe('myapp');
    expect(p?.host).toBe('');
    expect(p?.segments).toEqual(['zone', '4']);
  });

  test('http scheme: extracts authority into host', () => {
    const p = parseUrl('https://example.com/zone/4');
    expect(p?.scheme).toBe('https');
    expect(p?.host).toBe('example.com');
    expect(p?.segments).toEqual(['zone', '4']);
  });

  test('http scheme: no path yields empty segments', () => {
    const p = parseUrl('https://example.com');
    expect(p?.host).toBe('example.com');
    expect(p?.segments).toEqual([]);
  });

  test('http scheme: query-only URL does not fold query into host', () => {
    const p = parseUrl('https://example.com?x=1');
    expect(p?.host).toBe('example.com');
    expect(p?.segments).toEqual([]);
    expect(p?.query).toEqual({ x: '1' });
  });

  test('scheme guard: :// inside query string is not treated as scheme', () => {
    const p = parseUrl('/redirect?to=http://x.com');
    expect(p?.scheme).toBeNull();
    expect(p?.host).toBeNull();
    expect(p?.segments).toEqual(['redirect']);
    expect(p?.query).toEqual({ to: 'http://x.com' });
  });

  test('tri-state: custom scheme yields host=="" and relative yields host===null', () => {
    const custom = parseUrl('myapp://home');
    const relative = parseUrl('/shop/x');
    expect(custom?.host).toBe('');
    expect(relative?.host).toBeNull();
    expect(custom?.host).not.toBeNull();
    expect(relative?.host).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// OSS-B23b — query keys come from the URL, so a plain object literal answers
// `params.constructor` / `params.toString` with an inherited value for a link
// that never carried that key. A consumer doing `if (params.constructor)` on a
// route with no such param got a truthy function.
// ---------------------------------------------------------------------------

describe('parseUrl — null-prototype query (B23b)', () => {
  test('does not expose inherited Object.prototype keys', () => {
    const parsed = parseUrl('app://open?id=7');
    expect(parsed).not.toBeNull();
    const q = parsed!.query as Record<string, unknown>;
    expect(q.id).toBe('7');
    // Old: these returned Object's constructor / toString.
    expect(q.constructor).toBeUndefined();
    expect(q.toString).toBeUndefined();
    expect(q.hasOwnProperty).toBeUndefined();
    expect(Object.getPrototypeOf(parsed!.query)).toBeNull();
  });

  test('a __proto__ query key does not reach the prototype', () => {
    const parsed = parseUrl('app://open?__proto__=polluted&ok=1');
    expect(parsed).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(parsed!.query.ok).toBe('1');
  });
});
