/**
 * Zone 7 — Karczma "Rzym" (boss: Mefistofeles, miniboss: Madej).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { ZoneVisualSpec } from './types';

export const zone7: ZoneVisualSpec = {
  id: 7,
  nameKey: 'zones.7.name',
  bg: {
    sky: '#8B3A1F', // rust
    ground: '#C9A24A', // gold
    accent: '#7A1322', // crimson-deep
    hazard: '#E8DCC4', // parchment
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'smoke', count: 16 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z7
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
  // Miniboss: madej (HP 300). Visual recipe not in §10 — see GAPS.
};
