import type { SkImageLike } from './texture.js';

/** Opaque handle for a Skia SkData object. */
export interface SkDataLike {
  readonly __skData: unique symbol;
}

/**
 * Narrow view of the Skia module — only the factories this helper needs.
 * Injected by the caller so @flare-engine/assets stays runtime-agnostic.
 */
export interface SkiaImageDecodeModuleLike {
  Data: {
    fromBytes(bytes: Uint8Array): SkDataLike;
  };
  Image: {
    MakeImageFromEncoded(data: SkDataLike): SkImageLike | null;
  };
}

/**
 * Decode raw image bytes into a Skia SkImage.
 *
 * Returns null on failure — never throws. Callers are responsible for
 * handling null (e.g. falling back to a placeholder texture).
 */
export function decodeImage(
  Skia: SkiaImageDecodeModuleLike,
  bytes: Uint8Array,
): SkImageLike | null {
  const data = Skia.Data.fromBytes(bytes);
  return Skia.Image.MakeImageFromEncoded(data);
}
