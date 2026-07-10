import { describe, expect, it } from 'bun:test';
import { AssetManager, type ManifestEntry } from '../src/asset-manager.js';
import { createFetchAssetLoader, createFileAssetLoader, type FetchLike } from '../src/loaders.js';
import type { SkImageLike, Texture } from '../src/texture.js';

function image(w: number, h: number): SkImageLike {
  return { width: () => w, height: () => h, readPixels: () => null };
}

const manifest: ManifestEntry[] = [
  { key: 'hero', type: 'texture', path: 'hero.png' },
  { key: 'data', type: 'json', path: 'data.json' },
  { key: 'atlas', type: 'spritesheet', path: 'atlas.json' },
  { key: 'level', type: 'binary', path: 'level.bin' },
];

describe('createFetchAssetLoader', () => {
  it('loads texture, json, spritesheet, and binary through AssetManager', async () => {
    const routes: Record<string, () => Response> = {
      'hero.png': () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
      'data.json': () => new Response(JSON.stringify({ hp: 10 })),
      'atlas.json': () => new Response(JSON.stringify({ frames: {} })),
      'level.bin': () => new Response(new Uint8Array([1, 2, 3])),
    };
    const fetchFn: FetchLike = async (path) => {
      const make = routes[path];
      return make ? make() : new Response(null, { status: 404 });
    };
    const loader = createFetchAssetLoader({ decodeImage: () => image(16, 24), fetch: fetchFn });
    const manager = new AssetManager(loader);

    await manager.load(manifest);

    const hero = manager.get<Texture>('hero');
    expect(hero?.width).toBe(16);
    expect(hero?.height).toBe(24);
    expect(manager.get<{ hp: number }>('data')?.hp).toBe(10);
    expect(manager.get<{ frames: unknown }>('atlas')?.frames).toEqual({});
    const bin = manager.get<Uint8Array>('level');
    expect(bin).toBeInstanceOf(Uint8Array);
    expect(Array.from(bin ?? [])).toEqual([1, 2, 3]);
  });

  it('passes decoded bytes: the exact fetched bytes reach decodeImage', async () => {
    const bytes = new Uint8Array([5, 6, 7, 8]);
    const received: Uint8Array[] = [];
    const fetchFn: FetchLike = async () => new Response(bytes);
    const loader = createFetchAssetLoader({
      decodeImage: (b) => {
        received.push(b);
        return image(1, 1);
      },
      fetch: fetchFn,
    });

    await loader({ key: 'x', type: 'texture', path: 'x.png' });

    expect(received).toHaveLength(1);
    expect(Array.from(received[0] ?? [])).toEqual([5, 6, 7, 8]);
  });

  it('throws (fail-fast) on a non-OK response', async () => {
    const fetchFn: FetchLike = async () => new Response(null, { status: 500 });
    const loader = createFetchAssetLoader({ decodeImage: () => image(1, 1), fetch: fetchFn });
    await expect(loader({ key: 'x', type: 'json', path: 'x.json' })).rejects.toThrow();
  });

  it('throws when image decode returns null', async () => {
    const fetchFn: FetchLike = async () => new Response(new Uint8Array([0]));
    const loader = createFetchAssetLoader({ decodeImage: () => null, fetch: fetchFn });
    await expect(loader({ key: 'bad', type: 'texture', path: 'bad.png' })).rejects.toThrow();
  });
});

describe('createFileAssetLoader', () => {
  it('loads texture, json, spritesheet, and binary through AssetManager', async () => {
    const enc = new TextEncoder();
    const files: Record<string, Uint8Array> = {
      'hero.png': new Uint8Array([0x89, 0x50]),
      'data.json': enc.encode(JSON.stringify({ hp: 7 })),
      'atlas.json': enc.encode(JSON.stringify({ frames: [] })),
      'level.bin': new Uint8Array([9, 8, 7]),
    };
    const readFile = async (path: string): Promise<Uint8Array> => {
      const f = files[path];
      if (!f) throw new Error(`no such file: ${path}`);
      return f;
    };
    const loader = createFileAssetLoader({ readFile, decodeImage: () => image(8, 8) });
    const manager = new AssetManager(loader);

    await manager.load(manifest);

    expect(manager.get<Texture>('hero')?.height).toBe(8);
    expect(manager.get<{ hp: number }>('data')?.hp).toBe(7);
    expect(manager.get<{ frames: unknown[] }>('atlas')?.frames).toEqual([]);
    expect(Array.from(manager.get<Uint8Array>('level') ?? [])).toEqual([9, 8, 7]);
  });

  it('throws when decode returns null (fail-fast)', async () => {
    const readFile = async (): Promise<Uint8Array> => new Uint8Array([0]);
    const loader = createFileAssetLoader({ readFile, decodeImage: () => null });
    await expect(loader({ key: 'bad', type: 'texture', path: 'bad.png' })).rejects.toThrow();
  });

  it('propagates a rejecting readFile (fail-fast)', async () => {
    const readFile = async (): Promise<Uint8Array> => {
      throw new Error('enoent');
    };
    const loader = createFileAssetLoader({ readFile, decodeImage: () => image(1, 1) });
    await expect(loader({ key: 'x', type: 'json', path: 'x.json' })).rejects.toThrow('enoent');
  });
});
