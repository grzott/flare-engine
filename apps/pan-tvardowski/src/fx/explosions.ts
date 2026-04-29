import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { Lifetime } from '../components';
import type { AtlasHandle } from '../spawn';

export type ExplosionTier = 'chip' | 'pop' | 'burst' | 'detonation' | 'cataclysm';

interface ShakePreset {
  amp: number;
  durMs: number;
}

interface ExplosionPreset {
  particles: number;
  lifeMs: number;
  shake?: ShakePreset;
  postfx: boolean;
}

export const EXPLOSION_PRESETS = {
  chip: { particles: 8, lifeMs: 120, postfx: false } as ExplosionPreset,
  pop: {
    particles: 24,
    lifeMs: 280,
    shake: { amp: 2, durMs: 80 },
    postfx: true,
  } as ExplosionPreset,
  burst: {
    particles: 64,
    lifeMs: 520,
    shake: { amp: 5, durMs: 180 },
    postfx: true,
  } as ExplosionPreset,
  detonation: {
    particles: 128,
    lifeMs: 900,
    shake: { amp: 10, durMs: 320 },
    postfx: true,
  } as ExplosionPreset,
  cataclysm: {
    particles: 256,
    lifeMs: 1600,
    shake: { amp: 14, durMs: 900 },
    postfx: true,
  } as ExplosionPreset,
} as const satisfies Record<ExplosionTier, ExplosionPreset>;

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
 */
export function triggerExplosion(
  world: World,
  atlas: AtlasHandle,
  camera: { shake(amp: number, dur: number): void } | null,
  postfx: { triggerHitFlash(): void } | null,
  screenShakeEnabled: boolean,
  x: number,
  y: number,
  tier: ExplosionTier,
  zoneId: string,
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

  const preset = EXPLOSION_PRESETS[effective];
  const now = _nowMs();

  // Register active slots.
  if (effective === 'cataclysm') {
    _active.lastCataclysmZone = zoneId;
  } else if (effective === 'detonation') {
    _active.detonation.push({ expiryMs: now + preset.lifeMs });
  } else if (effective === 'burst') {
    _active.burst.push({ expiryMs: now + preset.lifeMs });
  }

  // Spawn particles.
  _spawnParticles(world, atlas, x, y, effective, preset);

  // Screen shake.
  if (screenShakeEnabled && preset.shake) {
    camera?.shake(preset.shake.amp, preset.shake.durMs / 1000);
  }

  // PostFX.
  if (preset.postfx) {
    postfx?.triggerHitFlash();
  }

  return effective;
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
  tier: ExplosionTier,
  preset: ExplosionPreset,
): void {
  const sparkFrame = getFrame(atlas.sheet, 'particle-spark');
  const smokeFrame = getFrame(atlas.sheet, 'particle-smoke');
  if (!sparkFrame) return;

  // Seed the LCG reproducibly from position so identical spawns are consistent.
  _lcgS = (x * 31 + y * 17) | 0 || 1;

  const count = preset.particles;
  // For cataclysm, mix in some smoke frames for debris feel.
  const smokeRatio = tier === 'cataclysm' ? 0.25 : 0;
  const lifeBase = preset.lifeMs / 1000;

  for (let i = 0; i < count; i++) {
    const r01 = _lcgNext();
    const r02 = _lcgNext();
    const a = r01 * Math.PI * 2;
    const sp = 60 + r02 * 160;

    const useSmokeFrame = smokeFrame !== null && smokeFrame !== undefined && r01 < smokeRatio;
    const frame = useSmokeFrame ? smokeFrame : sparkFrame;

    const id = world.spawn();
    world.add(id, Position, { x, y });
    world.add(id, Velocity, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
    world.add(id, Sprite, { image: atlas.image, frame, z: PARTICLE_Z, anchor: CENTER_ANCHOR });
    world.add(id, Lifetime, { remaining: lifeBase * (0.7 + r01 * 0.6) });
  }
}
