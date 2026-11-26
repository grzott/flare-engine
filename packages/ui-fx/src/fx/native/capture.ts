import {
  FilterMode,
  MipmapMode,
  makeImageFromView,
  type SkImage,
  Skia,
} from '@shopify/react-native-skia';
import type { RefObject } from 'react';
import { PixelRatio } from 'react-native';
import type { FxImage } from '../../runtime/contracts';

/** `image` redrawn at `width` by `height`, or `null` when no surface can be made. */
function downscale(image: SkImage, width: number, height: number): SkImage | null {
  // A raster surface: its snapshot is a CPU image, which any canvas can sample.
  const surface = Skia.Surface.Make(width, height);
  if (surface === null) return null;
  surface
    .getCanvas()
    .drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(0, 0, width, height),
      FilterMode.Linear,
      MipmapMode.None,
    );
  surface.flush();
  const scaled = surface.makeImageSnapshot();
  surface.dispose();
  return scaled;
}

/**
 * Capture the view behind `ref` with `makeImageFromView`. Resolves `null` when no capture can be
 * taken; it never rejects.
 *
 * `ref` must be a view that is `collapsable={false}`, and that reaches `padding` layout pixels
 * beyond the element on every side: `makeImageFromView` draws only what is inside the view's
 * bounds, which an `elevation` or `boxShadow` shadow is not (C36). `FxCaptureRoot` is such a view.
 *
 * A capture longer than `maxPx` image pixels on its longer side is redrawn to that size, and its
 * `pixelRatio` drops to match.
 */
export async function captureView(
  ref: RefObject<unknown>,
  maxPx: number,
  padding: number,
): Promise<FxImage | null> {
  let image: SkImage | null | undefined;
  try {
    // RN-Skia types the ref as a native tag or a class component. A host view's ref is neither
    // by type, and is what `findNodeHandle` takes.
    image = await makeImageFromView(ref as RefObject<number | null>);
  } catch {
    return null;
  }
  if (image == null) return null;

  const width = image.width();
  const height = image.height();
  const longest = Math.max(width, height);
  const pixelRatio = PixelRatio.get();
  if (longest <= maxPx) return { width, height, pixelRatio, padding, handle: image };

  const scale = maxPx / longest;
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  const scaled = downscale(image, scaledWidth, scaledHeight);
  // A full-screen capture at pixel ratio 3 is tens of megabytes.
  image.dispose();
  if (scaled === null) return null;
  return {
    width: scaledWidth,
    height: scaledHeight,
    pixelRatio: pixelRatio * scale,
    padding,
    handle: scaled,
  };
}
