/**
 * Zone 2 — Puszcza Mazowiecka (boss: Borowy Król, miniboss: Rokita).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { ZoneVisualSpec } from './types';

export const zone2: ZoneVisualSpec = {
  id: 2,
  nameKey: 'zones.2.name',
  bg: {
    sky: '#243A29', // moss
    ground: '#1A2E1F', // bog-green
    accent: '#4A7A6A', // verdigris
    hazard: '#C7B89A', // bone
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'pollen', count: 80 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z2
  boss: {
    id: 'borowy-krol',
    hpTotal: 1000,
    phases: [
      {
        phase: 1,
        accent: '#243A29',
        bullet: '#C7B89A',
        motif: 'moss rolling boulders',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#4A7A6A',
        bullet: '#C7B89A',
        motif: 'verdigris root-maze',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'pollen', count: 96 },
    postfx: ['bloom', 'vignette'],
  },
  // Miniboss: rokita (HP 150). Visual recipe not in §10 — see GAPS.
};
