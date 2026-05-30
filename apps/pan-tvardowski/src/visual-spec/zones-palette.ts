/**
 * Zone palettes — three channels per zone (primary / accent / hazard).
 * Values are 32-bit ARGB integers (alpha = 0xff). Source: visual-reference.md §9.
 */

import { hexToArgb } from '../util/hex';
import { THEME_SPEC } from './theme';

export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type AmbienceKind = 'ember' | 'pollen' | 'spray' | 'ash' | 'dust' | 'smoke' | 'float';

export interface ZonePalette {
  readonly id: ZoneId;
  readonly name: string;
  readonly primary: number;
  readonly accent: number;
  readonly hazard: number;
  readonly silverUi?: true;
}

/** ARGB int for gold UI token (used in all zones except Z8). */
const ARGB_GOLD = hexToArgb(THEME_SPEC.colors.gold);
/** ARGB int for bone/silver UI token (used in Z8). */
const ARGB_BONE = hexToArgb(THEME_SPEC.colors.bone);

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
    primary: hexToArgb(THEME_SPEC.colors.terracotta), // terracotta
    accent: hexToArgb(THEME_SPEC.colors.inkBlack), // ink-black
    hazard: hexToArgb(THEME_SPEC.colors.gold), // gold
  },
  2: {
    id: 2,
    name: 'Puszcza Mazowiecka',
    primary: hexToArgb(THEME_SPEC.colors.moss), // moss
    accent: hexToArgb(THEME_SPEC.colors.verdigris), // verdigris
    hazard: hexToArgb(THEME_SPEC.colors.bone), // bone
  },
  3: {
    id: 3,
    name: 'Wisła',
    primary: hexToArgb(THEME_SPEC.colors.verdigris), // verdigris
    accent: hexToArgb(THEME_SPEC.colors.goldDeep), // gold-deep
    hazard: hexToArgb(THEME_SPEC.colors.bone), // bone
  },
  4: {
    id: 4,
    name: 'Łęczyckie Błota',
    primary: hexToArgb(THEME_SPEC.colors.moss), // moss
    accent: hexToArgb(THEME_SPEC.colors.goldDeep), // gold-deep
    hazard: hexToArgb(THEME_SPEC.colors.hazard), // hazard
  },
  5: {
    id: 5,
    name: 'Łysa Góra',
    primary: hexToArgb(THEME_SPEC.colors.crimsonDeep), // crimson-deep
    accent: hexToArgb(THEME_SPEC.colors.inkBlack), // ink-black (deck has #0E0810 — corrected to ink-black #0E1A12 per visual-reference.md §9 footnote)
    hazard: hexToArgb(THEME_SPEC.colors.gold), // gold
  },
  6: {
    id: 6,
    name: 'Katakumby Warszawskie',
    primary: hexToArgb(THEME_SPEC.colors.katakumbyDark), // katakumby dark
    accent: hexToArgb(THEME_SPEC.colors.goldDeep), // gold-deep
    hazard: hexToArgb(THEME_SPEC.colors.crimsonDeep), // crimson-deep
  },
  7: {
    id: 7,
    name: 'Karczma "Rzym"',
    primary: hexToArgb(THEME_SPEC.colors.rust), // rust
    accent: hexToArgb(THEME_SPEC.colors.crimsonDeep), // crimson-deep
    hazard: hexToArgb(THEME_SPEC.colors.parchment), // parchment
  },
  8: {
    id: 8,
    name: 'Księżyc',
    primary: hexToArgb(THEME_SPEC.colors.bone), // bone
    accent: hexToArgb(THEME_SPEC.colors.lunarInk), // lunar ink
    hazard: hexToArgb(THEME_SPEC.colors.crimson), // crimson
    silverUi: true,
  },
});
