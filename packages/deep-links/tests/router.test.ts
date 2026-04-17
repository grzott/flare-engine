import { describe, expect, test } from 'bun:test';
import { DeepLinkRouter } from '../src/router.js';

describe('DeepLinkRouter', () => {
  test('exact literal match', () => {
    const r = new DeepLinkRouter().register('/menu', 'menu');
    expect(r.match('/menu')?.scene).toBe('menu');
    expect(r.match('/other')).toBeNull();
  });

  test('path params are captured', () => {
    const r = new DeepLinkRouter().register('/bench/:id', 'bench');
    const m = r.match('/bench/42');
    expect(m?.scene).toBe('bench');
    expect(m?.params.id).toBe('42');
  });

  test('query params merged; path params win on conflict', () => {
    const r = new DeepLinkRouter().register('/shop/:id', 'shop');
    const m = r.match('/shop/sword?id=other&sort=price');
    expect(m?.params.id).toBe('sword');
    expect(m?.params.sort).toBe('price');
  });

  test('wildcard captures the rest into `rest`', () => {
    const r = new DeepLinkRouter().register('/x/*', 'x');
    const m = r.match('/x/a/b/c');
    expect(m?.params.rest).toBe('a/b/c');
  });

  test('registration order is match order', () => {
    const r = new DeepLinkRouter().register('/a/:x', 'first').register('/a/fixed', 'second');
    expect(r.match('/a/fixed')?.scene).toBe('first');
  });

  test('registerAll adds every route', () => {
    const r = new DeepLinkRouter().registerAll([
      { pattern: '/a', scene: 'A' },
      { pattern: '/b', scene: 'B' },
    ]);
    expect(r.match('/a')?.scene).toBe('A');
    expect(r.match('/b')?.scene).toBe('B');
  });

  test('invalid URL returns null', () => {
    const r = new DeepLinkRouter().register('/x', 'x');
    expect(r.match('')).toBeNull();
  });

  test('length mismatch fails (no partial match)', () => {
    const r = new DeepLinkRouter().register('/a/:x', 'a');
    expect(r.match('/a/1/2')).toBeNull();
  });
});
