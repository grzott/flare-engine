/**
 * recolor-kenney.mjs
 *
 * Reads native kenney-src/ PNGs, applies per-family OKLCH remap, writes
 * recolored PNGs to assets/kenney-recolored/ (standard) or
 * assets/kenney-recolored-cb/ (--cb flag, deuteranope-safe variant).
 *
 * Usage:
 *   bun run scripts/recolor-kenney.mjs           # standard
 *   bun run scripts/recolor-kenney.mjs --cb      # colorblind variant
 *
 * Idempotent: reads from kenney-src/ (never modifies it); writes to a
 * separate output dir. Re-running is safe and deterministic.
 *
 * OKLab/OKLCH math is inlined (no @flare-engine/math import) so this script
 * runs as a plain Node/Bun ESM module without any package resolution.
 *
 * Families:
 *   - All families except bg and enemy-black: targetHue applied, chroma scaled.
 *   - bg, enemy-black (near-achromatic): preserve h, scale chroma only.
 *   - ui-controls: harmonize path — snap H to brand violet, clamp C low.
 *
 * Colorblind variant (--cb):
 *   - Same as standard EXCEPT laser-red → yellow (h≈86) and
 *     laser-blue → orange (h≈40) so the two bullet types are
 *     deuteranope-distinguishable.
 */

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');

const CB_MODE = process.argv.includes('--cb');

const SRC = join(APP_ROOT, 'assets', 'kenney-src');
const OUT = join(APP_ROOT, 'assets', CB_MODE ? 'kenney-recolored-cb' : 'kenney-recolored');

// ---------------------------------------------------------------------------
// THEME_REMAP — must match kenney-palette.ts THEME_REMAP (KG10 constraint).
// ---------------------------------------------------------------------------

const THEME_REMAP = {
  player: { targetHue: 47, chromaScale: 1.8, lightnessShift: 0 },
  'enemy-black': { targetHue: 0, chromaScale: 1.0, lightnessShift: 0 },
  'enemy-blue': { targetHue: 240, chromaScale: 1.2, lightnessShift: 0 },
  'enemy-green': { targetHue: 135, chromaScale: 1.15, lightnessShift: 0 },
  'enemy-red': { targetHue: 15, chromaScale: 1.2, lightnessShift: 0 },
  'enemy-ufo': { targetHue: 10, chromaScale: 1.3, lightnessShift: 0 },
  'laser-blue': { targetHue: 215, chromaScale: 1.3, lightnessShift: 0 },
  'laser-green': { targetHue: 145, chromaScale: 1.15, lightnessShift: 0 },
  'laser-red': { targetHue: 280, chromaScale: 1.3, lightnessShift: 0 },
  fire: { targetHue: 28, chromaScale: 1.1, lightnessShift: 0 },
  explosion: { targetHue: 35, chromaScale: 1.05, lightnessShift: 0 },
  'powerup-blue': { targetHue: 215, chromaScale: 1.2, lightnessShift: 0 },
  'powerup-green': { targetHue: 135, chromaScale: 1.15, lightnessShift: 0 },
  'powerup-red': { targetHue: 15, chromaScale: 1.2, lightnessShift: 0 },
  'powerup-yellow': { targetHue: 60, chromaScale: 1.1, lightnessShift: 0 },
  'pickup-gold': { targetHue: 47, chromaScale: 1.3, lightnessShift: 0 },
  'particle-dot': { targetHue: 47, chromaScale: 0.9, lightnessShift: 0 },
  bg: { targetHue: 0, chromaScale: 1.0, lightnessShift: 0 },
  'ui-controls': { targetHue: 270, chromaScale: 0.8, lightnessShift: 0 },
};

// Colorblind overrides for laser families only.
const CB_OVERRIDES = {
  'laser-red': { targetHue: 86, chromaScale: 1.3, lightnessShift: 0 },
  'laser-blue': { targetHue: 40, chromaScale: 1.3, lightnessShift: 0 },
};

// Near-achromatic families — h is unreliable, preserve it (drive via C only).
const ACHROMATIC_FAMILIES = new Set(['bg', 'enemy-black']);

// Harmonize-only families — snap H to brand violet, clamp C low.
const HARMONIZE_FAMILIES = new Set(['ui-controls']);
const HARMONIZE_HUE = 270;
const HARMONIZE_C_MAX = 0.06;

// ---------------------------------------------------------------------------
// Family manifest — maps filename → family id (mirrors audit-kenney-palette.ts)
// ---------------------------------------------------------------------------

const FILE_FAMILY = new Map([
  // player
  ['playerShip1_blue.png', 'player'],
  ['playerShip1_green.png', 'player'],
  ['playerShip1_orange.png', 'player'],
  ['playerShip1_red.png', 'player'],
  // enemy-black
  ['enemyBlack1.png', 'enemy-black'],
  ['enemyBlack2.png', 'enemy-black'],
  ['enemyBlack3.png', 'enemy-black'],
  ['enemyBlack4.png', 'enemy-black'],
  ['enemyBlack5.png', 'enemy-black'],
  // enemy-blue
  ['enemyBlue1.png', 'enemy-blue'],
  ['enemyBlue2.png', 'enemy-blue'],
  ['enemyBlue3.png', 'enemy-blue'],
  ['enemyBlue4.png', 'enemy-blue'],
  ['enemyBlue5.png', 'enemy-blue'],
  // enemy-green
  ['enemyGreen1.png', 'enemy-green'],
  ['enemyGreen2.png', 'enemy-green'],
  ['enemyGreen3.png', 'enemy-green'],
  ['enemyGreen4.png', 'enemy-green'],
  ['enemyGreen5.png', 'enemy-green'],
  // enemy-red
  ['enemyRed1.png', 'enemy-red'],
  ['enemyRed2.png', 'enemy-red'],
  ['enemyRed3.png', 'enemy-red'],
  ['enemyRed4.png', 'enemy-red'],
  ['enemyRed5.png', 'enemy-red'],
  // enemy-ufo
  ['ufoRed.png', 'enemy-ufo'],
  // laser-blue
  ['laserBlue01.png', 'laser-blue'],
  ['laserBlue02.png', 'laser-blue'],
  ['laserBlue08.png', 'laser-blue'],
  ['laserBlue09.png', 'laser-blue'],
  // laser-green
  ['laserGreen01.png', 'laser-green'],
  ['laserGreen02.png', 'laser-green'],
  ['laserGreen08.png', 'laser-green'],
  ['laserGreen09.png', 'laser-green'],
  // laser-red
  ['laserRed01.png', 'laser-red'],
  ['laserRed02.png', 'laser-red'],
  ['laserRed08.png', 'laser-red'],
  ['laserRed09.png', 'laser-red'],
  // fire
  ['fire00.png', 'fire'],
  ['fire01.png', 'fire'],
  ['fire02.png', 'fire'],
  ['fire03.png', 'fire'],
  ['fire04.png', 'fire'],
  ['fire05.png', 'fire'],
  ['fire06.png', 'fire'],
  ['fire07.png', 'fire'],
  ['fire08.png', 'fire'],
  ['fire09.png', 'fire'],
  ['fire10.png', 'fire'],
  ['fire11.png', 'fire'],
  ['fire12.png', 'fire'],
  ['fire13.png', 'fire'],
  ['fire14.png', 'fire'],
  ['fire15.png', 'fire'],
  ['fire16.png', 'fire'],
  ['fire17.png', 'fire'],
  ['fire18.png', 'fire'],
  ['fire19.png', 'fire'],
  // explosion
  ['regularExplosion00.png', 'explosion'],
  ['regularExplosion01.png', 'explosion'],
  ['regularExplosion02.png', 'explosion'],
  ['regularExplosion03.png', 'explosion'],
  ['regularExplosion04.png', 'explosion'],
  ['regularExplosion05.png', 'explosion'],
  ['regularExplosion06.png', 'explosion'],
  ['regularExplosion07.png', 'explosion'],
  ['regularExplosion08.png', 'explosion'],
  // powerup-blue
  ['powerupBlue_bolt.png', 'powerup-blue'],
  ['powerupBlue_shield.png', 'powerup-blue'],
  ['powerupBlue_star.png', 'powerup-blue'],
  // powerup-green
  ['powerupGreen_bolt.png', 'powerup-green'],
  ['powerupGreen_shield.png', 'powerup-green'],
  ['powerupGreen_star.png', 'powerup-green'],
  // powerup-red
  ['powerupRed_bolt.png', 'powerup-red'],
  ['powerupRed_shield.png', 'powerup-red'],
  ['powerupRed_star.png', 'powerup-red'],
  // powerup-yellow
  ['powerupYellow_bolt.png', 'powerup-yellow'],
  ['powerupYellow_shield.png', 'powerup-yellow'],
  ['powerupYellow_star.png', 'powerup-yellow'],
  // pill_red is powerup-red (same family visually)
  ['pill_red.png', 'powerup-red'],
  // pickup-gold
  ['bolt_gold.png', 'pickup-gold'],
  ['star_gold.png', 'pickup-gold'],
  ['shield_gold.png', 'pickup-gold'],
  // ui-controls (atlas pack sprites)
  ['icon_pause.png', 'ui-controls'],
  ['icon_fire.png', 'ui-controls'],
  ['icon_cog.png', 'ui-controls'],
  ['button_circle.png', 'ui-controls'],
  ['joystick_circle_pad_a.png', 'ui-controls'],
  ['joystick_circle_nub_a.png', 'ui-controls'],
  // particle-dot
  ['particle-dot.png', 'particle-dot'],
  // bg
  ['darkPurple.png', 'bg'],
]);

// ---------------------------------------------------------------------------
// Inline OKLab / OKLCH math (sRGB ↔ linear; linear ↔ OKLab ↔ OKLCH)
// ---------------------------------------------------------------------------

function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function delinearize(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function linearToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lc = Math.cbrt(l);
  const mc = Math.cbrt(m);
  const sc = Math.cbrt(s);
  return {
    L: 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc,
    a: 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc,
    b: 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc,
  };
}

function oklabToLinear(L, a, b) {
  const lc = L + 0.3963377774 * a + 0.2158037573 * b;
  const mc = L - 0.1055613458 * a - 0.0638541728 * b;
  const sc = L - 0.0894841775 * a - 1.291485548 * b;
  const l = lc * lc * lc;
  const m = mc * mc * mc;
  const s = sc * sc * sc;
  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.004196086 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function oklabToOklch(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  const h = C < 1e-7 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
}

function oklchToOklab(L, C, h) {
  const hRad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(hRad), b: C * Math.sin(hRad) };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Per-pixel remap
// ---------------------------------------------------------------------------

/**
 * Apply OKLCH remap to a single sRGB pixel (r,g,b in [0,255]; a in [0,255]).
 * Returns remapped [r,g,b] (clamped 0-255); alpha is unchanged.
 *
 * @param {string} family
 * @param {{ targetHue: number, chromaScale: number, lightnessShift: number }} remap
 * @param {number} ri   sRGB red   0-255
 * @param {number} gi   sRGB green 0-255
 * @param {number} bi   sRGB blue  0-255
 */
function remapPixel(family, remap, ri, gi, bi) {
  const r = linearize(ri / 255);
  const g = linearize(gi / 255);
  const b = linearize(bi / 255);

  const lab = linearToOklab(r, g, b);
  const { L, C, h } = oklabToOklch(lab.L, lab.a, lab.b);

  let newH;
  let newC;
  let newL;

  if (HARMONIZE_FAMILIES.has(family)) {
    newH = HARMONIZE_HUE;
    newC = Math.min(C * remap.chromaScale, HARMONIZE_C_MAX);
    newL = clamp01(L + remap.lightnessShift);
  } else if (ACHROMATIC_FAMILIES.has(family)) {
    newH = h;
    newC = C * remap.chromaScale;
    newL = clamp01(L + remap.lightnessShift);
  } else {
    newH = remap.targetHue;
    newC = C * remap.chromaScale;
    newL = clamp01(L + remap.lightnessShift);
  }

  const newLab = oklchToOklab(newL, newC, newH);
  const lin = oklabToLinear(newLab.L, newLab.a, newLab.b);

  return [
    Math.round(clamp01(delinearize(lin.r)) * 255),
    Math.round(clamp01(delinearize(lin.g)) * 255),
    Math.round(clamp01(delinearize(lin.b)) * 255),
  ];
}

// ---------------------------------------------------------------------------
// Process one PNG file
// ---------------------------------------------------------------------------

async function processFile(srcPath, destPath, family, remap) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4;
  const pixelCount = info.width * info.height;
  const out = Buffer.from(data);

  for (let i = 0; i < pixelCount; i++) {
    const off = i * channels;
    const a = out[off + 3];
    if (a < 16) continue;

    const ri = out[off];
    const gi = out[off + 1];
    const bi = out[off + 2];

    const [nr, ng, nb] = remapPixel(family, remap, ri, gi, bi);
    out[off] = nr;
    out[off + 1] = ng;
    out[off + 2] = nb;
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels } })
    .png()
    .toFile(destPath);
}

// ---------------------------------------------------------------------------
// Walk kenney-src/ recursively, mirror structure to OUT/
// ---------------------------------------------------------------------------

async function walkDir(srcDir, outDir) {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const outPath = join(outDir, entry.name);

    if (entry.isDirectory()) {
      await mkdir(outPath, { recursive: true });
      await walkDir(srcPath, outPath);
    } else if (extname(entry.name).toLowerCase() === '.png') {
      const family = FILE_FAMILY.get(entry.name);

      if (family === undefined) {
        // Not in the family manifest — copy verbatim.
        await copyFile(srcPath, outPath);
        continue;
      }

      let remap = THEME_REMAP[family];
      if (CB_MODE && family in CB_OVERRIDES) {
        remap = CB_OVERRIDES[family];
      }

      if (!remap) {
        await copyFile(srcPath, outPath);
        continue;
      }

      // bg family is identity (chromaScale 1.0, no hue change) — copy directly.
      if (family === 'bg' && !CB_MODE) {
        await copyFile(srcPath, outPath);
        continue;
      }

      await processFile(srcPath, outPath, family, remap);
      process.stdout.write('.');
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[recolor-kenney] mode: ${CB_MODE ? 'colorblind (--cb)' : 'standard'}`);
  console.log(`[recolor-kenney] source: ${SRC}`);
  console.log(`[recolor-kenney] output: ${OUT}`);

  await mkdir(OUT, { recursive: true });
  await mkdir(join(OUT, 'bg'), { recursive: true });

  process.stdout.write('[recolor-kenney] processing: ');
  await walkDir(SRC, OUT);
  process.stdout.write('\n');

  console.log('[recolor-kenney] done');
}

main().catch((err) => {
  console.error('[recolor-kenney] FATAL:', err);
  process.exit(1);
});
