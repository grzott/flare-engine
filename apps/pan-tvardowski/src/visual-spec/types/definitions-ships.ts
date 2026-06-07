import type { ShapeSpec } from '@flare-engine/shapes';
import type { AnimationPresetId } from './definitions-animations';
import type { EntityId, Hex, Pos } from './foundations';

export type HullPresetId =
  | 'square'
  | 'triangle'
  | 'circle'
  | 'half-circle'
  | 'quarter-moon'
  | 'eighth-moon'
  | 'trapeze'
  | 'two-triangles'
  | 'donut'
  | 'half-donut';

/**
 * Named hull composition with weapon-hook and engine-hook anchors. All
 * positions are in **hull-local coordinates** (origin = hull center, +y is
 * forward / screen-up).
 *
 * Adding a new HullPreset is data-only: append one entry to
 * `visual-spec/hull-presets.ts`, no engine change.
 */
export interface HullPreset {
  readonly id: HullPresetId;
  /** Body composition — primitives from `@flare-engine/shapes`. */
  readonly shapes: readonly ShapeSpec[];
  /**
   * Weapon mount anchors. Per user's plan:
   *  - I-weapon: front-of-ship (`one`)
   *  - II-weapons: side-mounted at preset-specific lateral offset (`two`)
   * User calibrates exact `Pos` values visually after Session 3 capture render.
   */
  readonly weaponHooks: {
    readonly one: Pos;
    readonly two: readonly [Pos, Pos];
  };
  /** Back-of-ship engine-square anchor. */
  readonly engineHook: Pos;
  /** 0..1 — fraction of engine-square that overlaps the hull body. Default 0.5. */
  readonly engineOverflow: number;
  /** Collision radius in design pixels. */
  readonly bounds: { readonly r: number };
}

/**
 * Lean ship spec. Replaces the inline hull+weapons+engine composition in
 * `shape-catalogue.ts` with a hull-preset reference + color overrides. Migration
 * happens in session #3.
 */
export interface ShipDef {
  readonly id: EntityId;
  readonly hullPreset: HullPresetId;
  readonly hullColor: Hex;
  readonly weaponCount: 1 | 2;
  /** Weapon-rect aspect ratio (width:length); preset-driven for visual rhythm. */
  readonly weaponRatio: '1:8' | '1:10' | '1:12';
  readonly weaponColor: Hex;
  readonly engineColor: Hex;
  /** Engine-exhaust trail color (different per ship for silhouette readability). */
  readonly exhaustColor: Hex;
  /** Defaults to `'shatter-3'` if omitted at use site. */
  readonly destruction?: AnimationPresetId;
  readonly glow?: 'friendly' | 'hazard';
  /** Optional outline (e.g. wapierz, leszy). */
  readonly hullStroke?: Hex;
  readonly hullStrokeWidth?: number;
}
