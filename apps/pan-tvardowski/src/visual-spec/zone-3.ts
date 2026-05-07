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
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'spray', count: 48 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z3
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
