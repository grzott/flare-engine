import { describe, expect, test } from 'bun:test';
import { GATED_ZONES } from '../src/iap/zone-gate';
import { SCENE_KEYS } from '../src/scene-keys';

describe('GATED_ZONES derivation', () => {
  test('contains exactly z4, z5, z6, z7, z8', () => {
    expect(GATED_ZONES.has('z4')).toBe(true);
    expect(GATED_ZONES.has('z5')).toBe(true);
    expect(GATED_ZONES.has('z6')).toBe(true);
    expect(GATED_ZONES.has('z7')).toBe(true);
    expect(GATED_ZONES.has('z8')).toBe(true);
    expect(GATED_ZONES.size).toBe(5);
  });

  test('z1, z2, z3 are not members', () => {
    expect(GATED_ZONES.has('z1')).toBe(false);
    expect(GATED_ZONES.has('z2')).toBe(false);
    expect(GATED_ZONES.has('z3')).toBe(false);
  });
});

describe('scene-registry', () => {
  test('SCENE_KEYS has length 12 and includes boot, menu, play', () => {
    expect(SCENE_KEYS).toHaveLength(12);
    expect(SCENE_KEYS).toContain('boot');
    expect(SCENE_KEYS).toContain('menu');
    expect(SCENE_KEYS).toContain('play');
  });

  test('SCENE_KEYS contains all 12 expected scene names', () => {
    const expected = [
      'boot',
      'menu',
      'save-select',
      'settings',
      'credits',
      'inventory',
      'codex-shards',
      'achievements',
      'shop',
      'play',
      'game-over',
      'victory',
    ] as const;
    for (const key of expected) {
      expect(SCENE_KEYS).toContain(key);
    }
  });

  test('SCENE_KEYS is a readonly tuple — no duplicate keys', () => {
    const unique = new Set<string>(SCENE_KEYS);
    expect(unique.size).toBe(SCENE_KEYS.length);
  });
});
