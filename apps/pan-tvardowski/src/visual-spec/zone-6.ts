/**
 * Zone 6 — Katakumby Warszawskie (boss: Bazyliszek, miniboss: Nocny Łowca).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone6: ZoneVisualSpec = {
  id: 6,
  nameKey: 'zones.6.name',
  bg: {
    sky: '#1A1410', // ink (zone-specific)
    ground: '#C7B89A', // bone
    accent: '#8E6F2C', // gold-deep
    hazard: '#7A1322', // crimson-deep
    parallax: [
      { id: 'z6-sky', speed: 0, content: 'tilemap' },
      { id: 'z6-vaults', speed: 0.2, content: 'tilemap' },
      { id: 'z6-bones', speed: 0.5, content: 'tilemap' },
    ],
    ambience: { kind: 'dust', count: 24 },
  },
  entityIds: [
    'wapierz',
    'poludnica',
    'nocny-lowca',
    'bazyliszek-warszawski',
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
  miniboss: {
    id: 'nocny-lowca',
    hpTotal: 250,
    phases: [
      {
        phase: 1,
        accent: '#D4213D',
        bullet: '#7A1322',
        motif: 'crimson hunt-spread',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'dust', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
