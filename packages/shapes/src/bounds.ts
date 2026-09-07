import type { ShapeSpec } from './types.js';

/**
 * Approximate bounding radius for a single primitive. Used to size glow
 * rings and atlas tiles. Returned values are deliberately a touch generous
 * to avoid clipping.
 */
export function singleShapeRadius(spec: ShapeSpec): number {
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
    case 'arc':
      return spec.r;
    case 'annulus':
      return spec.rOuter;
    case 'trapezoid':
      return Math.max(spec.topW, spec.botW, spec.h) * 0.6;
    case 'path':
      return spec.boundsR;
    case 'ship': {
      const { hull, weapons, engine } = spec;
      let max = Math.hypot(hull.ox ?? 0, hull.oy ?? 0) + singleShapeRadius(hull);
      for (let i = 0; i < weapons.length; i++) {
        const w = weapons[i];
        if (w === undefined) continue;
        const reach = Math.hypot(w.ox ?? 0, w.oy ?? 0) + singleShapeRadius(w);
        if (reach > max) max = reach;
      }
      // engine mirrors a w=h=size rect (see drawSquare); 0.6 is the rect face factor used by the 'rect' case above
      const engineReach = Math.hypot(engine.ox ?? 0, engine.oy ?? 0) + engine.size * 0.6;
      if (engineReach > max) max = engineReach;
      return max;
    }
  }
}

/**
 * Compute axis-aligned bounding radius for a shape composition. Used to
 * size atlas tiles. Returns the max half-extent from origin across all
 * shapes, including their `ox`/`oy` offsets, a stroke-width margin added on
 * top of the base `+2` where a stroke is actually painted, and the extent of
 * a glow ring when `glow` is set (+5.5 friendly, +2.25 hazard) — enough to
 * fully contain what `drawShape` paints.
 */
export function shapeBoundsRadius(specs: readonly ShapeSpec[]): number {
  let max = 0;
  for (const s of specs) {
    const ox = s.ox ?? 0;
    const oy = s.oy ?? 0;
    const r = boundsR(s);
    const reach = Math.hypot(ox, oy) + r + 2 + strokeMargin(s) + glowMargin(s);
    if (reach > max) max = reach;
  }
  return Math.max(4, max);
}

/**
 * Extra reach for a stroke `drawShape` actually paints, else 0. `ring` and
 * `polyline` always stroke (draw.ts falls back to a default color/width);
 * every other kind strokes only when `stroke` is set. `gradient-rect` never
 * strokes, and `annulus`'s ring width is the fill-derived `rOuter - rInner`
 * band (already exactly bounded by `rOuter`), not `strokeWidth` — both are
 * excluded rather than double-counted. `ship` has no top-level stroke of its
 * own; its sub-shapes carry theirs through the nested `boundsR` recursion.
 */
function strokeMargin(spec: ShapeSpec): number {
  const painted =
    spec.kind === 'ring' || spec.kind === 'polyline'
      ? true
      : spec.kind === 'gradient-rect' || spec.kind === 'annulus' || spec.kind === 'ship'
        ? false
        : spec.stroke !== undefined;
  return painted ? Math.max(2, (spec.strokeWidth ?? 1) / 2) : 0;
}

/** Extra reach for the glow ring `drawShape` paints outside the body (see `applyFriendlyGlow`/`applyHazardGlow`). */
function glowMargin(spec: ShapeSpec): number {
  if (spec.glow === 'friendly') return 5.5;
  if (spec.glow === 'hazard') return 2.25;
  return 0;
}

/** Tighter atlas-tile-sizing radius (rect/gradient-rect use 0.75 to fit corners). */
function boundsR(spec: ShapeSpec): number {
  switch (spec.kind) {
    case 'rect':
    case 'gradient-rect':
      return Math.max(spec.w, spec.h) * 0.75;
    case 'trapezoid':
      return Math.max(spec.topW, spec.botW, spec.h) * 0.75;
    case 'ship':
      return shapeBoundsRadius([
        spec.hull,
        ...spec.weapons,
        {
          kind: 'rect',
          w: spec.engine.size,
          h: spec.engine.size,
          ox: spec.engine.ox,
          oy: spec.engine.oy,
          stroke: spec.engine.stroke,
          strokeWidth: spec.engine.strokeWidth,
          glow: spec.engine.glow,
        },
      ]);
    default:
      return singleShapeRadius(spec);
  }
}
