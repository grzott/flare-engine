/**
 * Type-level probe, not a bun test: react-native-skia's `Skia` must be
 * assignable to `ShapeAtlasSkia`, so a native caller passes it to
 * `bakeShapeAtlas` with no cast, and a real `SpriteBatch` must be a
 * `ShapeBatchLike`. Checked by the root `bun run typecheck:tests`.
 */
import type { SpriteBatch } from '@flare-engine/render';
import type { Skia, SkRect } from '@shopify/react-native-skia';
import type { ShapeAtlasSkia, ShapeBatchLike } from '../src/atlas.js';

declare const skia: typeof Skia;
declare const spriteBatch: SpriteBatch;

export const atlasSkia: ShapeAtlasSkia = skia;
export const batch: ShapeBatchLike = spriteBatch;

// The installed react-native-skia predates 2.14, so the path surface 2.14
// declares is mirrored here: an immutable path, built through `PathBuilder`.
interface ImmutablePath {
  isEmpty(): boolean;
}

interface PathBuilder {
  moveTo(x: number, y: number): PathBuilder;
  lineTo(x: number, y: number): PathBuilder;
  close(): PathBuilder;
  addArc(oval: SkRect, startAngleInDegrees: number, sweepAngleInDegrees: number): PathBuilder;
  build(): ImmutablePath;
  detach(): ImmutablePath;
}

type BuilderOnlySkia = Omit<typeof Skia, 'Path'> & {
  Path: { Make(): ImmutablePath; MakeFromSVGString(d: string): ImmutablePath | null };
  PathBuilder: { Make(): PathBuilder; MakeFromPath(path: ImmutablePath): PathBuilder };
};

declare const builderOnlySkia: BuilderOnlySkia;

export const builderOnlyAtlasSkia: ShapeAtlasSkia = builderOnlySkia;
