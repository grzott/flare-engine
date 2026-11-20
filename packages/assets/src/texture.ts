/**
 * Structural shape of the image info a backend's `readPixels` takes. The enum
 * and colour-space values are backend-specific, hence `unknown`.
 */
export interface SkImageInfoLike {
  width: number;
  height: number;
  colorType: unknown;
  alphaType: unknown;
  colorSpace?: unknown;
}

/** Minimal interface for the Skia SkImage we wrap. */
export interface SkImageLike {
  width(): number;
  height(): number;
  /**
   * Declared so that both backends' images are assignable; the arguments are
   * not portable. react-native-skia accepts a call with no arguments, while
   * CanvasKit requires all three, with its own `colorType` / `alphaType` enum
   * values and a `colorSpace`. Call it on the backend's own image type.
   */
  readPixels(
    srcX?: number,
    srcY?: number,
    imageInfo?: SkImageInfoLike,
  ): Float32Array | Uint8Array | null;
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
