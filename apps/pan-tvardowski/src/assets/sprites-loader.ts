import type { SkImageLike, SpriteFrame, SpriteSheet } from '@flare-engine/assets';
import { parseTexturePackerHash } from '@flare-engine/assets';
import type { Skia as SkiaModule } from '@shopify/react-native-skia';
// Static import so Metro can bundle the JSON without dynamic-require analysis.
import zone1Json from '../../assets/kenney/zone1.json';
import { buildShapeAtlas } from '../shape-atlas';
import type { ShapeAtlas } from '../shape-atlas';
import type { SpriteEntry, SpritesManifest } from './manifest-types';

type Skia = typeof SkiaModule;

/**
 * Atlas handle for the Kenney zone-1 texture-packer atlas.
 * `image` reflects the CURRENT value from the injected `getImage` resolver —
 * it is null during the async PNG-decode window and transitions to a live
 * `SkImageLike` once the decoder completes (KG2 live-image contract).
 */
export interface KenneyAtlasHandle {
  readonly sheet: SpriteSheet;
  readonly image: SkImageLike | null;
}

/**
 * Handle for a single full-image background (kind: 'image').
 * `image` is live (null until PNG resolves, same as KenneyAtlasHandle).
 * `frame` covers the entire image when the image is available, or a zero-size
 * sentinel frame when the image is still null (KG6 must guard on image != null).
 * KG6 (`createZoneImageBg`) consumes this to render the bg sprite.
 */
export interface BgImageHandle {
  readonly image: SkImageLike | null;
  readonly frame: SpriteFrame;
}

export interface GameAtlases {
  readonly shape: ShapeAtlas;
  /**
   * null only when the manifest has no texture-packer entry or its JSON is
   * unknown. NOT null when the PNG is simply not yet decoded — in that case
   * the handle exists and `kenney.image` is null (live-image contract, KG2).
   */
  readonly kenney: KenneyAtlasHandle | null;
  /**
   * null only when the manifest has no image entry for the bg.
   * `bg.image` is null while the PNG is still decoding (live-image contract).
   */
  readonly bg: BgImageHandle | null;
}

/**
 * Image resolver injected by the caller.
 * Device path: wires `useImage` results by entry key.
 * Test/bench path: returns a mock `SkImageLike` or `decodeImage(mockSkia, bytes)`.
 */
export type ImageResolver = (entry: SpriteEntry) => SkImageLike | null;

/**
 * Load all game atlases from the manifest.
 *
 * Dispatches on `entry.kind`:
 *   - `'shape-atlas'` → procedural atlas (uses `skia`; `getImage` not called)
 *   - `'texture-packer'` → parse TP-hash JSON (statically imported by key) +
 *       resolve image via `getImage`
 *   - `'image'` → resolve image via `getImage`; build single-frame handle
 *
 * `getImage` returning null produces a null handle (graceful — no throw).
 * All three entries in the manifest are iterated; entries of unknown kind are
 * silently skipped so future kinds do not break existing callers.
 *
 * NOTE (KG2): `decodeImage` is NOT called here. The loader is agnostic to how
 * the SkImage was obtained — it receives a pre-resolved `SkImageLike` from the
 * injected `getImage`. Device path: `getImage` returns `useImage(require(...))`
 * results. Test/bench path: `getImage` may return a `decodeImage` result or a
 * mock. This separation keeps the loader pure and testable without Skia.
 */
export function loadGameAtlases(
  skia: Skia,
  manifest: SpritesManifest,
  getImage: ImageResolver,
): GameAtlases {
  let shape: ShapeAtlas | null = null;
  let kenney: KenneyAtlasHandle | null = null;
  let bg: BgImageHandle | null = null;

  for (const entry of manifest.entries) {
    if (entry.kind === 'shape-atlas') {
      shape = buildShapeAtlas(skia);
    } else if (entry.kind === 'texture-packer') {
      // JSON is resolved by entry key to keep require() calls static (Metro
      // cannot bundle dynamic template-literal require paths).
      const json = resolvePackerJson(entry.key);
      if (json !== null) {
        // Parse the sheet once and cache it — JSON parsing is a one-time cost.
        // The image is NOT captured here; `get image()` reads the live resolver
        // on every access so late-arriving useImage results are visible to KG3+
        // without re-running bootstrap (KG2 live-image contract).
        const sheet = parseTexturePackerHash(json);
        const capturedEntry = entry;
        kenney = {
          sheet,
          get image(): SkImageLike | null {
            return getImage(capturedEntry);
          },
        };
      }
    } else if (entry.kind === 'image') {
      // Same live-image contract: the handle is created unconditionally; only
      // `image` and `frame` are deferred to read time.
      const capturedEntry = entry;
      bg = {
        get image(): SkImageLike | null {
          return getImage(capturedEntry);
        },
        get frame(): SpriteFrame {
          const img = getImage(capturedEntry);
          return img !== null
            ? { name: capturedEntry.key, x: 0, y: 0, w: img.width(), h: img.height() }
            : { name: capturedEntry.key, x: 0, y: 0, w: 0, h: 0 };
        },
      };
    }
  }

  if (!shape) {
    throw new Error('loadGameAtlases: sprites.manifest.json has no shape-atlas entry');
  }

  return { shape, kenney, bg };
}

/**
 * Resolve the TP-hash JSON for a known entry key.
 * Returns null for unknown keys (graceful skip).
 */
function resolvePackerJson(key: string): unknown {
  if (key === 'kenney-zone1') return zone1Json;
  return null;
}

/**
 * Load the sprite atlas described by `manifest`.
 *
 * Dispatch on `entry.kind`:
 *   - `'shape-atlas'` → build the procedural shape atlas from `visual-spec/shapes-catalogue.ts`
 *   - `'texture-packer'` → reserved for M9.6 production drop (throws)
 *
 * The manifest must contain exactly one entry. Multiple or zero entries are
 * treated as a configuration error.
 *
 * @deprecated Prefer `loadGameAtlases` for multi-atlas manifests (KG2+).
 */
export function loadSpriteAtlas(skia: Skia, manifest: SpritesManifest): ShapeAtlas {
  const entry = manifest.entries[0];
  if (!entry) {
    throw new Error('loadSpriteAtlas: sprites.manifest.json has no entries');
  }
  if (entry.kind === 'shape-atlas') {
    return buildShapeAtlas(skia);
  }
  if (entry.kind === 'texture-packer') {
    throw new Error('texture-packer kind reserved for M9.6 production drop');
  }
  throw new Error(`loadSpriteAtlas: unknown kind "${(entry as { kind: string }).kind}"`);
}
