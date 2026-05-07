/**
 * Zone 4 — Łęczyckie Błota (boss: Boruta, miniboss: Leszy).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone4: ZoneVisualSpec = {
  id: 4,
  nameKey: 'zones.4.name',
  bg: {
    sky: '#243A29', // moss
    ground: '#5A6A2A', // olive
    accent: '#8E6F2C', // gold-deep
    hazard: '#E84B2A', // hazard
    parallax: [
      { id: 'z4-sky', speed: 0, content: 'tilemap' },
      { id: 'z4-marsh', speed: 0.2, content: 'tilemap' },
      { id: 'z4-reeds', speed: 0.5, content: 'tilemap' },
    ],
    ambience: { kind: 'ember', count: 96 },
  },
  entityIds: [
    'mamuna',
    'licho',
    'leszy',
    'boruta',
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
  miniboss: {
    id: 'leszy',
    hpTotal: 200,
    phases: [
      {
        phase: 1,
        accent: '#D4213D',
        bullet: '#D4213D',
        motif: 'crimson thorn-volley',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'ember', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
