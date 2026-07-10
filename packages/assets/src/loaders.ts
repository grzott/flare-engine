import type { AssetLoader, ManifestEntry } from './asset-manager.js';
import type { SkImageLike } from './texture.js';
import { createTexture } from './texture.js';

/**
 * Decodes raw image bytes into an SkImage. Returns `null` on failure.
 * Wire it to `decodeImage(Skia, bytes)` (native) or `kit.MakeImageFromEncoded`
 * (CanvasKit / web) — see the package README for both.
 */
export type DecodeImage = (bytes: Uint8Array) => SkImageLike | null;

/** Minimal structural view of a fetch `Response` — only what the loader reads. */
export interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
}

/**
 * Minimal structural `fetch`. The global `fetch` (web / RN / Bun) satisfies it,
 * so the package needs no DOM/Bun fetch typing of its own.
 */
export type FetchLike = (path: string) => Promise<FetchResponseLike>;

/** Options for {@link createFetchAssetLoader}. */
export interface FetchAssetLoaderOptions {
  /** Decodes fetched image bytes into an SkImage. */
  decodeImage: DecodeImage;
  /** `fetch` implementation; defaults to the global `fetch`. */
  fetch?: FetchLike;
}

/** Options for {@link createFileAssetLoader}. */
export interface FileAssetLoaderOptions {
  /**
   * Reads a file path into raw bytes — structural, so any native filesystem
   * (e.g. expo-file-system) satisfies it without a hard dependency here.
   */
  readFile: (path: string) => Promise<Uint8Array>;
  /** Decodes read image bytes into an SkImage. */
  decodeImage: DecodeImage;
}

/**
 * A web `AssetLoader` backed by `fetch`. `texture` entries are decoded into a
 * `Texture`; `binary` yields a `Uint8Array`; `json`/`spritesheet` yield the
 * parsed JSON (feed a spritesheet result to `parseTexturePackerHash` etc.).
 *
 * Fail-fast: a non-OK response or a null decode throws, so `AssetManager.load`
 * rejects. Use `AssetManager.loadManifestSettled` for partial-failure tolerance.
 */
export function createFetchAssetLoader(options: FetchAssetLoaderOptions): AssetLoader {
  const { decodeImage } = options;
  const fetchFn: FetchLike = options.fetch ?? globalThis.fetch;
  return async (entry: ManifestEntry) => {
    const response = await fetchFn(entry.path);
    if (!response.ok) {
      throw new Error(
        `[flare-engine/assets] fetch failed for "${entry.key}" (${entry.path}): ${response.status}`,
      );
    }
    switch (entry.type) {
      case 'texture': {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const image = decodeImage(bytes);
        if (!image) {
          throw new Error(
            `[flare-engine/assets] image decode failed for "${entry.key}" (${entry.path})`,
          );
        }
        return createTexture(entry.key, image);
      }
      case 'binary':
        return new Uint8Array(await response.arrayBuffer());
      default:
        return response.json();
    }
  };
}

/**
 * A native `AssetLoader` backed by an injected `readFile`. `texture` entries are
 * decoded into a `Texture`; `binary` yields the raw `Uint8Array`;
 * `json`/`spritesheet` yield the JSON parsed from UTF-8 bytes.
 *
 * Fail-fast: a null decode (or a rejecting `readFile`) throws.
 */
export function createFileAssetLoader(options: FileAssetLoaderOptions): AssetLoader {
  const { readFile, decodeImage } = options;
  return async (entry: ManifestEntry) => {
    const bytes = await readFile(entry.path);
    switch (entry.type) {
      case 'texture': {
        const image = decodeImage(bytes);
        if (!image) {
          throw new Error(
            `[flare-engine/assets] image decode failed for "${entry.key}" (${entry.path})`,
          );
        }
        return createTexture(entry.key, image);
      }
      case 'binary':
        return bytes;
      default:
        return JSON.parse(new TextDecoder().decode(bytes));
    }
  };
}
