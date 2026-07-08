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
 * shapes (including their `ox`/`oy` offsets and stroke widths).
 */
export function shapeBoundsRadius(specs: readonly ShapeSpec[]): number {
  let max = 0;
  for (const s of specs) {
    const ox = s.ox ?? 0;
    const oy = s.oy ?? 0;
    const r = boundsR(s);
    const reach = Math.hypot(ox, oy) + r + 2;
    if (reach > max) max = reach;
  }
  return Math.max(4, max);
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
        },
      ]);
    default:
      return singleShapeRadius(spec);
  }
}
