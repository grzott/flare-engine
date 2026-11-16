/**
 * Type-level probe, not a bun test: react-native-skia's `Skia` must be
 * assignable to `ShapeAtlasSkia`, so a native caller passes it to
 * `bakeShapeAtlas` with no cast, and a real `SpriteBatch` must be a
 * `ShapeBatchLike`. Checked by the root `bun run typecheck:tests`.
 */
import type { SpriteBatch } from '@flare-engine/render';
import type { Skia } from '@shopify/react-native-skia';
import type { ShapeAtlasSkia, ShapeBatchLike } from '../src/atlas.js';

declare const skia: typeof Skia;
declare const spriteBatch: SpriteBatch;

export const atlasSkia: ShapeAtlasSkia = skia;
export const batch: ShapeBatchLike = spriteBatch;
