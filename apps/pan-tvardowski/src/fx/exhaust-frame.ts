import { ANIMATION_DEFS } from '../visual-spec/animations';

const _spec = ANIMATION_DEFS.find((a) => a.id === 'exhaust-pulse');
if (_spec === undefined || _spec.id !== 'exhaust-pulse') {
  throw new Error('exhaust-frame: exhaust-pulse not found in ANIMATION_DEFS');
}

const EXHAUST_HZ: number = _spec.hz;
const EXHAUST_MIN_OPACITY: number = _spec.minOpacity;
const EXHAUST_MAX_OPACITY: number = _spec.maxOpacity;

export { EXHAUST_HZ, EXHAUST_MIN_OPACITY, EXHAUST_MAX_OPACITY };

/**
 * Returns the animation frame index (0..frameCount-1) for a sawtooth flipbook.
 * period = 1/hz; index increments linearly through frameCount per period.
 * Zero-alloc: pure arithmetic, no closures.
 */
export function exhaustFrameIndex(accum: number, frameCount: number, hz: number): number {
  const period = 1 / hz;
  return Math.floor(((accum % period) / period) * frameCount) % frameCount;
}

/**
 * Returns the alpha for an exhaust flame sprite.
 * Returns 0 when !visible.
 * Returns a sine-wave value in [minOpacity, maxOpacity] otherwise.
 * Reduced-motion: returns maxOpacity (no animation, full bright).
 *
 * Period driven by hz (same clock as the flipbook).
 */
export function exhaustPulseAlpha(
  accum: number,
  hz: number,
  minOpacity: number,
  maxOpacity: number,
  visible: boolean,
  reducedMotion: boolean,
): number {
  if (!visible) return 0;
  if (reducedMotion) return maxOpacity;
  const period = 1 / hz;
  const t = (accum % period) / period;
  const sine = Math.sin(2 * Math.PI * t);
  const unit = 0.5 * (1 + sine);
  return minOpacity + (maxOpacity - minOpacity) * unit;
}
