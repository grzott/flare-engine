/**
 * Zone palettes — three channels per zone (primary / accent / hazard).
 * Values are 32-bit ARGB integers (alpha = 0xff). Source: visual-reference.md §9.
 */

export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type AmbienceKind = 'ember' | 'pollen' | 'spray' | 'ash' | 'dust' | 'smoke' | 'float';

export interface ZonePalette {
  readonly id: ZoneId;
  readonly name: string;
  readonly primary: number;
  readonly accent: number;
  readonly hazard: number;
  readonly ambienceName: AmbienceKind;
  readonly ambienceParticles: number;
  readonly silverUi?: true;
}

const argb = (rgb: number): number => (0xff000000 | rgb) >>> 0;

/** ARGB int for gold UI token (used in all zones except Z8). */
const ARGB_GOLD = argb(0xc9a24a);
/** ARGB int for bone/silver UI token (used in Z8). */
const ARGB_BONE = argb(0xc7b89a);

/**
 * Returns the primary UI accent colour for the given zone as an ARGB integer.
 * Zone 8 (Księżyc) uses bone/silver; all others use gold.
 * Accepts the string zone-id form used in events.ts ('z1'..'z8').
 */
export function getUiPrimary(zoneId: string): number {
  const num = Number.parseInt(zoneId.slice(1), 10) as ZoneId;
  const palette = ZONE_PALETTES[num];
  return palette?.silverUi === true ? ARGB_BONE : ARGB_GOLD;
}

/**
 * Returns the primary UI accent colour as a CSS hex string ('#RRGGBB').
 * Suitable for React Native style props that require a string colour value.
 * Zone 8 (Księżyc) uses bone/silver; all others use gold.
 */
export function getUiPrimaryHex(zoneId: string): string {
  const argb = getUiPrimary(zoneId);
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const ZONE_PALETTES: Readonly<Record<ZoneId, ZonePalette>> = Object.freeze({
  1: {
    id: 1,
    name: 'Dachy Krakowa',
    primary: argb(0xb05a3c), // terracotta
    accent: argb(0x0e1a12), // ink-black
    hazard: argb(0xc9a24a), // gold
    ambienceName: 'ember',
    ambienceParticles: 32,
  },
  2: {
    id: 2,
    name: 'Puszcza Mazowiecka',
    primary: argb(0x243a29), // moss
    accent: argb(0x4a7a6a), // verdigris
    hazard: argb(0xc7b89a), // bone
    ambienceName: 'pollen',
    ambienceParticles: 80,
  },
  3: {
    id: 3,
    name: 'Wisła',
    primary: argb(0x4a7a6a), // verdigris
    accent: argb(0x8e6f2c), // gold-deep
    hazard: argb(0xc7b89a), // bone
    ambienceName: 'spray',
    ambienceParticles: 48,
  },
  4: {
    id: 4,
    name: 'Łęczyckie Błota',
    primary: argb(0x243a29), // moss
    accent: argb(0x8e6f2c), // gold-deep
    hazard: argb(0xe84b2a), // hazard
    ambienceName: 'ember',
    ambienceParticles: 96,
  },
  5: {
    id: 5,
    name: 'Łysa Góra',
    primary: argb(0x7a1322), // crimson-deep
    accent: argb(0x0e1a12), // ink-black (deck has #0E0810 — corrected to ink-black #0E1A12 per visual-reference.md §9 footnote)
    hazard: argb(0xc9a24a), // gold
    ambienceName: 'ash',
    ambienceParticles: 128,
  },
  6: {
    id: 6,
    name: 'Katakumby Warszawskie',
    primary: argb(0x1a1410), // unnamed dark (verbatim from visual-reference.md §9)
    accent: argb(0x8e6f2c), // gold-deep
    hazard: argb(0x7a1322), // crimson-deep
    ambienceName: 'dust',
    ambienceParticles: 24,
  },
  7: {
    id: 7,
    name: 'Karczma "Rzym"',
    primary: argb(0x8b3a1f), // rust
    accent: argb(0x7a1322), // crimson-deep
    hazard: argb(0xe8dcc4), // parchment
    ambienceName: 'smoke',
    ambienceParticles: 16,
  },
  8: {
    id: 8,
    name: 'Księżyc',
    primary: argb(0xc7b89a), // bone
    accent: argb(0x1a1f2a), // unnamed ink-variant (verbatim from visual-reference.md §9)
    hazard: argb(0xd4213d), // crimson
    ambienceName: 'float',
    ambienceParticles: 64,
    silverUi: true,
  },
});
