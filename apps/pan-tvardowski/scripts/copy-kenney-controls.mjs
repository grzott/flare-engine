import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');

const KENNEY_SRC =
  process.env.KENNEY_SRC ??
  'C:\\_PROG\\_ASSETS\\Kenney Game Assets All-in-1 3.5.0';

if (!existsSync(KENNEY_SRC)) {
  console.error(`[copy-kenney-controls] source dir not found: ${KENNEY_SRC}`);
  console.error('Set KENNEY_SRC env var to override the default path.');
  process.exit(1);
}

const UI_ICONS_LG = join(KENNEY_SRC, 'UI assets', 'Mobile Controls', 'Sprites', 'Icons', 'Large (2\xd7)');
const UI_STYLEA_LG = join(KENNEY_SRC, 'UI assets', 'Mobile Controls', 'Sprites', 'Style A', 'Large (2\xd7)');

// Explicit list — Large (2×) standalone PNGs for Metro bundling.
// These are NOT atlas frames. Kept in assets/kenney-controls/ so the atlas
// packer never picks them up (pack-kenney.mjs reads kenney-src/ only).
// Dimensions:
//   button_circle.png       128×128
//   joystick_circle_pad_a.png 256×256
//   joystick_circle_nub_a.png 128×128
const CONTROLS_FILES = [
  [UI_STYLEA_LG, 'button_circle.png'],
  [UI_STYLEA_LG, 'joystick_circle_pad_a.png'],
  [UI_STYLEA_LG, 'joystick_circle_nub_a.png'],
  [UI_ICONS_LG, 'icon_fire.png'],
];

const DEST = join(APP_ROOT, 'assets', 'kenney-controls');

await mkdir(DEST, { recursive: true });

let copied = 0;
for (const [srcDir, name] of CONTROLS_FILES) {
  await copyFile(join(srcDir, name), join(DEST, name));
  copied++;
}

console.log(`[copy-kenney-controls] copied ${copied} standalone PNGs → ${DEST}`);
