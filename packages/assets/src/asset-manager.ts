import { Signal } from '@flare-engine/events';
import type { SpriteSheet } from './sprite-sheet.js';
import type { Texture } from './texture.js';

/** Types of assets the manager can store. */
export type AssetType = 'texture' | 'spritesheet' | 'json' | 'binary';

/** A single entry in an asset manifest. */
export interface ManifestEntry {
  /** Unique key to retrieve this asset. */
  key: string;
  /** Asset type. */
  type: AssetType;
  /** Path or URI to the asset. */
  path: string;
}

/** A load function provided by the platform to actually fetch+decode assets. */
export type AssetLoader = (entry: ManifestEntry) => Promise<Texture | SpriteSheet | unknown>;

/** A single entry that failed during {@link AssetManager.loadManifestSettled}. */
export interface ManifestLoadFailure {
  /** Key of the manifest entry that failed. */
  key: string;
  /** The value thrown by the loader (an `Error` or otherwise). */
  error: unknown;
}

/** Partial-failure summary returned by {@link AssetManager.loadManifestSettled}. */
export interface ManifestLoadResult {
  /** Keys of entries that loaded and were cached. */
  loaded: string[];
  /** Entries that threw, with the captured error. */
  failed: ManifestLoadFailure[];
}

/**
 * AssetManager — loads, caches, and provides access to game assets.
 *
 * Platform-agnostic: the actual loading is delegated to an `AssetLoader`
 * function injected at construction. This allows Skia-dependent texture
 * loading to live in the React layer while keeping this module testable.
 */
export class AssetManager {
  /** Fires on each asset loaded with current progress (0-1). */
  readonly onProgress = new Signal<number>();

  /** Current loading progress 0-1. */
  progress = 0;

  private _assets = new Map<string, unknown>();
  private _loader: AssetLoader;

  constructor(loader: AssetLoader) {
    this._loader = loader;
  }

  /**
   * Load all assets in the manifest.
   * Resolves when all assets are loaded and cached.
   */
  async load(manifest: ManifestEntry[]): Promise<void> {
    if (manifest.length === 0) {
      this.progress = 1;
      this.onProgress.emit(1);
      return;
    }

    let loaded = 0;
    const total = manifest.length;

    const promises = manifest.map(async (entry) => {
      const asset = await this._loader(entry);
      this._assets.set(entry.key, asset);
      loaded++;
      this.progress = loaded / total;
      this.onProgress.emit(this.progress);
    });

    await Promise.all(promises);
  }

  /**
   * Load all assets without rejecting on the first failure. Successful assets
   * are cached; failures are collected and returned. Progress still advances to
   * 1 once every entry has settled. Prefer this over {@link load} when a partial
   * asset set is acceptable (e.g. optional/decorative assets).
   */
  async loadManifestSettled(manifest: ManifestEntry[]): Promise<ManifestLoadResult> {
    const loaded: string[] = [];
    const failed: ManifestLoadFailure[] = [];

    if (manifest.length === 0) {
      this.progress = 1;
      this.onProgress.emit(1);
      return { loaded, failed };
    }

    let settled = 0;
    const total = manifest.length;

    const promises = manifest.map(async (entry) => {
      try {
        const asset = await this._loader(entry);
        this._assets.set(entry.key, asset);
        loaded.push(entry.key);
      } catch (error) {
        failed.push({ key: entry.key, error });
      } finally {
        settled++;
        this.progress = settled / total;
        this.onProgress.emit(this.progress);
      }
    });

    await Promise.all(promises);
    return { loaded, failed };
  }

  /** Get a loaded asset by key. Returns undefined if not found. */
  get<T = unknown>(key: string): T | undefined {
    return this._assets.get(key) as T | undefined;
  }

  /** Check if an asset is loaded. */
  has(key: string): boolean {
    return this._assets.has(key);
  }

  /** Remove an asset from the cache. */
  unload(key: string): boolean {
    return this._assets.delete(key);
  }

  /** Clear all cached assets. */
  clear(): void {
    this._assets.clear();
    this.progress = 0;
  }
}
