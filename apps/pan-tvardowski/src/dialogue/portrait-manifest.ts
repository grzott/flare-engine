/**
 * Portrait manifest — maps dialogue speaker keys to a ShapeSpec[] used as a
 * placeholder avatar in the DialoguePanel portrait slot.
 *
 * Shape dimensions target a 48×48 bounding box so the rendered frame fits the
 * panel's portrait slot without clipping. Resolution is identical regardless
 * of locale. Colors match the entity's game representation where applicable.
 */

import type { ShapeSpec } from '../shapes';

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
    { kind: 'ngon', n: 6, r: 20, fill: 0xffd6a54e },
    { kind: 'rect', w: 32, h: 4, fill: 0xffb5882a, ox: 0, oy: -18 },
    { kind: 'circle', r: 5, fill: 0xffeae1cc, ox: 0, oy: 8 },
  ],

  'portrait.twardowski': [
    { kind: 'circle', r: 20, fill: 0xff3a3050 },
    { kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: 0xff8844ff, ox: 0, oy: -4 },
    { kind: 'circle', r: 4, fill: 0xffeae1cc, ox: 0, oy: 10 },
  ],

  'portrait.innkeeper': [
    { kind: 'ngon', n: 8, r: 20, fill: 0xff7a5c2e },
    { kind: 'rect', w: 28, h: 6, fill: 0xff5c3d12, ox: 0, oy: -16 },
    { kind: 'circle', r: 5, fill: 0xffeae1cc, ox: 0, oy: 8 },
  ],

  'portrait.lucyper': [
    { kind: 'star', points: 6, rOuter: 22, rInner: 8, fill: 0xffff2b2b },
    { kind: 'circle', r: 4, fill: 0xff111111, ox: 0, oy: 0 },
  ],

  'portrait.spider': [
    { kind: 'circle', r: 12, fill: 0xff111111 },
    { kind: 'polyline', points: [-16, -4, -10, 0, -16, 4], stroke: 0xff111111, strokeWidth: 2 },
    { kind: 'polyline', points: [16, -4, 10, 0, 16, 4], stroke: 0xff111111, strokeWidth: 2 },
    { kind: 'circle', r: 2, fill: 0xffff2b2b, ox: -4, oy: 0 },
    { kind: 'circle', r: 2, fill: 0xffff2b2b, ox: 4, oy: 0 },
  ],

  'portrait.boruta': [
    { kind: 'ngon', n: 8, r: 22, fill: 0xff111111, stroke: 0xffff2b2b, strokeWidth: 2 },
    { kind: 'triangle', size: 6, fill: 0xffff2b2b, ox: -14, oy: -14 },
    { kind: 'triangle', size: 6, fill: 0xffff2b2b, ox: 14, oy: -14 },
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
