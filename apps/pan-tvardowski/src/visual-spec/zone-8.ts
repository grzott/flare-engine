/**
 * Zone 8 — Księżyc (boss: Lucyper Księżycowy, no miniboss).
 * Sources: palette.ts, visual-reference.md §9 + §10.
 *
 * Z8 is the silver-UI override zone (palette.ts silverUi: true).
 */

import { THEME_SPEC } from './theme';
import type { ZoneVisualSpec } from './types';

export const zone8: ZoneVisualSpec = {
  id: 8,
  nameKey: 'zones.8.name',
  bg: {
    sky: THEME_SPEC.colors.bone, // bone
    ground: THEME_SPEC.colors.parchment, // parchment
    accent: THEME_SPEC.colors.lunarInk, // ink (Z8-specific variant)
    hazard: THEME_SPEC.colors.crimson, // crimson
    parallax: [
      { id: 'z8-water', speed: 0, content: 'water-shader' },
      { id: 'z8-fog', speed: 0, content: 'fog-shader' },
    ],
    ambience: { kind: 'float', count: 64 },
  },
  entityIds: [
    'moon-wraith',
    'nocnica',
    'lucyper-ksiezycowy',
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
    id: 'lucyper-ksiezycowy',
    hpTotal: 2400,
    phases: [
      {
        phase: 1,
        accent: THEME_SPEC.colors.bone,
        bullet: THEME_SPEC.colors.bone,
        motif: 'silver cosmic-rain',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.lunarInk,
        bullet: THEME_SPEC.colors.bone,
        motif: 'ink+silver eclipse',
        breakTier: 'detonation',
      },
      {
        phase: 3,
        accent: THEME_SPEC.colors.crimson,
        bullet: THEME_SPEC.colors.crimson,
        motif: 'crimson shattered-mirrors',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'float', count: 64 },
    postfx: ['bloom', 'flash', 'crt'],
  },
};
