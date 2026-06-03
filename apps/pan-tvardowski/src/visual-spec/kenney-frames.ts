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
