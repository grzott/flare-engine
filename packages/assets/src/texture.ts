/** Minimal interface for the Skia SkImage we wrap. */
export interface SkImageLike {
  width(): number;
  height(): number;
  readPixels(): Float32Array | Uint8Array | null;
  /**
   * Optional — present on GPU-backed SkImages returned by RN-Skia's
   * MakeOffscreen surfaces. Copies the texture into a CPU-raster image so it
   * can be safely sampled from a different GrDirectContext (e.g. the on-screen
   * Canvas). Must be called before the image crosses a context boundary.
   */
  makeNonTextureImage?(): SkImageLike;
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
