/**
 * Zone 4 — Łęczyckie Błota (boss: Boruta, miniboss: Leszy).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { ZoneVisualSpec } from './types';

export const zone4: ZoneVisualSpec = {
  id: 4,
  nameKey: 'zones.4.name',
  bg: {
    sky: '#243A29', // moss
    ground: '#5A6A2A', // olive
    accent: '#8E6F2C', // gold-deep
    hazard: '#E84B2A', // hazard
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'ember', count: 96 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z4
  boss: {
    id: 'boruta',
    hpTotal: 1400,
    phases: [
      {
        phase: 1,
        accent: '#E84B2A',
        bullet: '#E84B2A',
        motif: 'hazard whip-chains',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#D4213D',
        bullet: '#D4213D',
        motif: 'crimson mud-geysers + summons',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'ember', count: 128 },
    postfx: ['bloom', 'flash'],
  },
  // Miniboss: leszy (HP 200). Visual recipe not in §10 — see GAPS.
};
