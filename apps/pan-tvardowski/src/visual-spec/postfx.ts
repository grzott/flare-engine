import type { PostFxPresetDef } from './types';

/**
 * Baseline postfx tuning — values match the prior hardcodes in fx/postfx.ts
 * exactly. Zero visual diff on first ship.
 */
export const BASELINE_POSTFX: PostFxPresetDef = {
  vignette: { intensity: 0.35, radius: 0.82 },
  bloom: { threshold: 0.72, intensity: 0.5 },
  chroma: { amount: 0.012 },
  crt: { scanlineIntensity: 0.25, curvature: 0.12 },
  flashDecayRate: 12.5,
};

/**
 * Merge a zone override into the baseline. Sub-object overrides replace the
 * corresponding baseline sub-object wholesale (no deep partial merge — each
 * sub-object is a small flat struct and partial merges create inconsistent
 * combos, e.g. threshold without intensity).
 */
export function resolvePostFx(
  base: PostFxPresetDef,
  override?: Partial<PostFxPresetDef>,
): PostFxPresetDef {
  if (override === undefined) return base;
  return {
    vignette: override.vignette ?? base.vignette,
    bloom: override.bloom ?? base.bloom,
    chroma: override.chroma ?? base.chroma,
    crt: override.crt ?? base.crt,
    flashDecayRate: override.flashDecayRate ?? base.flashDecayRate,
  };
}
