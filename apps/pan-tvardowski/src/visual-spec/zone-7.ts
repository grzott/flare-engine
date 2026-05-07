/**
 * Zone 7 — Karczma "Rzym" (boss: Mefistofeles, miniboss: Madej).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone7: ZoneVisualSpec = {
  id: 7,
  nameKey: 'zones.7.name',
  bg: {
    sky: '#8B3A1F', // rust
    ground: '#C9A24A', // gold
    accent: '#7A1322', // crimson-deep
    hazard: '#E8DCC4', // parchment
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
        accent: '#C9A24A',
        bullet: '#C9A24A',
        motif: 'warm gold contracts',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#B05A3C',
        bullet: '#E84B2A',
        motif: 'terracotta fire-pits',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: '#D4213D',
        bullet: '#D4213D',
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
        accent: '#D4213D',
        bullet: '#8B3A1F',
        motif: 'crimson blaze-sweep',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'smoke', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
