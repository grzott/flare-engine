/**
 * Zone 8 — Księżyc (boss: Lucyper Księżycowy, no miniboss).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 *
 * Z8 is the silver-UI override zone (palette.ts silverUi: true).
 */

import type { ZoneVisualSpec } from './types';

export const zone8: ZoneVisualSpec = {
  id: 8,
  nameKey: 'zones.8.name',
  bg: {
    sky: '#C7B89A', // bone
    ground: '#E8DCC4', // parchment
    accent: '#1A1F2A', // ink (Z8-specific variant)
    hazard: '#D4213D', // crimson
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'float', count: 64 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z8
  boss: {
    id: 'lucyper-ksiezycowy',
    hpTotal: 2400,
    phases: [
      {
        phase: 1,
        accent: '#C7B89A',
        bullet: '#C7B89A',
        motif: 'silver cosmic-rain',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#1A1F2A',
        bullet: '#C7B89A',
        motif: 'ink+silver eclipse',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: '#D4213D',
        bullet: '#D4213D',
        motif: 'crimson shattered-mirrors',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'float', count: 64 },
    postfx: ['bloom', 'flash', 'crt'],
  },
};
