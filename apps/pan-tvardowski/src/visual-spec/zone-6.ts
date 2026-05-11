/**
 * Zone 6 — Katakumby Warszawskie (boss: Bazyliszek, miniboss: Nocny Łowca).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import { THEME_SPEC } from './theme';
import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone6: ZoneVisualSpec = {
  id: 6,
  nameKey: 'zones.6.name',
  bg: {
    sky: THEME_SPEC.colors.katakumbyDark, // ink (zone-specific)
    ground: THEME_SPEC.colors.bone, // bone
    accent: THEME_SPEC.colors.goldDeep, // gold-deep
    hazard: THEME_SPEC.colors.crimsonDeep, // crimson-deep
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
        accent: THEME_SPEC.colors.bone,
        bullet: THEME_SPEC.colors.crimsonDeep,
        motif: 'bone gaze-cone',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.katakumbyDark,
        bullet: THEME_SPEC.colors.crimsonDeep,
        motif: 'ink venom puddles',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
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
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimsonDeep,
        motif: 'crimson hunt-spread',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'dust', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
