import type { World } from '@flare-engine/ecs';
import type { KenneyAtlasHandle } from '../assets/sprites-loader';
import type { AtlasHandle } from '../spawn';
import type { ExplosionTier } from '../visual-spec/types';
import { DEFS_BY_TIER, _active, _nowMs, _pruneExpired } from './explosion-degrader';
import { _spawnParticles } from './explosion-particles';

export type { ExplosionTier } from '../visual-spec';

export {
  _setNowForTest,
  _resetNowForTest,
  _resetCapsForTest,
  resetCataclysmGate,
} from './explosion-degrader';

export {
  _resetSpiralPoolForTest,
  triggerSpiralCollapse,
} from './spiral-pool';

/**
 * Spawn a tiered explosion at (x, y).
 *
 * Returns the *effective* tier after cap-degradation.
 * Callers can ignore; tests use it to assert degradation.
 *
 * onReducedMotion is fired when screenShakeEnabled=false and the preset has a
 * shake — lets callers substitute a visual cue (e.g. red flash) for motion.
 */
export function triggerExplosion(
  world: World,
  atlas: AtlasHandle,
  camera: {
    shake(amp: number, dur: number): void;
    shakePerlin(amp: number, dur: number): void;
  } | null,
  postfx: {
    triggerHitFlash(decayRate?: number): void;
    triggerGrayscaleHold(durationMs: number): void;
    triggerBloomPulse(durationMs: number): void;
  } | null,
  screenShakeEnabled: boolean,
  x: number,
  y: number,
  tier: ExplosionTier,
  zoneId: string,
  onReducedMotion?: () => void,
  kenney?: KenneyAtlasHandle | null,
): ExplosionTier {
  _pruneExpired();

  // Degradation chain.
  let effective: ExplosionTier = tier;
  if (effective === 'cataclysm') {
    if (_active.lastCataclysmZone === zoneId) effective = 'detonation';
  }
  if (effective === 'detonation') {
    if (_active.detonation.length >= 1) effective = 'burst';
  }
  if (effective === 'burst') {
    if (_active.burst.length >= 4) effective = 'pop';
  }

  const def = DEFS_BY_TIER[effective];
  const now = _nowMs();

  // Register active slots.
  if (effective === 'cataclysm') {
    _active.lastCataclysmZone = zoneId;
  } else if (effective === 'detonation') {
    _active.detonation.push({ expiryMs: now + def.lifeMs });
  } else if (effective === 'burst') {
    _active.burst.push({ expiryMs: now + def.lifeMs });
  }

  // Spawn particles.
  _spawnParticles(world, atlas, x, y, def, kenney, zoneId);

  // Screen shake.
  if (screenShakeEnabled && def.shake) {
    if (def.shake.shakeMode === 'perlin') {
      camera?.shakePerlin(def.shake.amp, def.shake.durMs / 1000);
    } else {
      camera?.shake(def.shake.amp, def.shake.durMs / 1000);
    }
  } else if (!screenShakeEnabled && def.shake) {
    onReducedMotion?.();
  }

  // PostFX — read from def.postfx.
  if (def.postfx && postfx) {
    const { grayscaleMs, bloomMs, hitFlashDecayRate } = def.postfx;
    postfx.triggerHitFlash(hitFlashDecayRate);
    if (grayscaleMs !== undefined) postfx.triggerGrayscaleHold(grayscaleMs);
    if (bloomMs !== undefined) postfx.triggerBloomPulse(bloomMs);
  }

  return effective;
}
