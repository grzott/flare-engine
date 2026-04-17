import { describe, expect, test } from 'bun:test';
import { createIndexedDbAdapter } from '../src/indexeddb-adapter.js';

describe('indexeddb-adapter', () => {
  test('throws a descriptive error when indexedDB is not available', async () => {
    const g = globalThis as { indexedDB?: unknown };
    const prev = g.indexedDB;
    g.indexedDB = undefined;
    try {
      const a = createIndexedDbAdapter();
      await expect(a.get('k')).rejects.toThrow(/indexedDB is not available/);
    } finally {
      if (prev === undefined) g.indexedDB = undefined;
      else g.indexedDB = prev;
    }
  });

  test('end-to-end roundtrip against a fake indexedDB', async () => {
    const g = globalThis as { indexedDB?: unknown };
    const prev = g.indexedDB;
    g.indexedDB = makeFakeIndexedDB();
    try {
      const a = createIndexedDbAdapter('test-db', 'kv');
      await a.set('a', '1');
      await a.set('b', '2');
      expect(await a.get('a')).toBe('1');
      expect(await a.get('missing')).toBeNull();
      expect((await a.keys()).sort()).toEqual(['a', 'b']);
      await a.delete('a');
      expect(await a.get('a')).toBeNull();
      await a.clear();
      expect(await a.keys()).toEqual([]);
    } finally {
      if (prev === undefined) g.indexedDB = undefined;
      else g.indexedDB = prev;
    }
  });
});

// ——— minimal fake IndexedDB shim for tests ———

type ReqLike = {
  onsuccess: ((ev: unknown) => unknown) | null;
  onerror: ((ev: unknown) => unknown) | null;
  onupgradeneeded?: ((ev: unknown) => unknown) | null;
  result: unknown;
  error: unknown;
};

function makeRequest(result: unknown): ReqLike {
  const req: ReqLike = { onsuccess: null, onerror: null, result, error: null };
  queueMicrotask(() => {
    req.onsuccess?.({});
  });
  return req;
}

function makeFakeIndexedDB() {
  const stores = new Map<string, Map<string, string>>();

  const makeStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const data = stores.get(name)!;
    return {
      get: (k: string) => makeRequest(data.get(k)),
      put: (v: string, k: string) => {
        data.set(k, v);
        return makeRequest(undefined);
      },
      delete: (k: string) => {
        data.delete(k);
        return makeRequest(undefined);
      },
      getAllKeys: () => makeRequest([...data.keys()]),
      clear: () => {
        data.clear();
        return makeRequest(undefined);
      },
    };
  };

  const db = {
    transaction: (name: string) => ({ objectStore: (_n: string) => makeStore(name) }),
    createObjectStore: (name: string) => makeStore(name),
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    close: () => {},
  };

  return {
    open: (_name: string, _version?: number) => {
      const req: ReqLike = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: db,
        error: null,
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.({});
        req.onsuccess?.({});
      });
      return req;
    },
  };
}
