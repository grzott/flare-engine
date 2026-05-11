/**
 * Zone 2 — Puszcza Mazowiecka (boss: Borowy Król, miniboss: Rokita).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import { THEME_SPEC } from './theme';
import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone2: ZoneVisualSpec = {
  id: 2,
  nameKey: 'zones.2.name',
  bg: {
    sky: THEME_SPEC.colors.moss, // moss
    ground: THEME_SPEC.colors.bogGreen, // bog-green
    accent: THEME_SPEC.colors.verdigris, // verdigris
    hazard: THEME_SPEC.colors.bone, // bone
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
        accent: THEME_SPEC.colors.moss,
        bullet: THEME_SPEC.colors.bone,
        motif: 'moss rolling boulders',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.verdigris,
        bullet: THEME_SPEC.colors.bone,
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
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
        motif: 'crimson charge-burst',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'pollen', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
