import type { StorageAdapter } from './adapter.js';

/**
 * In-memory adapter. Use as a default for tests, SSR, or reduced-persistence
 * modes. State is lost when the process exits.
 */
export function createMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    get(key) {
      const v = store.get(key);
      return Promise.resolve(v === undefined ? null : v);
    },
    set(key, value) {
      store.set(key, value);
      return Promise.resolve();
    },
    delete(key) {
      store.delete(key);
      return Promise.resolve();
    },
    keys() {
      return Promise.resolve([...store.keys()]);
    },
    clear() {
      store.clear();
      return Promise.resolve();
    },
  };
}
