/**
 * Zone 5 — Łysa Góra (boss: Baba Jaga, no miniboss).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 *
 * Note: §9 has Z5 accent = '#0E0810', but visual-reference.md footnote
 * corrects to ink-black '#0E1A12'. Using the corrected value.
 */

import { THEME_SPEC } from './theme';
import type { ZoneVisualSpec } from './types';

export const zone5: ZoneVisualSpec = {
  id: 5,
  nameKey: 'zones.5.name',
  bg: {
    sky: THEME_SPEC.colors.crimsonDeep, // crimson-deep
    ground: THEME_SPEC.colors.crimson, // crimson
    accent: THEME_SPEC.colors.inkBlack, // ink-black (corrected per §9 footnote)
    hazard: THEME_SPEC.colors.gold, // gold
    parallax: [
      { id: 'z5-fire', speed: 0, content: 'fire-shader' },
      { id: 'z5-fog', speed: 0, content: 'fog-shader' },
    ],
    ambience: { kind: 'ash', count: 128, velSlowPxPerSec: 14, velFastPxPerSec: 28 },
  },
  entityIds: [
    'nocnica',
    'dziwozona',
    'baba-jaga',
    'iskry',
    'piorun',
    'sol-swiecona',
    'znak-pentagramu',
    'czarna-ksiega',
    'siedmiomilowe-buty',
    'amulet-wegrowski',
    'koguci-pioro',
    'srebrna-tarcza',
    'kamien-filozoficzny',
  ],
  boss: {
    id: 'baba-jaga',
    hpTotal: 1500,
    phases: [
      {
        phase: 1,
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
        motif: 'crimson-smoke cauldrons',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.gold,
        bullet: THEME_SPEC.colors.crimson,
        motif: 'crimson+gold mortar flight',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: THEME_SPEC.colors.parchment,
        bullet: THEME_SPEC.colors.parchment,
        motif: 'white-out broom sweep',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'ash', count: 256 },
    postfx: ['bloom', 'chrom', 'flash'],
  },
};
