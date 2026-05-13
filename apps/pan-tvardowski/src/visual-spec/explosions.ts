import type { ExplosionTier, ExplosionTierDef } from './types';

export const SPIRAL_DURATION_SEC = 1.2;
export const SPIRAL_TURNS = 3;
export const SPIRAL_INITIAL_RADIUS = 24;

export const EXPLOSION_TIER_DEFS: readonly ExplosionTierDef[] = [
  {
    tier: 'chip' as ExplosionTier,
    particles: 8,
    lifeMs: 120,
  },
  {
    tier: 'pop' as ExplosionTier,
    particles: 24,
    lifeMs: 280,
    shake: { amp: 2, durMs: 80, shakeMode: 'sinusoidal' },
    postfx: {},
  },
  {
    tier: 'burst' as ExplosionTier,
    particles: 64,
    lifeMs: 520,
    shake: { amp: 5, durMs: 180, shakeMode: 'sinusoidal' },
    postfx: { grayscaleMs: 400 },
  },
  {
    tier: 'detonation' as ExplosionTier,
    particles: 128,
    lifeMs: 900,
    shake: { amp: 10, durMs: 320, shakeMode: 'perlin' },
    postfx: { grayscaleMs: 600, bloomMs: 300 },
  },
  {
    tier: 'cataclysm' as ExplosionTier,
    particles: 256,
    lifeMs: 1600,
    shake: { amp: 14, durMs: 900, shakeMode: 'perlin' },
    postfx: { grayscaleMs: 900, bloomMs: 500, hitFlashDecayRate: 0.833 },
    smokeRatio: 0.25,
  },
];

export function getExplosionDef(tier: ExplosionTier): ExplosionTierDef {
  const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === tier);
  if (!def) throw new Error(`No ExplosionTierDef for tier: ${tier}`);
  return def;
}
