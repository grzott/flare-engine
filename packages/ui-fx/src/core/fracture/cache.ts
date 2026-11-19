import type { FractureCache, FractureMesh } from './types';

/** A least-recently-used cache for `generateFracture`, holding up to `capacity` meshes. */
export function createFractureCache(capacity = 32): FractureCache {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`createFractureCache: capacity must be an integer >= 1, got ${capacity}`);
  }
  return { capacity, entries: new Map() };
}

/** The mesh stored under `key`, marked as the most recently used. */
export function cachedFracture(cache: FractureCache, key: string): FractureMesh | undefined {
  const mesh = cache.entries.get(key);
  if (mesh !== undefined) {
    // A Map iterates in insertion order, so re-inserting moves the entry to the fresh end.
    cache.entries.delete(key);
    cache.entries.set(key, mesh);
  }
  return mesh;
}

/** Store `mesh` under `key`, evicting the least recently used entry beyond the capacity. */
export function storeFracture(cache: FractureCache, key: string, mesh: FractureMesh): void {
  cache.entries.delete(key);
  cache.entries.set(key, mesh);
  if (cache.entries.size > cache.capacity) {
    for (const oldest of cache.entries.keys()) {
      cache.entries.delete(oldest);
      break;
    }
  }
}
