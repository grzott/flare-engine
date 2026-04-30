/**
 * Shape-atlas spec. At 0.1.x every visual is a composition of primitive Skia
 * shapes — no sprite art. The runtime `drawShape(canvas, spec, x, y, rot)`
 * dispatcher lands in M1 when Skia is wired; this module is the data-only
 * type layer consumed by the shape catalogue.
 *
 * Colors are 32-bit ARGB ints (see `palette.ts`).
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
   * Optional glow tag. When present on a shape spec, `drawShape` emits the
   * corresponding glow ring behind the body geometry.
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

/** Used exclusively as `ShipSpec.engine`. Not part of the flat `ShapeSpec` union. */
export interface SquareSpec extends BaseSpec {
  readonly kind: 'square';
  readonly size: number;
}

/**
 * Composite ship spec per folio XIIIa 3-element rule:
 * hull + N rect weapons (1–2 for enemies) + 1 square engine (20×20 px).
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
  | ShipSpec;
