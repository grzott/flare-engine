import { resolvePortraitShape } from '../dialogue/portrait-manifest';
import type { ShapeSpec } from '../shapes';
import type { PortraitsManifest } from './manifest-types';

/**
 * Resolve a portrait key via the manifest.
 *
 * Dispatch on `entry.kind`:
 *   - `'shape'` → look up in `PORTRAIT_MANIFEST` (the placeholder shape data).
 *   - `'image'` → returns `undefined`; rendering falls back to no portrait.
 *     Reserved for M9.6 production image drop.
 *
 * Returns `undefined` when the key is not found in the manifest or when the
 * entry kind does not produce shapes.
 */
export function resolvePortraitViaManifest(
  manifest: PortraitsManifest,
  key: string,
): readonly ShapeSpec[] | undefined {
  const entry = manifest.entries.find((e) => e.key === key);
  if (!entry) return undefined;
  if (entry.kind === 'shape') {
    return resolvePortraitShape(key);
  }
  if (entry.kind === 'image') {
    return undefined;
  }
  return undefined;
}
