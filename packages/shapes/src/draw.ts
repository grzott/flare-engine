/**
 * Shape drawing dispatcher — consumes a `ShapeSpec` and emits Skia draw
 * calls on a canvas. All shapes draw relative to (x + ox, y + oy), rotated
 * by (rot + spec.rot).
 *
 * The dispatcher is allocation-free per call except where Skia itself
 * allocates path objects. Glow ring is emitted before the shape body so it
 * renders behind the geometry.
 */

import type { SkCanvas, Skia as SkiaModule, SkPaint } from '@shopify/react-native-skia';
import { singleShapeRadius } from './bounds.js';
import type {
  AnnulusSpec,
  ArcSpec,
  GradientRectSpec,
  NgonSpec,
  PathSpec,
  PolylineSpec,
  RectSpec,
  ShapeSpec,
  ShipSpec,
  SquareSpec,
  StarSpec,
  TrapezoidSpec,
  TriangleSpec,
} from './types.js';

type Skia = typeof SkiaModule;

// ---- Glow recipes -----------------------------------------------------------

/** ARGB for safe #6FA66B at α ≈ 0.25 (0x40 / 255). */
export function friendlyGlowArgb(): number {
  return (0x40 << 24) | 0x6fa66b;
}

/** ARGB for hazardOrange #E84B2A at α ≈ 0.6 (0x99 / 255). */
export function hazardGlowArgb(): number {
  return (0x99 << 24) | 0xe84b2a;
}

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

// ---- Color plumbing ---------------------------------------------------------

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

// ---- Dispatcher -------------------------------------------------------------

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

  if (spec.glow !== undefined) {
    const gr = singleShapeRadius(spec);
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
    case 'arc':
      drawArc(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'annulus':
      drawAnnulus(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'trapezoid':
      drawTrapezoid(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'path':
      drawPath(Skia, canvas, paint, spec, cx, cy, r);
      return;
    case 'ship':
      drawShip(Skia, canvas, paint, spec, cx, cy, r);
      return;
  }
}

// ---- Per-primitive renderers -----------------------------------------------

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
  // Cheap two-half approximation; true shader gradient is overkill at atlas-build time.
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

// Skia uses degrees, 0° at +X, increasing clockwise. We accept radians (math
// convention CCW positive) and convert; visual result matches expectations
// when rotated through the canvas transform.
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function drawArc(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: ArcSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const path = Skia.Path.Make();
  const oval = Skia.XYWHRect(-spec.r, -spec.r, spec.r * 2, spec.r * 2);
  const startDeg = radToDeg(spec.startAngle);
  const sweepDeg = radToDeg(spec.endAngle - spec.startAngle);
  if (spec.sector === true) {
    path.moveTo(0, 0);
    path.addArc(oval, startDeg, sweepDeg);
    path.close();
  } else {
    path.addArc(oval, startDeg, sweepDeg);
  }
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate(radToDeg(rot), 0, 0);
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

function drawAnnulus(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: AnnulusSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  // Render as a thick stroked circle/arc at the mid-radius. The fill colour
  // becomes the ring colour (more ergonomic than even-odd path subtraction).
  const midR = (spec.rOuter + spec.rInner) / 2;
  const thickness = spec.rOuter - spec.rInner;
  const ringColor = spec.fill ?? spec.stroke ?? 0xff000000;

  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate(radToDeg(rot), 0, 0);

  if (spec.startAngle !== undefined && spec.endAngle !== undefined) {
    const path = Skia.Path.Make();
    const oval = Skia.XYWHRect(-midR, -midR, midR * 2, midR * 2);
    path.addArc(oval, radToDeg(spec.startAngle), radToDeg(spec.endAngle - spec.startAngle));
    applyStroke(paint, ringColor, thickness);
    canvas.drawPath(path, paint);
  } else {
    applyStroke(paint, ringColor, thickness);
    canvas.drawCircle(0, 0, midR, paint);
  }

  canvas.restore();
}

function drawTrapezoid(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: TrapezoidSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const path = Skia.Path.Make();
  const halfTopW = spec.topW / 2;
  const halfBotW = spec.botW / 2;
  const halfH = spec.h / 2;
  // Apex up: narrow top edge at -h/2, wide bottom edge at +h/2.
  path.moveTo(-halfTopW, -halfH);
  path.lineTo(halfTopW, -halfH);
  path.lineTo(halfBotW, halfH);
  path.lineTo(-halfBotW, halfH);
  path.close();
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate(radToDeg(rot), 0, 0);
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

function drawPath(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: PathSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const path = Skia.Path.MakeFromSVGString(spec.d);
  // Malformed SVG returns null — skip silently rather than throw.
  if (path === null) return;
  canvas.save();
  canvas.translate(cx, cy);
  if (rot !== 0) canvas.rotate(radToDeg(rot), 0, 0);
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

function drawSquare(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: SquareSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  const rectSpec: RectSpec = {
    kind: 'rect',
    w: spec.size,
    h: spec.size,
    fill: spec.fill,
    stroke: spec.stroke,
    strokeWidth: spec.strokeWidth,
    ox: spec.ox,
    oy: spec.oy,
    rot: spec.rot,
  };
  drawRect(Skia, canvas, paint, rectSpec, cx, cy, rot);
}

/**
 * Draw a ShipSpec by painting engine → hull → weapons (engine deepest,
 * weapons foremost — painter's algorithm). Zero allocation in the weapons
 * loop: classic indexed for-loop over the readonly array.
 */
function drawShip(
  Skia: Skia,
  canvas: SkCanvas,
  paint: SkPaint,
  spec: ShipSpec,
  cx: number,
  cy: number,
  rot: number,
): void {
  drawSquare(Skia, canvas, paint, spec.engine, cx, cy, rot);
  drawShape(Skia, canvas, paint, spec.hull, cx, cy, rot);
  for (let i = 0; i < spec.weapons.length; i++) {
    const w = spec.weapons[i];
    if (w !== undefined) {
      drawShape(Skia, canvas, paint, w, cx, cy, rot);
    }
  }
}
