/**
 * VS-S6 — Animation preset spec.
 *
 * Boundary discipline: imports ONLY from './types'.
 *
 * HUD tweens — easing names are verbatim exported function names from
 * '@flare-engine/math' (easings.ts). They are stored as strings here so this
 * data file has no runtime dependency on the math package.
 */

import { THEME_SPEC } from './theme';
import type { AnimationDef } from './types';

export const ANIMATION_DEFS: readonly AnimationDef[] = [
  {
    id: 'shatter-3',
    fragments: 3,
    direction: 'random',
    fxTier: 'detonation',
  },
  {
    id: 'exhaust-pulse',
    hz: 6,
    minOpacity: 0.4,
    maxOpacity: 1.0,
  },
  {
    id: 'sigil-pulse',
    hz: 0.41667,
    minOpacity: 0.4,
    maxOpacity: 1.0,
  },
  {
    id: 'muzzle-flash',
    durationMs: 80,
    color: THEME_SPEC.colors.gold,
    r: 6,
  },
  {
    id: 'rocket-trail',
    emitRate: 30,
    color: THEME_SPEC.colors.hazard,
    lifetimeMs: 400,
  },
  {
    id: 'spiral-collapse',
    turns: 3,
    durationMs: 1200,
    inwardEasing: 'easeInCubic',
    scaleFrom: 1.0,
    scaleTo: 0.0,
    alphaFrom: 1.0,
    alphaTo: 0.0,
  },
] as const;

/**
 * HUD tween descriptors — encode the shape of each HUD animation so S7 can
 * instantiate tweens from spec rather than from inline literals.
 *
 * easingName is verbatim from '@flare-engine/math' (easeOutQuart, easeOutBack).
 */
export interface HudTweenSpec {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly durationSec: number;
  readonly easingName: string;
  readonly notes?: string;
}

export const HUD_TWEENS: readonly HudTweenSpec[] = [
  {
    id: 'zone-banner-fade-in',
    from: 0,
    to: 1,
    durationSec: 0.8,
    easingName: 'easeOutQuart',
    notes: 'Folio XIV item 9. Source: hud/zone-banner.ts createZoneBannerState()',
  },
  {
    id: 'zone-banner-fade-out',
    from: 1,
    to: 0,
    durationSec: 0.45,
    easingName: 'easeOutQuart',
    notes: 'Source: hud/zone-banner.ts createZoneBannerState()',
  },
  {
    id: 'zone-banner-hold',
    from: 1,
    to: 1,
    durationSec: 1.4,
    easingName: 'linear',
    notes: 'Hold phase between fade-in and fade-out. Source: ZoneBannerState.holdSec',
  },
  {
    id: 'combo-pulse',
    from: 1,
    to: 1.18,
    durationSec: 0.12,
    easingName: 'easeOutBack',
    notes: 'Scale overshoot on combo hit. Source: easing-assignments.test.ts',
  },
  {
    id: 'scene-menu-enter',
    from: 0,
    to: 1,
    durationSec: 0.32,
    easingName: 'easeOutCubic',
    notes: 'Folio XIV item 1. Scene-level fadeTransition from boot→menu.',
  },
  {
    id: 'overlay-open',
    from: 0,
    to: 1,
    durationSec: 0.24,
    easingName: 'easeOutExpo',
    notes: 'Pause overlay fade-in. Source: Hud.tsx Animated.timing open branch.',
  },
  {
    id: 'overlay-close',
    from: 1,
    to: 0,
    durationSec: 0.18,
    easingName: 'easeInExpo',
    notes: 'Pause overlay fade-out. Source: Hud.tsx Animated.timing close branch.',
  },
  {
    id: 'scene-game-over',
    from: 0,
    to: 1,
    durationSec: 1.2,
    easingName: 'easeInCubic',
    notes:
      'Folio XIV M2. Scene-level fadeTransition into game-over. Source: scenes/play.ts onPlayerDown.',
  },
] as const;
