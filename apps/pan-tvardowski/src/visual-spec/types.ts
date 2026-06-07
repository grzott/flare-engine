/**
 * Visual spec — typed schema. Authored against, not drawn.
 *
 * **Schema is locked at session #1 of the visual-spec rebuild.** After lock,
 * the only permitted evolutions are: adding optional fields, adding union
 * variants (exhaustive switches checked by tsc), and adding new files. Any
 * rename or type change requires the deprecation cycle described in the plan
 * file `i-looked-at-visual-spec-mighty-anchor.md`.
 *
 * The schema is split LDtk-style:
 *   - **Definitions** — what an entity IS (HullPreset, ShipDef, BulletDef,
 *     WeaponDef, PickupDef, AnimationDef). Reusable, referenced by Id.
 *   - **Instances** — where/how entities APPEAR (ZoneVisualSpec, BossVisualSpec,
 *     HudSpec, OverlaySpec, ScreenSpec). Reference Defs.
 *   - **Foundations** — ThemeSpec, Hex, Pos, Size, Anchor, Inset.
 *
 * Shape primitives (ShapeSpec) are imported from `../shapes` until session #2,
 * after which they live in `@flare-engine/shapes`.
 */

export * from './types/foundations';
export * from './types/definitions-animations';
export * from './types/definitions-ships';
export * from './types/definitions-projectiles';
export * from './types/definitions-entities';
export * from './types/instances-ui';
export * from './types/instances-zones';
