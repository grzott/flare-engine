/**
 * Zone 5 — Łysa Góra (boss: Baba Jaga, no miniboss).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 *
 * Note: §9 has Z5 accent = '#0E0810', but visual-reference.md footnote
 * corrects to ink-black '#0E1A12'. Using the corrected value.
 */

import type { ZoneVisualSpec } from './types';

export const zone5: ZoneVisualSpec = {
  id: 5,
  nameKey: 'zones.5.name',
  bg: {
    sky: '#7A1322', // crimson-deep
    ground: '#D4213D', // crimson
    accent: '#0E1A12', // ink-black (corrected per §9 footnote)
    hazard: '#C9A24A', // gold
    parallax: [], // TODO(author) — see folio XII
    ambience: { kind: 'ash', count: 128 },
  },
  entityIds: [], // TODO(session-5) — list every entity that appears in Z5
  boss: {
    id: 'baba-jaga',
    hpTotal: 1500,
    phases: [
      {
        phase: 1,
        accent: '#D4213D',
        bullet: '#D4213D',
        motif: 'crimson-smoke cauldrons',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#C9A24A',
        bullet: '#D4213D',
        motif: 'crimson+gold mortar flight',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: '#E8DCC4',
        bullet: '#E8DCC4',
        motif: 'white-out broom sweep',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'ash', count: 256 },
    postfx: ['bloom', 'chrom', 'flash'],
  },
};
