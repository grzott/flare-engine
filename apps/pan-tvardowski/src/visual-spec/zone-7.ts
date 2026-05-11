/**
 * Zone 7 — Karczma "Rzym" (boss: Mefistofeles, miniboss: Madej).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import { THEME_SPEC } from './theme';
import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone7: ZoneVisualSpec = {
  id: 7,
  nameKey: 'zones.7.name',
  bg: {
    sky: THEME_SPEC.colors.rust, // rust
    ground: THEME_SPEC.colors.gold, // gold
    accent: THEME_SPEC.colors.crimsonDeep, // crimson-deep
    hazard: THEME_SPEC.colors.parchment, // parchment
    parallax: [
      { id: 'z7-sky', speed: 0, content: 'tilemap' },
      { id: 'z7-rafters', speed: 0.2, content: 'tilemap' },
      { id: 'z7-tavern-floor', speed: 0.5, content: 'tilemap' },
    ],
    ambience: { kind: 'smoke', count: 16 },
  },
  entityIds: [
    'skrzat',
    'latawiec',
    'czart',
    'bies',
    'licho',
    'strzyga',
    'topielec',
    'mamuna',
    'nocnica',
    'poludnica',
    'wapierz',
    'dziwozona',
    'madej',
    'mefistofeles',
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
    id: 'mefistofeles',
    hpTotal: 2100,
    phases: [
      {
        phase: 1,
        accent: THEME_SPEC.colors.gold,
        bullet: THEME_SPEC.colors.gold,
        motif: 'warm gold contracts',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.terracotta,
        bullet: THEME_SPEC.colors.hazard,
        motif: 'terracotta fire-pits',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
        motif: 'crimson mirror-twin',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'smoke', count: 64 },
    postfx: ['bloom', 'chrom'],
  },
  miniboss: {
    id: 'madej',
    hpTotal: 300,
    phases: [
      {
        phase: 1,
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.rust,
        motif: 'crimson blaze-sweep',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'smoke', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
