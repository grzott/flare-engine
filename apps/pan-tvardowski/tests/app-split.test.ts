import { describe, expect, test } from 'bun:test';
import { SCENE_KEYS } from '../src/scene-keys';

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
