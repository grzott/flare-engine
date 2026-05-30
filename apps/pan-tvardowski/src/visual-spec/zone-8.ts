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
  /**
   * Lunar zone: lower bloom threshold so bone/silver bullets glow more
   * visibly against the dark void sky. Bloom intensity bumped slightly for the
   * same reason. Sub-object replaces baseline wholesale per resolvePostFx contract.
   *
   * To plumb this into the runtime: pass `zone8.postfxOverride` as the second
   * argument to `createPanTvardowskiPostFx` at scene-bootstrap time. The call
   * site lives in `scenes/play.ts` and is currently zone-agnostic; wiring it is
   * a separate scene-bootstrap row (out of scope here).
   */
  postfxOverride: {
    bloom: { threshold: 0.6, intensity: 0.65 },
  },
  bg: {
    sky: THEME_SPEC.colors.bone, // bone
    ground: THEME_SPEC.colors.parchment, // parchment
    accent: THEME_SPEC.colors.lunarInk, // ink (Z8-specific variant)
    hazard: THEME_SPEC.colors.crimson, // crimson
    parallax: [
      { id: 'z8-water', speed: 0, content: 'water-shader' },
      { id: 'z8-fog', speed: 0, content: 'fog-shader' },
    ],
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
