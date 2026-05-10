/**
 * VS-S6 — Animation preset spec.
 *
 * Boundary discipline: imports ONLY from './types'.
 *
 * HUD tweens — easing names are verbatim exported function names from
 * '@flare-engine/math' (easings.ts). They are stored as strings here so this
 * data file has no runtime dependency on the math package.
 */

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
    id: 'muzzle-flash',
    durationMs: 80,
    color: '#C9A24A',
    r: 6,
  },
  {
    id: 'rocket-trail',
    emitRate: 30,
    color: '#E84B2A',
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
] as const;
