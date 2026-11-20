/**
 * Type-level probe, not a bun test: `createWebShapeSkia(kit)` and the canvas
 * and paint it hands out must pass to the `@flare-engine/shapes` API with no
 * cast. Checked by the root `bun run typecheck:tests`, which runs after
 * `build`: the shapes import resolves to its `dist/*.d.mts`, so this also
 * holds the published types to needing nothing from react-native-skia. The
 * react-native-skia half is `packages/shapes/tests/draw-assignability.ts`.
 */
import {
  applyFriendlyGlow,
  applyGlow,
  applyHazardGlow,
  bakeShapeAtlas,
  drawShape,
  rebakeShapeAtlas,
  type ShapeAtlasSkia,
  type ShapeDrawSkia,
  type ShapeSpec,
} from '@flare-engine/shapes';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebShapeSkia } from '../src/web-shape-skia.js';

declare const kit: CanvasKit;
declare const spec: ShapeSpec;

const skia = createWebShapeSkia(kit);

export const atlasSkia: ShapeAtlasSkia = skia;
export const drawSkia: ShapeDrawSkia = skia;

export function webBake(): void {
  const atlas = bakeShapeAtlas(skia, [spec], 1);
  rebakeShapeAtlas(skia, atlas, 2);
}

// Drawing into the handle's own offscreen surface, as the bake does.
export function webDraw(): void {
  const surface = skia.Surface.Make(64, 64);
  if (surface === null) return;
  const canvas = surface.getCanvas();
  const paint = skia.Paint();
  drawShape(skia, canvas, paint, spec, 0, 0, 0);
  applyGlow(canvas, paint, 0, 0, 8, 0xffffffff, 2);
  applyFriendlyGlow(canvas, paint, 0, 0, 8);
  applyHazardGlow(canvas, paint, 0, 0, 8);
  surface.dispose();
}
