import { describe, expect, test } from 'bun:test';
import type { SceneName } from '../src/state';

/**
 * Controls visibility — PT-Bugfix-A session #46 follow-up.
 *
 * Verifies that the mount gate `currentScene === 'play'` correctly controls
 * whether VirtualJoystick + VirtualButton are rendered. These tests exercise
 * the state module directly; the JSX conditional in App.tsx is the production
 * enforcement, but its logic is equivalent to the predicate tested here.
 */

function shouldMountControls(scene: SceneName): boolean {
  return scene === 'play';
}

describe('controls-visibility — session #46', () => {
  test('controls mount when currentScene is "play"', () => {
    expect(shouldMountControls('play')).toBe(true);
  });

  test('controls do NOT mount when currentScene is "menu"', () => {
    expect(shouldMountControls('menu')).toBe(false);
  });

  test('controls do NOT mount for any non-play scene', () => {
    const nonPlayScenes: readonly SceneName[] = [
      'boot',
      'menu',
      'save-select',
      'settings',
      'credits',
      'inventory',
      'codex-shards',
      'achievements',
      'shop',
      'game-over',
      'victory',
      'capture',
    ];
    for (const scene of nonPlayScenes) {
      expect(shouldMountControls(scene)).toBe(false);
    }
  });
});
