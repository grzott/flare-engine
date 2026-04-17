import { describe, expect, test } from 'bun:test';
import { type MMKVLike, createMmkvAdapter } from '../src/mmkv-adapter.js';

function fakeMmkv(): MMKVLike {
  const store = new Map<string, string>();
  return {
    getString: (k) => store.get(k),
    set: (k, v) => {
      store.set(k, v);
    },
    delete: (k) => {
      store.delete(k);
    },
    getAllKeys: () => [...store.keys()],
    clearAll: () => {
      store.clear();
    },
  };
}

describe('mmkv-adapter', () => {
  test('get returns null for missing key', async () => {
    const a = createMmkvAdapter(fakeMmkv());
    expect(await a.get('missing')).toBeNull();
  });

  test('set/get/delete/keys/clear behave like MMKV', async () => {
    const a = createMmkvAdapter(fakeMmkv());
    await a.set('a', '1');
    await a.set('b', '2');
    expect(await a.get('a')).toBe('1');
    expect((await a.keys()).sort()).toEqual(['a', 'b']);
    await a.delete('a');
    expect(await a.get('a')).toBeNull();
    await a.clear();
    expect(await a.keys()).toEqual([]);
  });

  test('empty string is preserved (not collapsed to null)', async () => {
    const a = createMmkvAdapter(fakeMmkv());
    await a.set('k', '');
    expect(await a.get('k')).toBe('');
  });
});
