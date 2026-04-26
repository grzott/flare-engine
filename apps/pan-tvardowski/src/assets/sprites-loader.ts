import type { Skia as SkiaModule } from '@shopify/react-native-skia';
import { buildShapeAtlas } from '../shape-atlas';
import type { ShapeAtlas } from '../shape-atlas';
import type { SpritesManifest } from './manifest-types';

type Skia = typeof SkiaModule;

/**
 * Load the sprite atlas described by `manifest`.
 *
 * Dispatch on `entry.kind`:
 *   - `'shape-atlas'` → build the procedural shape atlas from `shape-catalogue.ts`
 *   - `'texture-packer'` → reserved for M9.6 production drop (throws)
 *
 * The manifest must contain exactly one entry. Multiple or zero entries are
 * treated as a configuration error.
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
