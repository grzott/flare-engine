/**
 * Shape primitive vocabulary. 12 named atomic shapes + 1 SVG escape hatch.
 *
 * Adding a new named primitive requires changes in 4 places:
 *   1. extend the `ShapeSpec` union here
 *   2. add a draw branch in `draw.ts`
 *   3. add a bounds branch in `bounds.ts`
 *   4. add tests in `tests/`
 *
 * Adding an arbitrary shape *without* a new named primitive is data-only:
 * use `{ kind: 'path', d: '<SVG path string>' }`. Skia parses SVG path data
 * natively via `Path.MakeFromSVGString` — same syntax as Figma / Inkscape /
 * `<path d="...">`.
 *
 * All colors are 32-bit ARGB ints (alpha in high byte). Use `argbTo()` from
 * `draw.ts` to feed Skia paints.
 */

export interface BaseSpec {
  readonly fill?: number;
  readonly stroke?: number;
  readonly strokeWidth?: number;
  /** Local offset applied when composing multiple shapes per entity. */
  readonly ox?: number;
  readonly oy?: number;
  /** Local rotation in radians, composed with the entity rotation. */
  readonly rot?: number;
  /**
   * Optional glow tag. When present, `drawShape` emits the corresponding glow
   * ring behind the body geometry.
   *
   *   'friendly' — safe-green rim  (player ship, weapon/upgrade pickups)
   *   'hazard'   — orange double-stroke (danger cues, enemy bullets)
   */
  readonly glow?: 'friendly' | 'hazard';
}

export interface CircleSpec extends BaseSpec {
  readonly kind: 'circle';
  readonly r: number;
}

export interface RectSpec extends BaseSpec {
  readonly kind: 'rect';
  readonly w: number;
  readonly h: number;
}

export interface TriangleSpec extends BaseSpec {
  readonly kind: 'triangle';
  readonly size: number;
}

export interface NgonSpec extends BaseSpec {
  readonly kind: 'ngon';
  readonly n: number;
  readonly r: number;
}

export interface StarSpec extends BaseSpec {
  readonly kind: 'star';
  readonly points: number;
  readonly rOuter: number;
  readonly rInner: number;
}

export interface RingSpec extends BaseSpec {
  readonly kind: 'ring';
  readonly r: number;
}

export interface PolylineSpec extends BaseSpec {
  readonly kind: 'polyline';
  readonly points: readonly number[];
}

export interface GradientRectSpec extends BaseSpec {
  readonly kind: 'gradient-rect';
  readonly w: number;
  readonly h: number;
  readonly colorA: number;
  readonly colorB: number;
  /** 0 = horizontal, 1 = vertical. */
  readonly axis: 0 | 1;
}

/**
 * Sector or arc. Angles in radians, 0 = +X axis, increasing CCW.
 *
 * Use cases:
 *   - half-circle:  startAngle: 0,            endAngle: Math.PI,           sector: true
 *   - 1/4-moon:     startAngle: Math.PI*1.5,  endAngle: 0,                 sector: true
 *   - 1/8-moon:     startAngle: -Math.PI/8,   endAngle: Math.PI/8,         sector: true
 */
export interface ArcSpec extends BaseSpec {
  readonly kind: 'arc';
  readonly r: number;
  readonly startAngle: number;
  readonly endAngle: number;
  /** Closed wedge (true) or open arc stroke (false). Default false. */
  readonly sector?: boolean;
}

/**
 * Annulus (ring with thickness). When `startAngle`+`endAngle` are set,
 * renders a partial annulus (half-donut, quarter-donut, etc.).
 *
 * Implementation note: rendered as a thick stroked circle/arc at the
 * mid-radius with width = `rOuter - rInner`. The `fill` colour is used as
 * the ring colour.
 */
export interface AnnulusSpec extends BaseSpec {
  readonly kind: 'annulus';
  readonly rOuter: number;
  readonly rInner: number;
  /** If set together with `endAngle`, renders a partial annulus. */
  readonly startAngle?: number;
  readonly endAngle?: number;
}

/**
 * Trapezoid (4-sided, parallel top and bottom edges). Apex up — `topW` is
 * the narrow edge at -h/2, `botW` is the wide edge at +h/2. Use `rot: Math.PI`
 * to flip apex-down.
 */
export interface TrapezoidSpec extends BaseSpec {
  readonly kind: 'trapezoid';
  readonly topW: number;
  readonly botW: number;
  readonly h: number;
}

/**
 * SVG path escape hatch. `d` is the standard SVG path-data string (M, L, C,
 * Q, A, Z, etc.) parsed by `Skia.Path.MakeFromSVGString`. Same syntax as
 * Figma / Inkscape / `<path d="...">`.
 *
 * If the path string is malformed and Skia returns null, the draw call is
 * silently skipped (does not throw).
 */
export interface PathSpec extends BaseSpec {
  readonly kind: 'path';
  readonly d: string;
  /**
   * Bounding-radius hint for atlas tile sizing. Required because parsing
   * `d` to compute bounds is non-trivial outside Skia. Treat as "max
   * distance from origin to any point on the path".
   */
  readonly boundsR: number;
}

/** Used exclusively as `ShipSpec.engine`. Not part of the flat `ShapeSpec` union. */
export interface SquareSpec extends BaseSpec {
  readonly kind: 'square';
  readonly size: number;
}

/**
 * Composite ship spec — a 3-element rule:
 * hull + N rect weapons + 1 square engine.
 *
 * A higher-level `ShipDef` (hull-preset references) may eventually replace
 * direct use of `ShipSpec`; for now this remains the rendering composite
 * consumed by `drawShip`.
 */
export interface ShipSpec extends BaseSpec {
  readonly kind: 'ship';
  readonly hull: ShapeSpec;
  readonly weapons: readonly RectSpec[];
  readonly engine: SquareSpec;
}

export type ShapeSpec =
  | CircleSpec
  | RectSpec
  | TriangleSpec
  | NgonSpec
  | StarSpec
  | RingSpec
  | PolylineSpec
  | GradientRectSpec
  | ArcSpec
  | AnnulusSpec
  | TrapezoidSpec
  | PathSpec
  | ShipSpec;
