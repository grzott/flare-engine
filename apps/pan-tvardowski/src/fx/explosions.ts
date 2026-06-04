import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { KenneyAtlasHandle } from '../assets/sprites-loader';
import { ExplosionFire, SpiralCollapse } from '../components';
import { Lifetime } from '../components';
import type { AtlasHandle } from '../spawn';
import {
  EXPLOSION_TIER_DEFS,
  SPIRAL_DURATION_SEC,
  SPIRAL_INITIAL_RADIUS,
  SPIRAL_TURNS,
} from '../visual-spec/explosions';
import { KENNEY_FX_ZONES } from '../visual-spec/kenney-frames';
import type { ExplosionTier, ExplosionTierDef } from '../visual-spec/types';

export type { ExplosionTier } from '../visual-spec';

const DEFS_BY_TIER: Record<ExplosionTier, ExplosionTierDef> = (() => {
  const map = {} as Record<ExplosionTier, ExplosionTierDef>;
  for (const def of EXPLOSION_TIER_DEFS) {
    map[def.tier] = def;
  }
  return map;
})();

const PARTICLE_Z = 20;
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

// Module-level caps state (M2).
const _active = {
  burst: [] as { expiryMs: number }[],
  detonation: [] as { expiryMs: number }[],
  lastCataclysmZone: null as string | null,
};

let _nowMs = (): number => Date.now();

/** @internal Override time source for deterministic tests. */
export function _setNowForTest(fn: () => number): void {
  _nowMs = fn;
}

/** @internal Restore real time source after tests. */
export function _resetNowForTest(): void {
  _nowMs = () => Date.now();
}

/** @internal Clear caps state between tests. */
export function _resetCapsForTest(): void {
  _active.burst.length = 0;
  _active.detonation.length = 0;
  _active.lastCataclysmZone = null;
}

function _pruneExpired(): void {
  const now = _nowMs();
  _active.burst = _active.burst.filter((e) => e.expiryMs > now);
  _active.detonation = _active.detonation.filter((e) => e.expiryMs > now);
}

/**
 * Reset the cataclysm one-per-zone gate when a new zone starts.
 * Call from `startZone()` in play.ts.
 */
export function resetCataclysmGate(_zoneId: string): void {
  _active.lastCataclysmZone = null;
}

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

// ============================================================================
// SpiralCollapse — pre-allocated pool of 8 slots
// ============================================================================

const SPIRAL_POOL_SIZE = 8;

interface SpiralSlot {
  entityId: number;
  active: boolean;
}

const _spiralPool: SpiralSlot[] = [];
for (let _i = 0; _i < SPIRAL_POOL_SIZE; _i++) {
  _spiralPool.push({ entityId: -1, active: false });
}

/** @internal Clear spiral pool between tests. */
export function _resetSpiralPoolForTest(): void {
  for (const slot of _spiralPool) {
    slot.entityId = -1;
    slot.active = false;
  }
}

/**
 * Trigger the spiral-collapse death animation for an elite enemy.
 *
 * reducedMotion=true: destroys the entity immediately + fires a 1-frame
 * chromatic-ab flash (§15 pattern). No SpiralCollapse component attached.
 *
 * reducedMotion=false: attaches a SpiralCollapse component; the entity is
 * destroyed by the play-scene tick when elapsed >= duration.
 *
 * Returns true if the effect was attached, false if the entity was destroyed
 * immediately (reducedMotion) or a second-death guard fired.
 */
export function triggerSpiralCollapse(
  world: World,
  entityId: number,
  x: number,
  y: number,
  reducedMotion: boolean,
  postfx: { triggerChromaticAb(decayMs: number): void } | null,
): boolean {
  if (!world.exists(entityId)) return false;

  if (reducedMotion) {
    world.destroy(entityId);
    postfx?.triggerChromaticAb(100);
    return false;
  }

  if (world.has(entityId, SpiralCollapse)) return false;

  world.add(entityId, SpiralCollapse, {
    originX: x,
    originY: y,
    elapsed: 0,
    duration: SPIRAL_DURATION_SEC,
    turns: SPIRAL_TURNS,
    initialRadius: SPIRAL_INITIAL_RADIUS,
    scaleFrom: 1.0,
    scaleTo: 0.0,
    alphaFrom: 1.0,
    alphaTo: 0.0,
  });

  for (let _i = 0; _i < SPIRAL_POOL_SIZE; _i++) {
    const slot = _spiralPool[_i];
    if (slot && !slot.active) {
      slot.entityId = entityId;
      slot.active = true;
      break;
    }
  }

  return true;
}

// Scratch LCG state — zero-alloc; re-seeded per call.
let _lcgS = 1;

function _lcgNext(): number {
  _lcgS = (_lcgS * 16807) % 2147483647;
  return (_lcgS - 1) / 2147483646;
}

function _spawnParticles(
  world: World,
  atlas: AtlasHandle,
  x: number,
  y: number,
  def: ExplosionTierDef,
  kenney?: KenneyAtlasHandle | null,
  zoneId?: string,
): void {
  const sparkFrame = getFrame(atlas.sheet, 'particle-spark');
  const smokeFrame = getFrame(atlas.sheet, 'particle-smoke');
  if (!sparkFrame) return;

  // KG7: use kenney particle-dot + fire flipbook when kenney is live and the
  // zone is in KENNEY_FX_ZONES. Parse numeric zone id from the 'z1'..'z8' string.
  const zoneNum = zoneId ? Number(zoneId.slice(1)) : 0;
  const kenneyLive =
    kenney !== null &&
    kenney !== undefined &&
    kenney.image !== null &&
    KENNEY_FX_ZONES.has(zoneNum);

  // Seed the LCG reproducibly from position so identical spawns are consistent.
  _lcgS = (x * 31 + y * 17) | 0 || 1;

  const count = def.particles;
  const smokeRatio = def.smokeRatio ?? 0;
  const lifeBase = def.lifeMs / 1000;

  if (!kenneyLive) {
    for (let i = 0; i < count; i++) {
      const r01 = _lcgNext();
      const r02 = _lcgNext();
      const a = r01 * Math.PI * 2;
      const sp = 60 + r02 * 160;

      const useSmokeFrame = smokeFrame !== null && smokeFrame !== undefined && r01 < smokeRatio;
      const frame = useSmokeFrame && smokeFrame ? smokeFrame : sparkFrame;

      const id = world.spawn();
      world.add(id, Position, { x, y });
      world.add(id, Velocity, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
      world.add(id, Sprite, { image: atlas.image, frame, z: PARTICLE_Z, anchor: CENTER_ANCHOR });
      world.add(id, Lifetime, { remaining: lifeBase * (0.7 + r01 * 0.6) });
    }
  }

  // KG7 (Fix-2): spawn a central regularExplosion flipbook entity for kenney zones.
  // This entity stays at the explosion centre and animates through regularExplosion00..08
  // for the full explosion lifetime. Driven by updateExplosionFire in play.ts.
  if (kenneyLive) {
    const fireFrame = getFrame(kenney!.sheet, 'regularExplosion00');
    if (fireFrame) {
      const fireId = world.spawn();
      world.add(fireId, Position, { x, y });
      world.add(fireId, Sprite, {
        image: kenney!.image!,
        frame: fireFrame,
        z: PARTICLE_Z + 1,
        anchor: CENTER_ANCHOR,
      });
      world.add(fireId, ExplosionFire, { elapsed: 0 });
      world.add(fireId, Lifetime, { remaining: lifeBase });
    }
  }
}
