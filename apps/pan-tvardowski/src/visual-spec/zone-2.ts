/**
 * Zone 2 — Puszcza Mazowiecka (boss: Borowy Król, miniboss: Rokita).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone2: ZoneVisualSpec = {
  id: 2,
  nameKey: 'zones.2.name',
  bg: {
    sky: '#243A29', // moss
    ground: '#1A2E1F', // bog-green
    accent: '#4A7A6A', // verdigris
    hazard: '#C7B89A', // bone
    parallax: [
      { id: 'z2-sky', speed: 0, content: 'tilemap' },
      { id: 'z2-canopy', speed: 0.2, content: 'tilemap' },
      { id: 'z2-undergrowth', speed: 0.5, content: 'tilemap' },
    ],
    ambience: { kind: 'pollen', count: 80 },
  },
  entityIds: [
    'czart',
    'bies',
    'rokita',
    'borowy-krol',
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
  miniboss: {
    id: 'rokita',
    hpTotal: 150,
    phases: [
      {
        phase: 1,
        accent: '#D4213D',
        bullet: '#D4213D',
        motif: 'crimson charge-burst',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'pollen', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
