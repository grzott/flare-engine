import { describe, expect, it } from 'bun:test';
import type { AssetLoader, ManifestEntry } from '../src/asset-manager.js';
import { AssetManager } from '../src/asset-manager.js';

function createMockLoader(): AssetLoader {
  return async (entry: ManifestEntry) => {
    return { type: entry.type, path: entry.path };
  };
}

describe('AssetManager', () => {
  it('loads manifest and caches assets', async () => {
    const manager = new AssetManager(createMockLoader());
    const manifest: ManifestEntry[] = [
      { key: 'hero', type: 'texture', path: 'hero.png' },
      { key: 'data', type: 'json', path: 'data.json' },
    ];
    await manager.load(manifest);
    expect(manager.has('hero')).toBe(true);
    expect(manager.has('data')).toBe(true);
    expect(manager.progress).toBe(1);
  });

  it('get returns cached asset', async () => {
    const manager = new AssetManager(createMockLoader());
    await manager.load([{ key: 'test', type: 'json', path: 'test.json' }]);
    const asset = manager.get<{ type: string; path: string }>('test');
    expect(asset?.type).toBe('json');
    expect(asset?.path).toBe('test.json');
  });

  it('get returns undefined for missing key', () => {
    const manager = new AssetManager(createMockLoader());
    expect(manager.get('nope')).toBeUndefined();
  });

  it('emits progress during load', async () => {
    const manager = new AssetManager(createMockLoader());
    const progressValues: number[] = [];
    manager.onProgress.add((p) => progressValues.push(p));

    await manager.load([
      { key: 'a', type: 'texture', path: 'a.png' },
      { key: 'b', type: 'texture', path: 'b.png' },
    ]);

    // Both resolve near-simultaneously in mock, but we should have 2 progress emits
    expect(progressValues).toHaveLength(2);
    expect(progressValues[progressValues.length - 1]).toBe(1);
  });

  it('handles empty manifest', async () => {
    const manager = new AssetManager(createMockLoader());
    const progressValues: number[] = [];
    manager.onProgress.add((p) => progressValues.push(p));
    await manager.load([]);
    expect(manager.progress).toBe(1);
    expect(progressValues).toEqual([1]);
  });

  it('unload removes asset', async () => {
    const manager = new AssetManager(createMockLoader());
    await manager.load([{ key: 'x', type: 'json', path: 'x.json' }]);
    expect(manager.has('x')).toBe(true);
    const removed = manager.unload('x');
    expect(removed).toBe(true);
    expect(manager.has('x')).toBe(false);
  });

  it('unload returns false for missing key', () => {
    const manager = new AssetManager(createMockLoader());
    expect(manager.unload('missing')).toBe(false);
  });

  it('clear removes all assets', async () => {
    const manager = new AssetManager(createMockLoader());
    await manager.load([
      { key: 'a', type: 'texture', path: 'a.png' },
      { key: 'b', type: 'json', path: 'b.json' },
    ]);
    manager.clear();
    expect(manager.has('a')).toBe(false);
    expect(manager.has('b')).toBe(false);
    expect(manager.progress).toBe(0);
  });

  describe('loadManifestSettled', () => {
    it('caches successes and surfaces failures typed, without rejecting', async () => {
      const loader: AssetLoader = async (entry: ManifestEntry) => {
        if (entry.key === 'bad') throw new Error(`boom: ${entry.key}`);
        return { path: entry.path };
      };
      const manager = new AssetManager(loader);

      const result = await manager.loadManifestSettled([
        { key: 'good1', type: 'json', path: 'a.json' },
        { key: 'bad', type: 'texture', path: 'b.png' },
        { key: 'good2', type: 'json', path: 'c.json' },
      ]);

      expect([...result.loaded].sort()).toEqual(['good1', 'good2']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.key).toBe('bad');
      const firstError = result.failed[0]?.error;
      expect(firstError).toBeInstanceOf(Error);
      expect((firstError as Error).message).toBe('boom: bad');
      expect(manager.has('good1')).toBe(true);
      expect(manager.has('good2')).toBe(true);
      expect(manager.has('bad')).toBe(false);
      expect(manager.progress).toBe(1);
    });

    it('handles an all-fail manifest and still reaches progress 1', async () => {
      const loader: AssetLoader = async () => {
        throw new Error('nope');
      };
      const manager = new AssetManager(loader);

      const result = await manager.loadManifestSettled([
        { key: 'x', type: 'json', path: 'x.json' },
      ]);

      expect(result.loaded).toEqual([]);
      expect(result.failed).toHaveLength(1);
      expect(manager.progress).toBe(1);
    });

    it('handles an empty manifest', async () => {
      const manager = new AssetManager(createMockLoader());
      const progressValues: number[] = [];
      manager.onProgress.add((p) => progressValues.push(p));

      const result = await manager.loadManifestSettled([]);

      expect(result.loaded).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(manager.progress).toBe(1);
      expect(progressValues).toEqual([1]);
    });
  });
});
