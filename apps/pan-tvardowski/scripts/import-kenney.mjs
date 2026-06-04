import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');

const KENNEY_SRC =
  process.env.KENNEY_SRC ?? 'C:\\_PROG\\_ASSETS\\Kenney Game Assets All-in-1 3.5.0';

if (!existsSync(KENNEY_SRC)) {
  console.error(`[import-kenney] source dir not found: ${KENNEY_SRC}`);
  console.error('Set KENNEY_SRC env var to override the default path.');
  process.exit(1);
}

const SS = join(KENNEY_SRC, '2D assets', 'Space Shooter Remastered', 'PNG');
const SS_ENEMIES = join(SS, 'Enemies');
const SS_LASERS = join(SS, 'Lasers');
const SS_EFFECTS = join(SS, 'Effects');
const SS_POWERUPS = join(SS, 'Power-ups');
const SS_BG = join(KENNEY_SRC, '2D assets', 'Space Shooter Remastered', 'Backgrounds');
const SS_LICENSE = join(KENNEY_SRC, '2D assets', 'Space Shooter Remastered');
const UI_ICONS = join(KENNEY_SRC, 'UI assets', 'Mobile Controls', 'Sprites', 'Icons', 'Default');
const UI_ICONS_LG = join(
  KENNEY_SRC,
  'UI assets',
  'Mobile Controls',
  'Sprites',
  'Icons',
  'Large (2\xd7)',
);
const UI_STYLEA = join(KENNEY_SRC, 'UI assets', 'Mobile Controls', 'Sprites', 'Style A', 'Default');
const UI_LICENSE = join(KENNEY_SRC, 'UI assets', 'Mobile Controls');
// Tank Pack — third source pack (explosion particle dot).
const TP_PNG = join(KENNEY_SRC, '2D assets', 'Tank Pack', 'PNG', 'Default size');
const TP_LICENSE = join(KENNEY_SRC, '2D assets', 'Tank Pack');
// Explosion Pack — fourth source pack (regularExplosion00..08 fireball flipbook).
const EP_PNG = join(KENNEY_SRC, '2D assets', 'Explosion Pack', 'PNG', 'Regular explosion');
const EP_LICENSE = join(KENNEY_SRC, '2D assets', 'Explosion Pack');

// Explicit curated file list — every entry auditable, no globs.
// Flat atlas sprites (go into kenney-src/ top level).
const ATLAS_FILES = [
  // Player ships (4 colors of ship1 + ufoRed)
  [SS, 'playerShip1_blue.png'],
  [SS, 'playerShip1_green.png'],
  [SS, 'playerShip1_orange.png'],
  [SS, 'playerShip1_red.png'],
  [SS, 'ufoRed.png'],
  // Enemies (20)
  [SS_ENEMIES, 'enemyBlack1.png'],
  [SS_ENEMIES, 'enemyBlack2.png'],
  [SS_ENEMIES, 'enemyBlack3.png'],
  [SS_ENEMIES, 'enemyBlack4.png'],
  [SS_ENEMIES, 'enemyBlack5.png'],
  [SS_ENEMIES, 'enemyBlue1.png'],
  [SS_ENEMIES, 'enemyBlue2.png'],
  [SS_ENEMIES, 'enemyBlue3.png'],
  [SS_ENEMIES, 'enemyBlue4.png'],
  [SS_ENEMIES, 'enemyBlue5.png'],
  [SS_ENEMIES, 'enemyGreen1.png'],
  [SS_ENEMIES, 'enemyGreen2.png'],
  [SS_ENEMIES, 'enemyGreen3.png'],
  [SS_ENEMIES, 'enemyGreen4.png'],
  [SS_ENEMIES, 'enemyGreen5.png'],
  [SS_ENEMIES, 'enemyRed1.png'],
  [SS_ENEMIES, 'enemyRed2.png'],
  [SS_ENEMIES, 'enemyRed3.png'],
  [SS_ENEMIES, 'enemyRed4.png'],
  [SS_ENEMIES, 'enemyRed5.png'],
  // Lasers: 01, 02, 08, 09 for Blue/Green/Red (12)
  [SS_LASERS, 'laserBlue01.png'],
  [SS_LASERS, 'laserBlue02.png'],
  [SS_LASERS, 'laserBlue08.png'],
  [SS_LASERS, 'laserBlue09.png'],
  [SS_LASERS, 'laserGreen01.png'],
  [SS_LASERS, 'laserGreen02.png'],
  [SS_LASERS, 'laserGreen08.png'],
  [SS_LASERS, 'laserGreen09.png'],
  [SS_LASERS, 'laserRed01.png'],
  [SS_LASERS, 'laserRed02.png'],
  [SS_LASERS, 'laserRed08.png'],
  [SS_LASERS, 'laserRed09.png'],
  // Effects: fire00..fire19 (20)
  [SS_EFFECTS, 'fire00.png'],
  [SS_EFFECTS, 'fire01.png'],
  [SS_EFFECTS, 'fire02.png'],
  [SS_EFFECTS, 'fire03.png'],
  [SS_EFFECTS, 'fire04.png'],
  [SS_EFFECTS, 'fire05.png'],
  [SS_EFFECTS, 'fire06.png'],
  [SS_EFFECTS, 'fire07.png'],
  [SS_EFFECTS, 'fire08.png'],
  [SS_EFFECTS, 'fire09.png'],
  [SS_EFFECTS, 'fire10.png'],
  [SS_EFFECTS, 'fire11.png'],
  [SS_EFFECTS, 'fire12.png'],
  [SS_EFFECTS, 'fire13.png'],
  [SS_EFFECTS, 'fire14.png'],
  [SS_EFFECTS, 'fire15.png'],
  [SS_EFFECTS, 'fire16.png'],
  [SS_EFFECTS, 'fire17.png'],
  [SS_EFFECTS, 'fire18.png'],
  [SS_EFFECTS, 'fire19.png'],
  // Power-ups: 4 colors × 3 types + 4 gold/pill (16)
  [SS_POWERUPS, 'powerupBlue_bolt.png'],
  [SS_POWERUPS, 'powerupBlue_shield.png'],
  [SS_POWERUPS, 'powerupBlue_star.png'],
  [SS_POWERUPS, 'powerupGreen_bolt.png'],
  [SS_POWERUPS, 'powerupGreen_shield.png'],
  [SS_POWERUPS, 'powerupGreen_star.png'],
  [SS_POWERUPS, 'powerupRed_bolt.png'],
  [SS_POWERUPS, 'powerupRed_shield.png'],
  [SS_POWERUPS, 'powerupRed_star.png'],
  [SS_POWERUPS, 'powerupYellow_bolt.png'],
  [SS_POWERUPS, 'powerupYellow_shield.png'],
  [SS_POWERUPS, 'powerupYellow_star.png'],
  [SS_POWERUPS, 'pill_red.png'],
  [SS_POWERUPS, 'bolt_gold.png'],
  [SS_POWERUPS, 'star_gold.png'],
  [SS_POWERUPS, 'shield_gold.png'],
  // UI icons (3)
  [UI_ICONS, 'icon_pause.png'],
  [UI_ICONS, 'icon_fire.png'],
  [UI_ICONS_LG, 'icon_cog.png'],
  // UI buttons/joystick (3)
  [UI_STYLEA, 'button_circle.png'],
  [UI_STYLEA, 'joystick_circle_pad_a.png'],
  [UI_STYLEA, 'joystick_circle_nub_a.png'],
  // Tank Pack — explosion particle dot (1).
  // Renamed from tank_bullet6.png → particle-dot.png to match the
  // particle-* naming convention used by the shape atlas (particle-spark,
  // particle-smoke) so the kenney frame name is self-documenting at call sites.
  [TP_PNG, 'tank_bullet6.png', 'particle-dot.png'],
  // Explosion Pack — Regular explosion flipbook (9 frames, 192×192).
  [EP_PNG, 'regularExplosion00.png'],
  [EP_PNG, 'regularExplosion01.png'],
  [EP_PNG, 'regularExplosion02.png'],
  [EP_PNG, 'regularExplosion03.png'],
  [EP_PNG, 'regularExplosion04.png'],
  [EP_PNG, 'regularExplosion05.png'],
  [EP_PNG, 'regularExplosion06.png'],
  [EP_PNG, 'regularExplosion07.png'],
  [EP_PNG, 'regularExplosion08.png'],
];

// Background — goes into bg/ subdir, excluded from atlas packing.
const BG_FILE = [SS_BG, 'darkPurple.png'];

// License files — copied into kenney/ (the packed output dir).
const LICENSE_FILES = [
  [join(SS_LICENSE, 'License.txt'), 'License-SpaceShooterRemastered.txt'],
  [join(UI_LICENSE, 'License.txt'), 'License-MobileControls.txt'],
  [join(TP_LICENSE, 'License.txt'), 'License-TankPack.txt'],
  [join(EP_LICENSE, 'License.txt'), 'License-ExplosionPack.txt'],
];

const DEST_ATLAS = join(APP_ROOT, 'assets', 'kenney-src');
const DEST_BG = join(APP_ROOT, 'assets', 'kenney-src', 'bg');
const DEST_KENNEY = join(APP_ROOT, 'assets', 'kenney');

await mkdir(DEST_ATLAS, { recursive: true });
await mkdir(DEST_BG, { recursive: true });
await mkdir(DEST_KENNEY, { recursive: true });

let copied = 0;

for (const [srcDir, name, destName] of ATLAS_FILES) {
  await copyFile(join(srcDir, name), join(DEST_ATLAS, destName ?? name));
  copied++;
}

await copyFile(join(BG_FILE[0], BG_FILE[1]), join(DEST_BG, BG_FILE[1]));

for (const [src, destName] of LICENSE_FILES) {
  await copyFile(src, join(DEST_KENNEY, destName));
}

console.log(`[import-kenney] copied ${copied} atlas sprites → ${DEST_ATLAS}`);
console.log(`[import-kenney] copied background → ${DEST_BG}`);
console.log(`[import-kenney] copied 4 license files → ${DEST_KENNEY}`);
