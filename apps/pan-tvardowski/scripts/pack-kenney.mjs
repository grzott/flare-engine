import { copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packAtlas } from '@flare-engine/cli';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');

const CB_MODE = process.argv.includes('--cb');

const INPUT = CB_MODE
  ? join(APP_ROOT, 'assets', 'kenney-recolored-cb')
  : join(APP_ROOT, 'assets', 'kenney-recolored');
const OUT = join(APP_ROOT, 'assets', 'kenney');
const ATLAS_NAME = CB_MODE ? 'zone1-cb' : 'zone1';

const result = await packAtlas({
  input: INPUT,
  out: OUT,
  name: ATLAS_NAME,
  padding: 2,
  maxSize: 2048,
  format: 'png',
});

// Guardrail: darkPurple must NOT be in the atlas frames.
// listPngs in pack-atlas.ts only reads top-level files (skips subdirs),
// so bg/darkPurple.png is naturally excluded. Verify defensively.
const frameNames = result.frames.map((f) => f.name);
if (frameNames.includes('darkPurple')) {
  console.error('[pack-kenney] FATAL: darkPurple ended up in the atlas frames. Aborting.');
  process.exit(1);
}

// Standard pass: copy recolored background to kenney/ output dir.
// CB pass: background is not re-exported (only the atlas changes for cb).
if (!CB_MODE) {
  await copyFile(join(INPUT, 'bg', 'darkPurple.png'), join(OUT, 'darkPurple.png'));
}

console.log(`[pack-kenney] atlas packed: ${result.frames.length} frames`);
console.log(`[pack-kenney] atlas size: ${result.width}x${result.height}`);
console.log(`[pack-kenney] image → ${result.imagePath}`);
console.log(`[pack-kenney] json  → ${result.jsonPath}`);
if (!CB_MODE) {
  console.log(`[pack-kenney] bg    → ${join(OUT, 'darkPurple.png')}`);
}
