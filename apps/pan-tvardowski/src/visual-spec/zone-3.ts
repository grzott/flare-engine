/**
 * Zone 3 — Wisła (boss: Wodnik Wiślany, no miniboss).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import { THEME_SPEC } from './theme';
import type { ZoneVisualSpec } from './types';

export const zone3: ZoneVisualSpec = {
  id: 3,
  nameKey: 'zones.3.name',
  bg: {
    sky: THEME_SPEC.colors.verdigris, // verdigris
    ground: THEME_SPEC.colors.riverDepth, // grey-green
    accent: THEME_SPEC.colors.goldDeep, // gold-deep
    hazard: THEME_SPEC.colors.bone, // bone
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
        accent: THEME_SPEC.colors.verdigris,
        bullet: THEME_SPEC.colors.bone,
        motif: 'verdigris water-spouts',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.riverDepth,
        bullet: THEME_SPEC.colors.bone,
        motif: 'grey-green bubble-shield',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'spray', count: 64 },
    postfx: ['bloom', 'chrom'],
  },
};
