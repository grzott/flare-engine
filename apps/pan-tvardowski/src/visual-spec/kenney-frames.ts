/**
 * Uniform scale applied to every sprite that resolves through the Kenney atlas.
 * Kenney frames are native 192×192 (ships) or similar — much larger than the
 * procedural shapes. 0.5 brings them into parity with the old shape-atlas sizes.
 * Zones 2–8 (shape atlas) always use scale 1.
 */
export const KENNEY_SPRITE_SCALE = 0.5;

/**
 * KG3: zone-1-only entity → Kenney frame name map.
 *
 * Keyed by the string used at the spawn call site:
 *   - enemies: `spec.frame` (= the EnemyPattern string, e.g. `'skrzat'`)
 *   - boss: the BossPattern string (e.g. `'smok-krzemionkowski'`)
 *   - player: the frame name passed to `frame(atlas.sheet, ...)` (`'kogut-zloty'`)
 *   - pickups: `String(def.id)` (e.g. `'pickup-iskry'`)
 *
 * Entities NOT listed here fall through to the shape atlas — that is how
 * zones 2–8 remain procedural.
 */
export const KENNEY_FRAME_MAP: ReadonlyMap<string, string> = new Map([
  ['kogut-zloty', 'playerShip1_blue'],
  ['skrzat', 'enemyBlack1'],
  ['latawiec', 'enemyBlack2'],
  ['smok-krzemionkowski', 'ufoRed'],
  ['piorun-bullet', 'laserBlue01'],
  ['enemy-bullet', 'laserRed01'],
  ['pickup-iskry', 'powerupRed_bolt'],
  ['pickup-piorun', 'powerupYellow_bolt'],
  ['pickup-sol-swiecona', 'powerupBlue_shield'],
  ['pickup-znak-pentagramu', 'powerupBlue_star'],
  ['pickup-czarna-ksiega', 'powerupRed_shield'],
  ['pickup-siedmiomilowe-buty', 'powerupGreen_bolt'],
  ['pickup-amulet-wegrowski', 'powerupYellow_shield'],
  ['pickup-koguci-pioro', 'bolt_gold'],
  ['pickup-srebrna-tarcza', 'shield_gold'],
  ['pickup-kamien-filozoficzny', 'star_gold'],
]);

/**
 * KG7: zone IDs that use the full Kenney explosion FX set:
 *   - fire00..19 flipbook (ExplosionFire entities at the explosion centre)
 *   - particle-dot (tank_bullet6) instead of procedural particle-spark dots
 *
 * Zone-1 only for now; "all zones at end" = add remaining zone IDs here.
 * This is the single flippable point — no scattered zone.id === 'z1' checks.
 *
 * Key: numeric zone id (same as ZoneId = 1..8).
 */
export const KENNEY_FX_ZONES: ReadonlySet<number> = new Set([1]);
