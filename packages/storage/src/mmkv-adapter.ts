import type { StorageAdapter } from './adapter.js';

/**
 * Minimal subset of `react-native-mmkv`'s `MMKV` class consumed by the adapter.
 * Declared locally so this package does not take a peer dep on `react-native-mmkv`
 * at type-check time — callers instantiate MMKV themselves and pass it in.
 */
export interface MMKVLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  getAllKeys(): string[];
  clearAll(): void;
}

/**
 * Wrap a `react-native-mmkv` instance as a `StorageAdapter`. All operations are
 * synchronous under the hood; promises resolve immediately.
 */
export function createMmkvAdapter(mmkv: MMKVLike): StorageAdapter {
  return {
    get(key) {
      const v = mmkv.getString(key);
      return Promise.resolve(v === undefined ? null : v);
    },
    set(key, value) {
      mmkv.set(key, value);
      return Promise.resolve();
    },
    delete(key) {
      mmkv.delete(key);
      return Promise.resolve();
    },
    keys() {
      return Promise.resolve(mmkv.getAllKeys());
    },
    clear() {
      mmkv.clearAll();
      return Promise.resolve();
    },
  };
}
