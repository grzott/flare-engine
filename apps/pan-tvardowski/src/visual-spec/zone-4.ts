/**
 * Zone 4 — Łęczyckie Błota (boss: Boruta, miniboss: Leszy).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 */

import { THEME_SPEC } from './theme';
import type { BossVisualSpec, ZoneVisualSpec } from './types';

export const zone4: ZoneVisualSpec = {
  id: 4,
  nameKey: 'zones.4.name',
  bg: {
    sky: THEME_SPEC.colors.moss, // moss
    ground: THEME_SPEC.colors.marshOlive, // olive
    accent: THEME_SPEC.colors.goldDeep, // gold-deep
    hazard: THEME_SPEC.colors.hazard, // hazard
    parallax: [
      { id: 'z4-sky', speed: 0, content: 'tilemap' },
      { id: 'z4-marsh', speed: 0.2, content: 'tilemap' },
      { id: 'z4-reeds', speed: 0.5, content: 'tilemap' },
    ],
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
        accent: THEME_SPEC.colors.hazard,
        bullet: THEME_SPEC.colors.hazard,
        motif: 'hazard whip-chains',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
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
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
        motif: 'crimson thorn-volley',
        breakTier: 'burst',
      },
    ],
    particles: { kind: 'ember', count: 48 },
    postfx: ['bloom'],
  } satisfies BossVisualSpec,
};
