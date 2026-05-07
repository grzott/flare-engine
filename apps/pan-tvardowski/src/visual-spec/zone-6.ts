/**
 * Zone 6 — Katakumby Warszawskie (boss: Bazyliszek, miniboss: Nocny Łowca).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { ZoneVisualSpec } from './types';

export const zone6: ZoneVisualSpec = {
  id: 6,
  nameKey: 'zones.6.name',
  bg: {
    sky: '#1A1410', // ink (zone-specific)
    ground: '#C7B89A', // bone
    accent: '#8E6F2C', // gold-deep
    hazard: '#7A1322', // crimson-deep
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'dust', count: 24 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z6
  boss: {
    id: 'bazyliszek-warszawski',
    hpTotal: 1800,
    phases: [
      {
        phase: 1,
        accent: '#C7B89A',
        bullet: '#7A1322',
        motif: 'bone gaze-cone',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#1A1410',
        bullet: '#7A1322',
        motif: 'ink venom puddles',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: '#D4213D',
        bullet: '#D4213D',
        motif: 'crimson gaze-beam maze',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'dust', count: 32 },
    postfx: ['bloom', 'vignette'],
  },
  // Miniboss: nocny-lowca (HP 250). Visual recipe not in §10 — see GAPS.
};
