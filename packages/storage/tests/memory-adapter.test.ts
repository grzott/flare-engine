import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '../src/memory-adapter.js';

describe('memory-adapter', () => {
  test('get on missing key returns null', async () => {
    const a = createMemoryAdapter();
    expect(await a.get('missing')).toBeNull();
  });

  test('set then get roundtrips', async () => {
    const a = createMemoryAdapter();
    await a.set('k', 'v');
    expect(await a.get('k')).toBe('v');
  });

  test('overwrite replaces previous value', async () => {
    const a = createMemoryAdapter();
    await a.set('k', '1');
    await a.set('k', '2');
    expect(await a.get('k')).toBe('2');
  });

  test('delete removes the key', async () => {
    const a = createMemoryAdapter();
    await a.set('k', 'v');
    await a.delete('k');
    expect(await a.get('k')).toBeNull();
  });

  test('delete missing key is a no-op', async () => {
    const a = createMemoryAdapter();
    await a.delete('missing');
    expect(await a.get('missing')).toBeNull();
  });

  test('keys lists all present keys', async () => {
    const a = createMemoryAdapter();
    await a.set('a', '1');
    await a.set('b', '2');
    const ks = await a.keys();
    expect(ks.sort()).toEqual(['a', 'b']);
  });

  test('clear removes everything', async () => {
    const a = createMemoryAdapter();
    await a.set('a', '1');
    await a.set('b', '2');
    await a.clear();
    expect(await a.keys()).toEqual([]);
  });

  test('stores empty string (distinct from missing)', async () => {
    const a = createMemoryAdapter();
    await a.set('k', '');
    expect(await a.get('k')).toBe('');
  });

  test('adapters are independent', async () => {
    const a = createMemoryAdapter();
    const b = createMemoryAdapter();
    await a.set('k', 'v');
    expect(await b.get('k')).toBeNull();
  });
});
