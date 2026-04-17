import type { StorageAdapter } from './adapter.js';

/**
 * Minimal IDB types used by the adapter. Declared locally so this package does
 * not depend on `lib.dom.d.ts` in its public surface — consumers on the web
 * already have the globals.
 */
interface IDBRequestLike<T> {
  onsuccess: ((this: unknown, ev: unknown) => unknown) | null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null;
  result: T;
  error: unknown;
}

interface IDBOpenRequestLike extends IDBRequestLike<IDBDatabaseLike> {
  onupgradeneeded: ((this: unknown, ev: unknown) => unknown) | null;
}

interface IDBObjectStoreLike {
  get(key: string): IDBRequestLike<unknown>;
  put(value: string, key: string): IDBRequestLike<unknown>;
  delete(key: string): IDBRequestLike<unknown>;
  getAllKeys(): IDBRequestLike<string[]>;
  clear(): IDBRequestLike<unknown>;
}

interface IDBTransactionLike {
  objectStore(name: string): IDBObjectStoreLike;
}

interface IDBDatabaseLike {
  transaction(name: string, mode: 'readonly' | 'readwrite'): IDBTransactionLike;
  createObjectStore(name: string): IDBObjectStoreLike;
  objectStoreNames: { contains(name: string): boolean };
  close(): void;
}

interface IDBFactoryLike {
  open(name: string, version?: number): IDBOpenRequestLike;
}

function getIDB(): IDBFactoryLike {
  const g = globalThis as { indexedDB?: IDBFactoryLike };
  if (!g.indexedDB) {
    throw new Error('[@flare-engine/storage] indexedDB is not available in this environment');
  }
  return g.indexedDB;
}

function openDb(dbName: string, storeName: string): Promise<IDBDatabaseLike> {
  return new Promise((resolve, reject) => {
    const req = getIDB().open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisify<T>(req: IDBRequestLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB-backed adapter for the web. Lazily opens the database on first use;
 * each call opens a fresh transaction and the connection is kept open for the
 * lifetime of the adapter.
 */
export function createIndexedDbAdapter(dbName = 'flare-engine', storeName = 'kv'): StorageAdapter {
  let dbPromise: Promise<IDBDatabaseLike> | null = null;
  const db = (): Promise<IDBDatabaseLike> => {
    if (!dbPromise) dbPromise = openDb(dbName, storeName);
    return dbPromise;
  };

  return {
    async get(key) {
      const store = (await db()).transaction(storeName, 'readonly').objectStore(storeName);
      const raw = await promisify(store.get(key));
      return raw === undefined ? null : (raw as string);
    },
    async set(key, value) {
      const store = (await db()).transaction(storeName, 'readwrite').objectStore(storeName);
      await promisify(store.put(value, key));
    },
    async delete(key) {
      const store = (await db()).transaction(storeName, 'readwrite').objectStore(storeName);
      await promisify(store.delete(key));
    },
    async keys() {
      const store = (await db()).transaction(storeName, 'readonly').objectStore(storeName);
      return promisify(store.getAllKeys());
    },
    async clear() {
      const store = (await db()).transaction(storeName, 'readwrite').objectStore(storeName);
      await promisify(store.clear());
    },
  };
}
