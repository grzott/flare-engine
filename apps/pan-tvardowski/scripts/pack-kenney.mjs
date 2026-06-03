import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { packAtlas } from '@flare-engine/cli';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');

const INPUT = join(APP_ROOT, 'assets', 'kenney-src');
const OUT = join(APP_ROOT, 'assets', 'kenney');

const result = await packAtlas({
  input: INPUT,
  out: OUT,
  name: 'zone1',
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

// Copy standalone background from kenney-src/bg/ to kenney/.
await copyFile(
  join(INPUT, 'bg', 'darkPurple.png'),
  join(OUT, 'darkPurple.png'),
);

console.log(`[pack-kenney] atlas packed: ${result.frames.length} frames`);
console.log(`[pack-kenney] atlas size: ${result.width}x${result.height}`);
console.log(`[pack-kenney] image → ${result.imagePath}`);
console.log(`[pack-kenney] json  → ${result.jsonPath}`);
console.log(`[pack-kenney] bg    → ${join(OUT, 'darkPurple.png')}`);
