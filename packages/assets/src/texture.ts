/** Minimal interface for the Skia SkImage we wrap. */
export interface SkImageLike {
  width(): number;
  height(): number;
}

/** A loaded texture wrapping a Skia SkImage. */
export interface Texture {
  /** Unique key for this texture in the asset manager. */
  readonly key: string;
  /** The underlying Skia SkImage. */
  readonly image: SkImageLike;
  /** Width in pixels. */
  readonly width: number;
  /** Height in pixels. */
  readonly height: number;
}

/** Create a Texture from a Skia SkImage. */
export function createTexture(key: string, image: SkImageLike): Texture {
  return {
    key,
    image,
    width: image.width(),
    height: image.height(),
  };
}
