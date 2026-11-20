/**
 * Type-level probe, not a bun test: the draw helpers are typed structurally,
 * and react-native-skia's `Skia`, `SkCanvas` and `SkPaint` must still pass to
 * them with no cast. Checked by the root `bun run typecheck:tests`. The
 * CanvasKit half is `packages/render-web/tests/shape-assignability.ts`.
 */
import type { SkCanvas, Skia, SkPaint } from '@shopify/react-native-skia';
import type { ShapeAtlasCanvas, ShapeAtlasPaint, ShapeDrawSkia } from '../src/atlas.js';
import { applyFriendlyGlow, applyGlow, applyHazardGlow, drawShape } from '../src/draw.js';
import type { ShapeSpec } from '../src/types.js';

declare const skia: typeof Skia;
declare const canvas: SkCanvas;
declare const paint: SkPaint;
declare const spec: ShapeSpec;

export const drawSkia: ShapeDrawSkia = skia;
export const drawCanvas: ShapeAtlasCanvas = canvas;
export const drawPaint: ShapeAtlasPaint = paint;

export function nativeDraw(): void {
  drawShape(skia, canvas, paint, spec, 0, 0, 0);
  drawShape(skia, canvas, skia.Paint(), spec, 0, 0, 0);
  applyGlow(canvas, paint, 0, 0, 8, 0xffffffff, 2);
  applyFriendlyGlow(canvas, paint, 0, 0, 8);
  applyHazardGlow(canvas, paint, 0, 0, 8);
}

// Code written against the old signature, which named the react-native-skia
// types, keeps compiling: `drawShape` is still assignable to a function type
// declared with those parameter types.
type NativeDrawShape = (
  Skia: typeof skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: ShapeSpec,
  x: number,
  y: number,
  rot: number,
) => void;

export const asNative: NativeDrawShape = drawShape;
