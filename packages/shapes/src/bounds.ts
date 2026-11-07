import type { BaseSpec, ShapeSpec, SquareSpec } from './types.js';

/** Per-axis extents in the composition-local frame (the frame `ox`/`oy` live in). */
export interface ShapeBoundsBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A `ship` part: its hull/weapons are `ShapeSpec`s, its engine a `SquareSpec`. */
type Part = ShapeSpec | SquareSpec;

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
 * a glow ring when `glow` is set (+5.5 friendly, +2.25 hazard, +2.5 + `width`
 * for a `GlowSpec`) — enough to fully contain what `drawShape` paints.
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

/** Allocating form of {@link shapeBoundsBoxInto}. */
export function shapeBoundsBox(specs: readonly ShapeSpec[]): ShapeBoundsBox {
  return shapeBoundsBoxInto(specs, { minX: 0, minY: 0, maxX: 0, maxY: 0 });
}

/**
 * Per-axis sibling of `shapeBoundsRadius`, for hitboxes: the union of every
 * spec's extents at its `ox`/`oy`, each widened by the same `+2` + stroke +
 * glow margin. Exact for unrotated geometry (a `ship` unions hull, weapons
 * and engine); a spec with a non-zero `rot` falls back to its radial reach,
 * so the box never exceeds the radius on any axis. Empty `specs` give all
 * zeros — no 4-unit atlas floor. Writes `out` and returns it; allocates nothing.
 */
export function shapeBoundsBoxInto(
  specs: readonly ShapeSpec[],
  out: ShapeBoundsBox,
): ShapeBoundsBox {
  out.minX = Infinity;
  out.minY = Infinity;
  out.maxX = -Infinity;
  out.maxY = -Infinity;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    if (s !== undefined) expand(out, s, 0, 0, 0, false);
  }
  if (out.minX === Infinity) {
    out.minX = 0;
    out.minY = 0;
    out.maxX = 0;
    out.maxY = 0;
  }
  return out;
}

/** Union `out` with `spec` centred at (dx + ox, dy + oy), padded by `pad` plus its own margin. */
function expand(
  out: ShapeBoundsBox,
  spec: Part,
  dx: number,
  dy: number,
  pad: number,
  rotated: boolean,
): void {
  const cx = dx + (spec.ox ?? 0);
  const cy = dy + (spec.oy ?? 0);
  const m = pad + 2 + strokeMargin(spec) + glowMargin(spec);
  const rot = rotated || (spec.rot ?? 0) !== 0;
  if (spec.kind === 'ship') {
    // drawShape never rotates a part's offset; a rotated ship spins each part about its own centre
    expand(out, spec.hull, cx, cy, m, rot);
    for (let i = 0; i < spec.weapons.length; i++) {
      const w = spec.weapons[i];
      if (w !== undefined) expand(out, w, cx, cy, m, rot);
    }
    expand(out, spec.engine, cx, cy, m, rot);
    return;
  }
  if (!rot) {
    switch (spec.kind) {
      case 'rect':
      case 'gradient-rect':
        include(out, cx, cy, m, -spec.w / 2, -spec.h / 2, spec.w / 2, spec.h / 2);
        return;
      case 'square':
        include(out, cx, cy, m, -spec.size / 2, -spec.size / 2, spec.size / 2, spec.size / 2);
        return;
      case 'trapezoid': {
        const hw = Math.max(spec.topW, spec.botW) / 2;
        include(out, cx, cy, m, -hw, -spec.h / 2, hw, spec.h / 2);
        return;
      }
      case 'triangle':
        include(out, cx, cy, m, -spec.size * 0.6, -spec.size, spec.size * 0.6, spec.size * 0.4);
        return;
      case 'ngon':
      case 'star': {
        // same vertex walk as drawNgon / drawStar
        const n = spec.kind === 'ngon' ? spec.n : spec.points * 2;
        let x0 = 0;
        let y0 = 0;
        let x1 = 0;
        let y1 = 0;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const vr = spec.kind === 'ngon' ? spec.r : i % 2 === 0 ? spec.rOuter : spec.rInner;
          const px = Math.cos(a) * vr;
          const py = Math.sin(a) * vr;
          if (px < x0) x0 = px;
          else if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          else if (py > y1) y1 = py;
        }
        include(out, cx, cy, m, x0, y0, x1, y1);
        return;
      }
      case 'polyline': {
        const p = spec.points;
        let x0 = p[0] ?? 0;
        let y0 = p[1] ?? 0;
        let x1 = x0;
        let y1 = y0;
        for (let i = 2; i < p.length; i += 2) {
          const px = p[i] ?? 0;
          const py = p[i + 1] ?? 0;
          if (px < x0) x0 = px;
          else if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          else if (py > y1) y1 = py;
        }
        include(out, cx, cy, m + (spec.strokeWidth ?? 1), x0, y0, x1, y1);
        return;
      }
    }
  }
  const e = boundsR(spec);
  include(out, cx, cy, m, -e, -e, e, e);
}

function include(
  out: ShapeBoundsBox,
  cx: number,
  cy: number,
  m: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  out.minX = Math.min(out.minX, cx + x0 - m);
  out.minY = Math.min(out.minY, cy + y0 - m);
  out.maxX = Math.max(out.maxX, cx + x1 + m);
  out.maxY = Math.max(out.maxY, cy + y1 + m);
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
function strokeMargin(spec: Part): number {
  const painted =
    spec.kind === 'ring' || spec.kind === 'polyline'
      ? true
      : spec.kind === 'gradient-rect' || spec.kind === 'annulus' || spec.kind === 'ship'
        ? false
        : spec.stroke !== undefined;
  return painted ? Math.max(2, (spec.strokeWidth ?? 1) / 2) : 0;
}

/**
 * Extra reach for the glow ring `drawShape` paints outside the body (see
 * `applyFriendlyGlow`/`applyHazardGlow`/`applyGlow`). A `GlowSpec` ring sits
 * 2.5 px out and is `width` wide, so its outer edge is `2.5 + width` beyond
 * the body; a width `applyGlow` refuses to paint adds nothing.
 */
function glowMargin(spec: BaseSpec): number {
  const glow = spec.glow;
  if (glow === undefined) return 0;
  if (glow === 'friendly') return 5.5;
  if (glow === 'hazard') return 2.25;
  return Number.isFinite(glow.width) && glow.width >= 0 ? 2.5 + glow.width : 0;
}

/** Tighter atlas-tile-sizing radius (rect/gradient-rect use 0.75 to fit corners). */
function boundsR(spec: Part): number {
  switch (spec.kind) {
    case 'rect':
    case 'gradient-rect':
      return Math.max(spec.w, spec.h) * 0.75;
    case 'square':
      return spec.size * 0.75;
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
