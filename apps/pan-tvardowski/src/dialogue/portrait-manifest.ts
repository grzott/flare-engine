/**
 * Portrait manifest — maps dialogue speaker keys to a ShapeSpec[] used as a
 * placeholder avatar in the DialoguePanel portrait slot.
 *
 * Shape dimensions target a 48×48 bounding box so the rendered frame fits the
 * panel's portrait slot without clipping. Resolution is identical regardless
 * of locale. Colors match the entity's game representation where applicable.
 */

import type { ShapeSpec } from '@flare-engine/shapes';
import { hexToArgb } from '../visual-spec/color-util';
import { THEME_SPEC } from '../visual-spec/theme';

const ARGB_KING_GOLD = hexToArgb(THEME_SPEC.colors.portraitKingGold);
const ARGB_KING_CROWN = hexToArgb(THEME_SPEC.colors.portraitKingCrownBronze);
const ARGB_FACE = hexToArgb(THEME_SPEC.colors.portraitFaceParchment);
const ARGB_TWARDOWSKI = hexToArgb(THEME_SPEC.colors.portraitTwardowskiViolet);
const ARGB_PURPLE = hexToArgb(THEME_SPEC.colors.purpleBright);
const ARGB_INNKEEPER = hexToArgb(THEME_SPEC.colors.portraitInnkeeperBrown);
const ARGB_HAT = hexToArgb(THEME_SPEC.colors.portraitInnkeeperHatDark);
const ARGB_HELLFIRE = hexToArgb(THEME_SPEC.colors.hellfire);
const ARGB_SHADOW = hexToArgb(THEME_SPEC.colors.shadowBlack);

export type PortraitKey =
  | 'portrait.king'
  | 'portrait.twardowski'
  | 'portrait.innkeeper'
  | 'portrait.lucyper'
  | 'portrait.spider'
  | 'portrait.boruta';

/** Portrait shapes keyed by PortraitKey. Each entry is one or more ShapeSpec. */
export const PORTRAIT_MANIFEST: Record<PortraitKey, readonly ShapeSpec[]> = {
  'portrait.king': [
    { kind: 'ngon', n: 6, r: 20, fill: ARGB_KING_GOLD },
    { kind: 'rect', w: 32, h: 4, fill: ARGB_KING_CROWN, ox: 0, oy: -18 },
    { kind: 'circle', r: 5, fill: ARGB_FACE, ox: 0, oy: 8 },
  ],

  'portrait.twardowski': [
    { kind: 'circle', r: 20, fill: ARGB_TWARDOWSKI },
    { kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: ARGB_PURPLE, ox: 0, oy: -4 },
    { kind: 'circle', r: 4, fill: ARGB_FACE, ox: 0, oy: 10 },
  ],

  'portrait.innkeeper': [
    { kind: 'ngon', n: 8, r: 20, fill: ARGB_INNKEEPER },
    { kind: 'rect', w: 28, h: 6, fill: ARGB_HAT, ox: 0, oy: -16 },
    { kind: 'circle', r: 5, fill: ARGB_FACE, ox: 0, oy: 8 },
  ],

  'portrait.lucyper': [
    { kind: 'star', points: 6, rOuter: 22, rInner: 8, fill: ARGB_HELLFIRE },
    { kind: 'circle', r: 4, fill: ARGB_SHADOW, ox: 0, oy: 0 },
  ],

  'portrait.spider': [
    { kind: 'circle', r: 12, fill: ARGB_SHADOW },
    { kind: 'polyline', points: [-16, -4, -10, 0, -16, 4], stroke: ARGB_SHADOW, strokeWidth: 2 },
    { kind: 'polyline', points: [16, -4, 10, 0, 16, 4], stroke: ARGB_SHADOW, strokeWidth: 2 },
    { kind: 'circle', r: 2, fill: ARGB_HELLFIRE, ox: -4, oy: 0 },
    { kind: 'circle', r: 2, fill: ARGB_HELLFIRE, ox: 4, oy: 0 },
  ],

  'portrait.boruta': [
    { kind: 'ngon', n: 8, r: 22, fill: ARGB_SHADOW, stroke: ARGB_HELLFIRE, strokeWidth: 2 },
    { kind: 'triangle', size: 6, fill: ARGB_HELLFIRE, ox: -14, oy: -14 },
    { kind: 'triangle', size: 6, fill: ARGB_HELLFIRE, ox: 14, oy: -14 },
  ],
};

/**
 * Placeholder data source for the `'shape'` kind in `portraits.manifest.json`.
 * Called by `resolvePortraitViaManifest` in `src/assets/portraits-loader.ts`
 * when a manifest entry has `kind: 'shape'`.
 *
 * Direct callers outside `src/assets/` should migrate to
 * `resolvePortraitViaManifest` (manifest-driven path).
 */
export function resolvePortraitShape(key: string | undefined): readonly ShapeSpec[] | undefined {
  if (key === undefined) return undefined;
  return (PORTRAIT_MANIFEST as Record<string, readonly ShapeSpec[] | undefined>)[key];
}
