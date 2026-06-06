/**
 * audit-kenney-palette.ts
 *
 * Bun build-time script. Reads kenney-src PNGs, runs per-family median-cut →
 * k-means in OKLab (k=5, 20 fixed iterations, deterministic pixel order), then
 * emits two artifacts:
 *   - apps/pan-tvardowski/src/visual-spec/kenney-palette.ts  (TS SoT module)
 *   - apps/pan-tvardowski/docs/kenney-palette.md             (human-readable tables)
 *
 * Usage:
 *   bun run scripts/audit-kenney-palette.ts
 *
 * Determinism contract:
 *   - Files processed in lexicographic order within each family.
 *   - Pixels in raster order (top-left → bottom-right).
 *   - k=5 seeded via median-cut (no Math.random).
 *   - 20 fixed iterations, no convergence early-exit.
 *   - Summation order is canonical (file order × raster order) each iteration.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Color } from '@flare-engine/math';
import type { Oklab, Oklch } from '@flare-engine/math';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const KENNEY_SRC = join(APP_ROOT, 'assets', 'kenney-src');
const OUT_TS = join(APP_ROOT, 'src', 'visual-spec', 'kenney-palette.ts');
const OUT_MD = join(APP_ROOT, 'docs', 'kenney-palette.md');

// ---------------------------------------------------------------------------
// Family manifest — maps family-id → file patterns (exact names, no regex)
// ---------------------------------------------------------------------------

const FAMILIES: ReadonlyArray<{ id: string; files: string[] }> = [
  {
    id: 'player',
    files: [
      'playerShip1_blue.png',
      'playerShip1_green.png',
      'playerShip1_orange.png',
      'playerShip1_red.png',
    ],
  },
  {
    id: 'enemy-black',
    files: [
      'enemyBlack1.png',
      'enemyBlack2.png',
      'enemyBlack3.png',
      'enemyBlack4.png',
      'enemyBlack5.png',
    ],
  },
  {
    id: 'enemy-blue',
    files: [
      'enemyBlue1.png',
      'enemyBlue2.png',
      'enemyBlue3.png',
      'enemyBlue4.png',
      'enemyBlue5.png',
    ],
  },
  {
    id: 'enemy-green',
    files: [
      'enemyGreen1.png',
      'enemyGreen2.png',
      'enemyGreen3.png',
      'enemyGreen4.png',
      'enemyGreen5.png',
    ],
  },
  {
    id: 'enemy-red',
    files: ['enemyRed1.png', 'enemyRed2.png', 'enemyRed3.png', 'enemyRed4.png', 'enemyRed5.png'],
  },
  {
    id: 'enemy-ufo',
    files: ['ufoRed.png'],
  },
  {
    id: 'laser-blue',
    files: ['laserBlue01.png', 'laserBlue02.png', 'laserBlue08.png', 'laserBlue09.png'],
  },
  {
    id: 'laser-green',
    files: ['laserGreen01.png', 'laserGreen02.png', 'laserGreen08.png', 'laserGreen09.png'],
  },
  {
    id: 'laser-red',
    files: ['laserRed01.png', 'laserRed02.png', 'laserRed08.png', 'laserRed09.png'],
  },
  {
    id: 'fire',
    files: [
      'fire00.png',
      'fire01.png',
      'fire02.png',
      'fire03.png',
      'fire04.png',
      'fire05.png',
      'fire06.png',
      'fire07.png',
      'fire08.png',
      'fire09.png',
      'fire10.png',
      'fire11.png',
      'fire12.png',
      'fire13.png',
      'fire14.png',
      'fire15.png',
      'fire16.png',
      'fire17.png',
      'fire18.png',
      'fire19.png',
    ],
  },
  {
    id: 'explosion',
    files: [
      'regularExplosion00.png',
      'regularExplosion01.png',
      'regularExplosion02.png',
      'regularExplosion03.png',
      'regularExplosion04.png',
      'regularExplosion05.png',
      'regularExplosion06.png',
      'regularExplosion07.png',
      'regularExplosion08.png',
    ],
  },
  {
    id: 'powerup-blue',
    files: ['powerupBlue_bolt.png', 'powerupBlue_shield.png', 'powerupBlue_star.png'],
  },
  {
    id: 'powerup-green',
    files: ['powerupGreen_bolt.png', 'powerupGreen_shield.png', 'powerupGreen_star.png'],
  },
  {
    id: 'powerup-red',
    files: ['powerupRed_bolt.png', 'powerupRed_shield.png', 'powerupRed_star.png'],
  },
  {
    id: 'powerup-yellow',
    files: ['powerupYellow_bolt.png', 'powerupYellow_shield.png', 'powerupYellow_star.png'],
  },
  {
    id: 'pickup-gold',
    files: ['bolt_gold.png', 'shield_gold.png', 'star_gold.png'],
  },
  {
    id: 'particle-dot',
    files: ['particle-dot.png'],
  },
  {
    id: 'bg',
    files: ['bg/darkPurple.png'],
  },
  {
    id: 'ui-controls',
    files: [
      'button_circle.png',
      'joystick_circle_nub_a.png',
      'joystick_circle_pad_a.png',
      'icon_cog.png',
      'icon_fire.png',
      'icon_pause.png',
    ],
  },
];

// ---------------------------------------------------------------------------
// Pixel extraction
// ---------------------------------------------------------------------------

async function extractOklabPixels(files: string[]): Promise<Float64Array> {
  const allTriples: number[] = [];

  for (const file of files) {
    const absPath = join(KENNEY_SRC, file);
    const { data, info } = await sharp(absPath).raw().toBuffer({ resolveWithObject: true });

    const channels = info.channels; // 3 or 4
    const pixelCount = info.width * info.height;

    for (let i = 0; i < pixelCount; i++) {
      const offset = i * channels;
      const r = (data[offset] as number) / 255;
      const g = (data[offset + 1] as number) / 255;
      const b = (data[offset + 2] as number) / 255;
      const a = channels === 4 ? (data[offset + 3] as number) / 255 : 1;

      if (a < 16 / 255) continue;

      const lab = Color.toOklab({ r, g, b, a: 1 });
      allTriples.push(lab.L, lab.a, lab.b);
    }
  }

  return new Float64Array(allTriples);
}

// ---------------------------------------------------------------------------
// Median-cut seeding (k=5, deterministic)
// ---------------------------------------------------------------------------

function medianCutSeed(pixels: Float64Array, k: number): Float64Array {
  const n = pixels.length / 3;
  if (n === 0) {
    const seeds = new Float64Array(k * 3);
    return seeds;
  }

  // Each bucket is an array of pixel indices
  type Bucket = number[];

  function seedsFromBuckets(buckets: Bucket[]): Float64Array {
    const result = new Float64Array(buckets.length * 3);
    for (let bi = 0; bi < buckets.length; bi++) {
      const bucket = buckets[bi] as Bucket;
      if (bucket.length === 0) continue;
      // Median index
      const midIdx = Math.floor(bucket.length / 2);
      const pixIdx = bucket[midIdx] as number;
      result[bi * 3 + 0] = pixels[pixIdx * 3 + 0] as number;
      result[bi * 3 + 1] = pixels[pixIdx * 3 + 1] as number;
      result[bi * 3 + 2] = pixels[pixIdx * 3 + 2] as number;
    }
    return result;
  }

  function splitBucket(bucket: Bucket): [Bucket, Bucket] {
    if (bucket.length === 0) return [[], []];

    // Find axis of highest range among L (0), a (1), b (2)
    let minL = Number.POSITIVE_INFINITY,
      maxL = Number.NEGATIVE_INFINITY;
    let minA = Number.POSITIVE_INFINITY,
      maxA = Number.NEGATIVE_INFINITY;
    let minB = Number.POSITIVE_INFINITY,
      maxB = Number.NEGATIVE_INFINITY;

    for (const idx of bucket) {
      const L = pixels[idx * 3 + 0] as number;
      const a = pixels[idx * 3 + 1] as number;
      const b = pixels[idx * 3 + 2] as number;
      if (L < minL) minL = L;
      if (L > maxL) maxL = L;
      if (a < minA) minA = a;
      if (a > maxA) maxA = a;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }

    const rangeL = maxL - minL;
    const rangeA = maxA - minA;
    const rangeB = maxB - minB;

    let axis: 0 | 1 | 2;
    if (rangeL >= rangeA && rangeL >= rangeB) {
      axis = 0;
    } else if (rangeA >= rangeB) {
      axis = 1;
    } else {
      axis = 2;
    }

    // Sort bucket by chosen axis
    const sorted = [...bucket].sort((ia, ib) => {
      const va = pixels[ia * 3 + axis] as number;
      const vb = pixels[ib * 3 + axis] as number;
      return va - vb;
    });

    const mid = Math.floor(sorted.length / 2);
    return [sorted.slice(0, mid), sorted.slice(mid)];
  }

  const allIndices: number[] = Array.from({ length: n }, (_, i) => i);
  const buckets: Bucket[] = [allIndices];

  // Split until we have k buckets
  while (buckets.length < k) {
    // Split the largest bucket
    let largestIdx = 0;
    for (let i = 1; i < buckets.length; i++) {
      if ((buckets[i] as Bucket).length > (buckets[largestIdx] as Bucket).length) {
        largestIdx = i;
      }
    }
    const [a, b] = splitBucket(buckets[largestIdx] as Bucket);
    buckets.splice(largestIdx, 1, a, b);
    if (buckets.length >= k) break;
  }

  return seedsFromBuckets(buckets.slice(0, k));
}

// ---------------------------------------------------------------------------
// k-means in OKLab (fixed 20 iterations)
// ---------------------------------------------------------------------------

function kMeans(pixels: Float64Array, k: number): Float64Array {
  const n = pixels.length / 3;
  if (n === 0) return new Float64Array(k * 3);

  // Initialize centroids via median-cut
  const centroids = medianCutSeed(pixels, k);
  const assignments = new Int32Array(n);

  for (let iter = 0; iter < 20; iter++) {
    // Assignment step: each pixel → nearest centroid
    for (let i = 0; i < n; i++) {
      const pL = pixels[i * 3 + 0] as number;
      const pA = pixels[i * 3 + 1] as number;
      const pB = pixels[i * 3 + 2] as number;

      let bestDist = Number.POSITIVE_INFINITY;
      let bestC = 0;

      for (let c = 0; c < k; c++) {
        const dL = pL - (centroids[c * 3 + 0] as number);
        const dA = pA - (centroids[c * 3 + 1] as number);
        const dB = pB - (centroids[c * 3 + 2] as number);
        const dist = dL * dL + dA * dA + dB * dB;
        if (dist < bestDist) {
          bestDist = dist;
          bestC = c;
        }
      }
      assignments[i] = bestC;
    }

    // Update step: recompute centroid = arithmetic mean of assigned pixels
    const sums = new Float64Array(k * 3);
    const counts = new Int32Array(k);

    for (let i = 0; i < n; i++) {
      const c = assignments[i] as number;
      sums[c * 3 + 0] += pixels[i * 3 + 0] as number;
      sums[c * 3 + 1] += pixels[i * 3 + 1] as number;
      sums[c * 3 + 2] += pixels[i * 3 + 2] as number;
      counts[c]++;
    }

    for (let c = 0; c < k; c++) {
      if ((counts[c] as number) > 0) {
        centroids[c * 3 + 0] = (sums[c * 3 + 0] as number) / (counts[c] as number);
        centroids[c * 3 + 1] = (sums[c * 3 + 1] as number) / (counts[c] as number);
        centroids[c * 3 + 2] = (sums[c * 3 + 2] as number) / (counts[c] as number);
      }
    }
  }

  return centroids;
}

// ---------------------------------------------------------------------------
// Per-family run
// ---------------------------------------------------------------------------

type FamilyResult = {
  family: string;
  ramp: readonly [string, string, string, string, string];
  oklch: readonly [Oklch, Oklch, Oklch, Oklch, Oklch];
};

async function processFamily(familyId: string, files: string[]): Promise<FamilyResult> {
  const pixels = await extractOklabPixels(files);
  const centroids = kMeans(pixels, 5);

  // Convert each centroid to Oklch
  const entries: { lab: Oklab; lch: Oklch; hex: string }[] = [];
  for (let c = 0; c < 5; c++) {
    const lab: Oklab = {
      L: centroids[c * 3 + 0] as number,
      a: centroids[c * 3 + 1] as number,
      b: centroids[c * 3 + 2] as number,
    };
    const color = Color.fromOklab(lab);
    const lch = Color.toOklch(color);
    const hex = Color.toHex(color);
    entries.push({ lab, lch, hex });
  }

  // Sort dark → light by L
  entries.sort((a, b) => a.lch.L - b.lch.L);

  return {
    family: familyId,
    ramp: [entries[0]!.hex, entries[1]!.hex, entries[2]!.hex, entries[3]!.hex, entries[4]!.hex],
    oklch: [entries[0]!.lch, entries[1]!.lch, entries[2]!.lch, entries[3]!.lch, entries[4]!.lch],
  };
}

// ---------------------------------------------------------------------------
// Code generation helpers
// ---------------------------------------------------------------------------

/** Format a float to N decimal places, stripping trailing zeros. */
function fmt(n: number, decimals: number): string {
  return String(Number.parseFloat(n.toFixed(decimals)));
}

function fmtOklch(lch: Oklch): string {
  const L = fmt(lch.L, 6);
  const C = fmt(lch.C, 6);
  const h = fmt(lch.h, 4);
  return `{ L: ${L}, C: ${C}, h: ${h} }`;
}

function generateTs(results: FamilyResult[]): string {
  const lines: string[] = [];

  lines.push(
    '/**',
    ' * kenney-palette.ts — GENERATED by scripts/audit-kenney-palette.ts',
    ' *',
    ' * DO NOT EDIT BY HAND. Re-run: bun run audit:kenney-palette',
    ' *',
    ' * Canonical OKLCH palette for all Kenney Space Shooter families used in',
    ' * Pan Tvardowski zone-1. Each family ramp has 5 entries sorted dark→light.',
    ' * Achromatic families (bg, enemy-black) have h=0 — see KG10 notes.',
    ' */',
    '',
    "import type { Oklch } from '@flare-engine/math';",
    '',
    'export type KenneyRamp = readonly [string, string, string, string, string];',
    '',
    'export type KenneyPaletteEntry = {',
    '  readonly family: string;',
    '  readonly ramp: KenneyRamp;',
    '  readonly oklch: readonly [Oklch, Oklch, Oklch, Oklch, Oklch];',
    '};',
    '',
    'export type KenneyRole =',
    "  | 'player'",
    "  | 'enemy'",
    "  | 'enemy-ufo'",
    "  | 'bullet-player'",
    "  | 'bullet-enemy'",
    "  | 'fire'",
    "  | 'explosion'",
    "  | 'pickup'",
    "  | 'bg';",
    '',
    'export type RemapTarget = {',
    '  readonly targetHue: number;',
    '  readonly chromaScale: number;',
    '  readonly lightnessShift: number;',
    '};',
    '',
  );

  // KENNEY_PALETTE map entries
  lines.push('export const KENNEY_PALETTE: ReadonlyMap<string, KenneyPaletteEntry> = new Map([');
  for (const r of results) {
    const rampInline = r.ramp.map((h) => `'${h}'`).join(', ');
    lines.push('  [');
    lines.push(`    '${r.family}',`);
    lines.push('    {');
    lines.push(`      family: '${r.family}',`);
    lines.push(`      ramp: [${rampInline}],`);
    lines.push('      oklch: [');
    for (const lch of r.oklch) {
      lines.push(`        ${fmtOklch(lch)},`);
    }
    lines.push('      ],');
    lines.push('    },');
    lines.push('  ],');
  }
  lines.push(']);', '');

  // KENNEY_ROLES
  lines.push(
    'export const KENNEY_ROLES: Readonly<Record<KenneyRole, string>> = {',
    "  player: 'player',",
    "  enemy: 'enemy-black',",
    "  'enemy-ufo': 'enemy-ufo',",
    "  'bullet-player': 'laser-blue',",
    "  'bullet-enemy': 'laser-red',",
    "  fire: 'fire',",
    "  explosion: 'explosion',",
    "  pickup: 'powerup-red',",
    "  bg: 'bg',",
    '} as const;',
    '',
  );

  // THEME_REMAP — one entry per family
  // Initial values are reasonable placeholders for KG10 to refine.
  // Note: bg and enemy-black are near-achromatic (h≈0) — targetHue is
  // irrelevant for those; KG10 must drive remap via chromaScale only.
  const remapDefaults: Record<
    string,
    { targetHue: number; chromaScale: number; lightnessShift: number }
  > = {
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

  lines.push(
    '/**',
    ' * Forward-declared remap targets consumed/refined by KG10.',
    ' * Every family in KENNEY_PALETTE has exactly one entry.',
    ' *',
    ' * KG10 note: bg and enemy-black are near-achromatic (h≈0 from the',
    ' * OKLCH achromatic guard). Remap logic must NOT rely on their native h.',
    ' * Drive those families via chromaScale only.',
    ' */',
    'export const THEME_REMAP: Readonly<Record<string, RemapTarget>> = {',
  );

  for (const r of results) {
    const def = remapDefaults[r.family] ?? { targetHue: 0, chromaScale: 1.0, lightnessShift: 0 };
    // Only quote keys that contain non-identifier characters (e.g. hyphens).
    const needsQuote = /[^a-zA-Z0-9_$]/.test(r.family);
    const key = needsQuote ? `'${r.family}'` : r.family;
    lines.push(
      `  ${key}: { targetHue: ${def.targetHue}, chromaScale: ${def.chromaScale}, lightnessShift: ${def.lightnessShift} },`,
    );
  }

  lines.push('} as const;', '');

  return lines.join('\n');
}

function generateMd(results: FamilyResult[]): string {
  const lines: string[] = [];
  lines.push('# Kenney Palette — OKLCH Ramps');
  lines.push('');
  lines.push('Generated by `scripts/audit-kenney-palette.ts`.');
  lines.push('Do not edit by hand. Re-run: `bun run audit:kenney-palette`');
  lines.push('');
  lines.push(
    '> **KG10 note:** Families `bg` and `enemy-black` are near-achromatic (h≈0).',
    '> The OKLCH achromatic guard in `@flare-engine/math` sets h=0 when chroma < 1e-7.',
    '> `THEME_REMAP` entries for these families must drive remap via `chromaScale` only;',
    '> `targetHue` is irrelevant for achromatic inputs.',
  );
  lines.push('');

  for (const r of results) {
    lines.push(`## ${r.family}`);
    lines.push('');
    lines.push('| # | Hex | L | C | h |');
    lines.push('|---|-----|---|---|---|');
    for (let i = 0; i < 5; i++) {
      const hex = r.ramp[i]!;
      const lch = r.oklch[i]!;
      lines.push(
        `| ${i} | \`${hex}\` | ${lch.L.toFixed(4)} | ${lch.C.toFixed(4)} | ${lch.h.toFixed(2)} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('[audit-kenney-palette] reading kenney-src PNGs …');

  const results: FamilyResult[] = [];
  for (const family of FAMILIES) {
    process.stdout.write(`  family: ${family.id} … `);
    const result = await processFamily(family.id, family.files);
    results.push(result);
    console.log('done');
  }

  console.log(`[audit-kenney-palette] ${results.length} families processed`);

  const tsSource = generateTs(results);
  const mdSource = generateMd(results);

  await mkdir(dirname(OUT_TS), { recursive: true });
  await mkdir(dirname(OUT_MD), { recursive: true });

  await writeFile(OUT_TS, tsSource, 'utf8');
  await writeFile(OUT_MD, mdSource, 'utf8');

  console.log(`[audit-kenney-palette] wrote ${OUT_TS}`);
  console.log(`[audit-kenney-palette] wrote ${OUT_MD}`);
}

main().catch((err) => {
  console.error('[audit-kenney-palette] FATAL:', err);
  process.exit(1);
});
