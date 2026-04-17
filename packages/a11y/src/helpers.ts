import type { A11ySettings } from './manager.js';

/**
 * Strength multiplier used by animation + postfx systems. Caller chooses a
 * base intensity; this function clamps it for reduced-motion users.
 */
export function motionScale(settings: { reducedMotion: boolean }, base = 1): number {
  return settings.reducedMotion ? 0 : base;
}

/**
 * Returns a second, dampened intensity. Useful for effects you want to keep
 * but soften (camera shake, chromatic aberration). `reducedFactor` controls
 * how much survives when reduced-motion is on (default 20%).
 */
export function dampenedMotion(
  settings: { reducedMotion: boolean },
  base: number,
  reducedFactor = 0.2,
): number {
  return settings.reducedMotion ? base * reducedFactor : base;
}

/**
 * Helper for UI layers: pick a color based on contrast preference.
 */
export function pickContrast<T>(settings: Pick<A11ySettings, 'contrast'>, normal: T, high: T): T {
  return settings.contrast === 'high' ? high : normal;
}
