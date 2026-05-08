/**
 * Zone 3 — Wisła (boss: Wodnik Wiślany, no miniboss).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { ZoneVisualSpec } from './types';

export const zone3: ZoneVisualSpec = {
  id: 3,
  nameKey: 'zones.3.name',
  bg: {
    sky: '#4A7A6A', // verdigris
    ground: '#2A4A4A', // grey-green
    accent: '#8E6F2C', // gold-deep
    hazard: '#C7B89A', // bone
    parallax: [
      { id: 'z3-water', speed: 0, content: 'water-shader' },
      { id: 'z3-fog', speed: 0, content: 'fog-shader' },
    ],
    ambience: { kind: 'spray', count: 48 },
  },
  entityIds: [
    'topielec',
    'strzyga',
    'wodnik-wislanny',
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
    id: 'wodnik-wislanny',
    hpTotal: 1200,
    phases: [
      {
        phase: 1,
        accent: '#4A7A6A',
        bullet: '#C7B89A',
        motif: 'verdigris water-spouts',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#2A4A4A',
        bullet: '#C7B89A',
        motif: 'grey-green bubble-shield',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'spray', count: 64 },
    postfx: ['bloom', 'chrom'],
  },
};
