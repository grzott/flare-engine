import type { SkiaAtlasModuleLike } from '@flare-engine/assets';
import { Skia } from '@shopify/react-native-skia';

/**
 * The RN-Skia module adapted to the engine's structural atlas interface.
 * Centralises the one boundary assertion so template code stays cast-free.
 */
export const skiaAtlasModule: SkiaAtlasModuleLike = Skia as unknown as SkiaAtlasModuleLike;
