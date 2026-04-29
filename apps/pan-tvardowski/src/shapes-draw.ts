/**
 * Shape drawing dispatcher — consumes a `ShapeSpec` and emits Skia draw
 * calls on a canvas. Runs at atlas-build time (offscreen surface), never
 * per frame in the game loop.
 *
 * All shapes are drawn relative to (x + ox, y + oy) and rotated by (rot + spec.rot).
 */

import type { SkCanvas, SkPaint, Skia as SkiaModule } from '@shopify/react-native-skia';
import type {
  GradientRectSpec,
  NgonSpec,
  PolylineSpec,
  RectSpec,
  ShapeSpec,
  StarSpec,
  TriangleSpec,
} from './shapes';

type Skia = typeof SkiaModule;

// ---- Glow recipes -----------------------------------------------------------
// Colors sourced from colors.ui.safe (#6FA66B) and colors.ui.hazardOrange
// (#E84B2A) — both canonical deck tokens.

/** ARGB for safe #6FA66B at α ≈ 0.25 (0x40 / 255). */
export function friendlyGlowArgb(): number {
  // 0x40 = 64 = Math.round(0.25 * 255)
  return (0x40 << 24) | 0x6fa66b;
}

/** ARGB for hazardOrange #E84B2A at α ≈ 0.6 (0x99 / 255). */
export function hazardGlowArgb(): number {
  // 0x99 = 153 = Math.round(0.6 * 255)
  return (0x99 << 24) | 0xe84b2a;
}

/**
 * Draw a single oversized stroked ring at outer radius `r + 4`.
 * Reuses the existing `paint` ref — no allocation.
 */
export function applyFriendlyGlow(
  _Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  cx: number,
  cy: number,
  r: number,
): void {
  applyStroke(paint, friendlyGlowArgb(), 3);
  canvas.drawCircle(cx, cy, r + 4, paint);
}

/**
 * Draw a thin double-stroke hazard halo (0.5 px inner + 0.5 px outer offset).
 * Reuses the existing `paint` ref — no allocation.
 */
export function applyHazardGlow(
  _Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  cx: number,
  cy: number,
  r: number,
): void {
  const argb = hazardGlowArgb();
  applyStroke(paint, argb, 0.5);
  canvas.drawCircle(cx, cy, r + 1, paint);
  canvas.drawCircle(cx, cy, r + 2, paint);
}

/** Reusable float array for Skia color conversion. */
const COLOR = new Float32Array(4);

export function argbTo(out: Float32Array, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}

function applyFill(paint: SkPaint, argb: number): void {
  argbTo(COLOR, argb);
  paint.setColor(COLOR);
  paint.setStyle(0); // Fill
}

function applyStroke(paint: SkPaint, argb: number, width: number): void {
  argbTo(COLOR, argb);
  paint.setColor(COLOR);
  paint.setStyle(1); // Stroke
  paint.setStrokeWidth(width);
}

/**
 * Draw `spec` at world-space (x, y) with rotation `rot` (radians). `paint`
 * is mutated for each call; caller should discard state assumptions after.
 *
 * When `spec.glow` is set, the appropriate glow ring is emitted BEFORE the
 * shape body so glow renders behind geometry.
 */
export function drawShape(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: ShapeSpec,
  x: number,
  y: number,
  rot: number,
): void {
  const cx = x + (spec.ox ?? 0);
  const cy = y + (spec.oy ?? 0);
  const r = rot + (spec.rot ?? 0);

  // Glow pass — fires before the shape body so the ring stays behind geometry.
  if (spec.glow !== undefined) {
    const gr = glowRadius(spec);
    if (spec.glow === 'friendly') {
      applyFriendlyGlow(Skia, canvas, paint, cx, cy, gr);
    } else {
      applyHazardGlow(Skia, canvas, paint, cx, cy, gr);
    }
  }

  switch (spec.kind) {
    case 'circle': {
      if (spec.fill !== undefined) {
        applyFill(paint, spec.fill);
        canvas.drawCircle(cx, cy, spec.r, paint);
      }
      if (spec.stroke !== undefined) {
        applyStroke(paint, spec.stroke, spec.strokeWidth ?? 1);
        canvas.drawCircle(cx, cy, spec.r, paint);
      }
      return;
    }
    case 'ring': {
      applyStroke(paint, spec.stroke ?? 0xff000000, spec.strokeWidth ?? 1);
      canvas.drawCircle(cx, cy, spec.r, paint);
      return;
    }
    case 'rect':
      drawRect(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'triangle':
      drawTriangle(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'ngon':
      drawNgon(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'star':
      drawStar(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'polyline':
      drawPolyline(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'gradient-rect':
      drawGradientRect(Skia, canvas, paint, spec, cx, cy, r);
      return;
  }
}

/** Approximate bounding radius for a single spec — used to size the glow ring. */
function glowRadius(spec: ShapeSpec): number {
  switch (spec.kind) {
    case 'circle':
    case 'ring':
    case 'ngon':
      return spec.r;
    case 'triangle':
      return spec.size;
    case 'star':
      return spec.rOuter;
    case 'rect':
    case 'gradient-rect':
      return Math.max(spec.w, spec.h) * 0.6;
    case 'polyline': {
      let max = 0;
      for (let i = 0; i < spec.points.length; i += 2) {
        const px = spec.points[i] ?? 0;
        const py = spec.points[i + 1] ?? 0;
        const m = Math.hypot(px, py);
        if (m > max) max = m;
      }
      return max + (spec.strokeWidth ?? 1);
    }
  }
}

function drawRect(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: RectSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate((rot * 180) / Math.PI, 0, 0);
  const rect = Skia.XYWHRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h);
  if (spec.fill !== undefined) {
    applyFill(paint, spec.fill);
    canvas.drawRect(rect, paint);
  }
  if (spec.stroke !== undefined) {
    applyStroke(paint, spec.stroke, spec.strokeWidth ?? 1);
    canvas.drawRect(rect, paint);
  }
  canvas.restore();
}

function drawTriangle(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: TriangleSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const s = spec.size;
  // Upward-pointing equilateral-ish; tip at (0,-s), base at (±s*0.6, s*0.4).
  const path = Skia.Path.Make();
  path.moveTo(0, -s);
  path.lineTo(-s * 0.6, s * 0.4);
  path.lineTo(s * 0.6, s * 0.4);
  path.close();
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate((rot * 180) / Math.PI, 0, 0);
  if (spec.fill !== undefined) {
    applyFill(paint, spec.fill);
    canvas.drawPath(path, paint);
  }
  if (spec.stroke !== undefined) {
    applyStroke(paint, spec.stroke, spec.strokeWidth ?? 1);
    canvas.drawPath(path, paint);
  }
  canvas.restore();
}

function drawNgon(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: NgonSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const path = Skia.Path.Make();
  for (let i = 0; i < spec.n; i++) {
    const a = (i / spec.n) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * spec.r;
    const py = Math.sin(a) * spec.r;
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  path.close();
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate((rot * 180) / Math.PI, 0, 0);
  if (spec.fill !== undefined) {
    applyFill(paint, spec.fill);
    canvas.drawPath(path, paint);
  }
  if (spec.stroke !== undefined) {
    applyStroke(paint, spec.stroke, spec.strokeWidth ?? 1);
    canvas.drawPath(path, paint);
  }
  canvas.restore();
}

function drawStar(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: StarSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const path = Skia.Path.Make();
  const total = spec.points * 2;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? spec.rOuter : spec.rInner;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  path.close();
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate((rot * 180) / Math.PI, 0, 0);
  if (spec.fill !== undefined) {
    applyFill(paint, spec.fill);
    canvas.drawPath(path, paint);
  }
  if (spec.stroke !== undefined) {
    applyStroke(paint, spec.stroke, spec.strokeWidth ?? 1);
    canvas.drawPath(path, paint);
  }
  canvas.restore();
}

function drawPolyline(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: PolylineSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const pts = spec.points;
  if (pts.length < 4) return;
  const path = Skia.Path.Make();
  path.moveTo(pts[0] ?? 0, pts[1] ?? 0);
  for (let i = 2; i < pts.length; i += 2) {
    path.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
  }
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate((rot * 180) / Math.PI, 0, 0);
  applyStroke(paint, spec.stroke ?? 0xff000000, spec.strokeWidth ?? 1);
  canvas.drawPath(path, paint);
  canvas.restore();
}

function drawGradientRect(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: GradientRectSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  // Approximate gradient as two halves (cheap; true shader gradient is overkill at atlas-build time).
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate((rot * 180) / Math.PI, 0, 0);
  const half = spec.axis === 1 ? spec.h / 2 : spec.w / 2;
  if (spec.axis === 1) {
    applyFill(paint, spec.colorA);
    canvas.drawRect(Skia.XYWHRect(-spec.w / 2, -spec.h / 2, spec.w, half), paint);
    applyFill(paint, spec.colorB);
    canvas.drawRect(Skia.XYWHRect(-spec.w / 2, 0, spec.w, half), paint);
  } else {
    applyFill(paint, spec.colorA);
    canvas.drawRect(Skia.XYWHRect(-spec.w / 2, -spec.h / 2, half, spec.h), paint);
    applyFill(paint, spec.colorB);
    canvas.drawRect(Skia.XYWHRect(0, -spec.h / 2, half, spec.h), paint);
  }
  canvas.restore();
}

/**
 * Compute axis-aligned bounding radius for a shape composition (used to
 * size atlas tiles). Returns max half-extent from origin across all shapes.
 */
export function shapeBoundsRadius(specs: readonly ShapeSpec[]): number {
  let max = 0;
  for (const s of specs) {
    const ox = s.ox ?? 0;
    const oy = s.oy ?? 0;
    let r = 0;
    switch (s.kind) {
      case 'circle':
      case 'ring':
      case 'ngon':
        r = s.r;
        break;
      case 'triangle':
        r = s.size;
        break;
      case 'star':
        r = s.rOuter;
        break;
      case 'rect':
      case 'gradient-rect':
        r = Math.max(s.w, s.h) * 0.75;
        break;
      case 'polyline': {
        for (let i = 0; i < s.points.length; i += 2) {
          const px = s.points[i] ?? 0;
          const py = s.points[i + 1] ?? 0;
          const m = Math.max(Math.abs(px), Math.abs(py));
          if (m > r) r = m;
        }
        r += s.strokeWidth ?? 1;
        break;
      }
    }
    const reach = Math.hypot(ox, oy) + r + 2;
    if (reach > max) max = reach;
  }
  return Math.max(4, max);
}
