/**
 * Zone palettes — three channels per zone (primary / accent / hazard).
 * Values are 32-bit ARGB integers (alpha = 0xff). Source: visual-reference.md §9.
 */

export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ZonePalette {
  readonly id: ZoneId;
  readonly name: string;
  readonly primary: number;
  readonly accent: number;
  readonly hazard: number;
}

const argb = (rgb: number): number => (0xff000000 | rgb) >>> 0;

export const ZONE_PALETTES: Readonly<Record<ZoneId, ZonePalette>> = Object.freeze({
  1: {
    id: 1,
    name: 'Dachy Krakowa',
    primary: argb(0xb05a3c), // terracotta
    accent: argb(0x0e1a12), // ink-black
    hazard: argb(0xc9a24a), // gold
  },
  2: {
    id: 2,
    name: 'Puszcza Mazowiecka',
    primary: argb(0x243a29), // moss
    accent: argb(0x4a7a6a), // verdigris
    hazard: argb(0xc7b89a), // bone
  },
  3: {
    id: 3,
    name: 'Wisła',
    primary: argb(0x4a7a6a), // verdigris
    accent: argb(0x8e6f2c), // gold-deep
    hazard: argb(0xc7b89a), // bone
  },
  4: {
    id: 4,
    name: 'Łęczyckie Błota',
    primary: argb(0x243a29), // moss
    accent: argb(0x8e6f2c), // gold-deep
    hazard: argb(0xe84b2a), // hazard
  },
  5: {
    id: 5,
    name: 'Łysa Góra',
    primary: argb(0x7a1322), // crimson-deep
    accent: argb(0x0e1a12), // ink-black (deck has #0E0810 — corrected to ink-black #0E1A12 per visual-reference.md §9 footnote)
    hazard: argb(0xc9a24a), // gold
  },
  6: {
    id: 6,
    name: 'Katakumby Warszawskie',
    primary: argb(0x1a1410), // unnamed dark (verbatim from visual-reference.md §9)
    accent: argb(0x8e6f2c), // gold-deep
    hazard: argb(0x7a1322), // crimson-deep
  },
  7: {
    id: 7,
    name: 'Karczma "Rzym"',
    primary: argb(0x8b3a1f), // rust
    accent: argb(0x7a1322), // crimson-deep
    hazard: argb(0xe8dcc4), // parchment
  },
  8: {
    id: 8,
    name: 'Księżyc',
    primary: argb(0xc7b89a), // bone
    accent: argb(0x1a1f2a), // unnamed ink-variant (verbatim from visual-reference.md §9)
    hazard: argb(0xd4213d), // crimson
  },
});
