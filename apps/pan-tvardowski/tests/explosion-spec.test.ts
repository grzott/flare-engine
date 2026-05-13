import { describe, expect, test } from 'bun:test';
import type { ExplosionTier } from '../src/visual-spec';
import { EXPLOSION_TIER_DEFS } from '../src/visual-spec';

const ALL_TIERS: ExplosionTier[] = ['chip', 'pop', 'burst', 'detonation', 'cataclysm'];

describe('EXPLOSION_TIER_DEFS — coverage', () => {
  test('contains exactly 5 entries', () => {
    expect(EXPLOSION_TIER_DEFS.length).toBe(5);
  });

  test('covers all ExplosionTier values', () => {
    const definedTiers = EXPLOSION_TIER_DEFS.map((d) => d.tier);
    for (const tier of ALL_TIERS) {
      expect(definedTiers).toContain(tier);
    }
  });
});

describe('EXPLOSION_TIER_DEFS — particles and lifeMs', () => {
  const TABLE: [ExplosionTier, number, number][] = [
    ['chip', 8, 120],
    ['pop', 24, 280],
    ['burst', 64, 520],
    ['detonation', 128, 900],
    ['cataclysm', 256, 1600],
  ];

  for (const [tier, particles, lifeMs] of TABLE) {
    test(`${tier}: particles=${particles}, lifeMs=${lifeMs}`, () => {
      const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === tier);
      expect(def?.particles).toBe(particles);
      expect(def?.lifeMs).toBe(lifeMs);
    });
  }
});

describe('EXPLOSION_TIER_DEFS — shake', () => {
  test('chip: no shake', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'chip');
    expect(def?.shake).toBeUndefined();
  });

  test('pop: shake.amp=2, shakeMode=sinusoidal', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'pop');
    expect(def?.shake?.amp).toBe(2);
    expect(def?.shake?.shakeMode).toBe('sinusoidal');
  });

  test('burst: shake.amp=5, shakeMode=sinusoidal', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'burst');
    expect(def?.shake?.amp).toBe(5);
    expect(def?.shake?.shakeMode).toBe('sinusoidal');
  });

  test('detonation: shakeMode=perlin', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'detonation');
    expect(def?.shake?.shakeMode).toBe('perlin');
  });

  test('cataclysm: shakeMode=perlin', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'cataclysm');
    expect(def?.shake?.shakeMode).toBe('perlin');
  });
});

describe('EXPLOSION_TIER_DEFS — postfx', () => {
  test('chip: no postfx', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'chip');
    expect(def?.postfx).toBeUndefined();
  });

  test('burst: grayscaleMs=400, no bloomMs', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'burst');
    expect(def?.postfx?.grayscaleMs).toBe(400);
    expect(def?.postfx?.bloomMs).toBeUndefined();
  });

  test('detonation: grayscaleMs=600, bloomMs=300', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'detonation');
    expect(def?.postfx?.grayscaleMs).toBe(600);
    expect(def?.postfx?.bloomMs).toBe(300);
  });

  test('cataclysm: grayscaleMs=900, bloomMs=500, hitFlashDecayRate=0.833', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'cataclysm');
    expect(def?.postfx?.grayscaleMs).toBe(900);
    expect(def?.postfx?.bloomMs).toBe(500);
    expect(def?.postfx?.hitFlashDecayRate).toBe(0.833);
  });
});

describe('EXPLOSION_TIER_DEFS — smokeRatio', () => {
  test('cataclysm: smokeRatio=0.25', () => {
    const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === 'cataclysm');
    expect(def?.smokeRatio).toBe(0.25);
  });

  test('non-cataclysm tiers: smokeRatio omitted', () => {
    for (const tier of ['chip', 'pop', 'burst', 'detonation'] as ExplosionTier[]) {
      const def = EXPLOSION_TIER_DEFS.find((d) => d.tier === tier);
      expect(def?.smokeRatio).toBeUndefined();
    }
  });
});
