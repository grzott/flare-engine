/**
 * Type-level probe, not a bun test: a CanvasKit `Image` and a
 * react-native-skia `SkImage` must both be assignable to `SkImageLike`, so a
 * caller on either backend passes its image to `createTexture` with no cast.
 * Checked by the root `bun run typecheck:tests`.
 */
import type { SkImage } from '@shopify/react-native-skia';
import type { Image } from 'canvaskit-wasm';
import { createTexture, type SkImageLike, type Texture } from '../src/texture.js';

declare const canvasKitImage: Image;
declare const nativeImage: SkImage;

export const fromCanvasKit: SkImageLike = canvasKitImage;
export const fromNative: SkImageLike = nativeImage;

export const canvasKitTexture: Texture = createTexture('web', canvasKitImage);
export const nativeTexture: Texture = createTexture('native', nativeImage);
