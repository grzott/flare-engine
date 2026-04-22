/**
 * Zone palettes — three channels per zone (primary / accent / hazard).
 * Values are 32-bit ARGB integers (alpha = 0xff). Source: build plan §6.
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
    primary: argb(0xb5651d),
    accent: argb(0xf3c262),
    hazard: argb(0xc0392b),
  },
  2: {
    id: 2,
    name: 'Puszcza Mazowiecka',
    primary: argb(0x1f4d2e),
    accent: argb(0xe4f0ff),
    hazard: argb(0xa3d65c),
  },
  3: {
    id: 3,
    name: 'Wisła',
    primary: argb(0x2f5f7a),
    accent: argb(0xd9e4e7),
    hazard: argb(0x5cae6e),
  },
  4: {
    id: 4,
    name: 'Łęczyckie Błota',
    primary: argb(0x5a4a2b),
    accent: argb(0x3ac4b4),
    hazard: argb(0x7eb52b),
  },
  5: {
    id: 5,
    name: 'Łysa Góra',
    primary: argb(0x2a1b3d),
    accent: argb(0xff6b1f),
    hazard: argb(0x7fff3c),
  },
  6: {
    id: 6,
    name: 'Katakumby Warszawskie',
    primary: argb(0x3e3a37),
    accent: argb(0xffb347),
    hazard: argb(0x9d3dff),
  },
  7: {
    id: 7,
    name: 'Karczma "Rzym"',
    primary: argb(0x6b4423),
    accent: argb(0xffcf66),
    hazard: argb(0xff2b2b),
  },
  8: {
    id: 8,
    name: 'Księżyc',
    primary: argb(0xc8cdd4),
    accent: argb(0x2b2d5a),
    hazard: argb(0xd6002e),
  },
});
