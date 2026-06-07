import { drawShape, shapeBoundsRadius } from '@flare-engine/shapes';
import type { ShapeSpec } from '@flare-engine/shapes';
import type { Skia as SkiaModule } from '@shopify/react-native-skia';

type Skia = typeof SkiaModule;

export interface FrameBuild {
  name: string;
  w: number;
  h: number;
  draw: (Skia: Skia, canvas: import('@shopify/react-native-skia').SkCanvas) => void;
}

/** Shared scratch Float32Array for ARGB→RGBA unpacking. Single module-level instance. */
export const ATLAS_COLOR = new Float32Array(4);

export function addShapeEntity(
  frames: FrameBuild[],
  name: string,
  specs: readonly ShapeSpec[],
): void {
  const radius = shapeBoundsRadius(specs);
  const side = Math.ceil(radius * 2);
  frames.push({
    name,
    w: side,
    h: side,
    draw: (Skia, canvas) => {
      const paint = Skia.Paint();
      for (const spec of specs) {
        drawShape(Skia, canvas, paint, spec, side / 2, side / 2, 0);
      }
    },
  });
}
