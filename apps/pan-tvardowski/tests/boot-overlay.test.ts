import { describe, expect, test } from 'bun:test';
import enJson from '../locales/en.json';
import plJson from '../locales/pl.json';
import { gameState, resetGameState } from '../src/state';

/**
 * BootOverlay state + locale tests — PT-UX-A M2.
 *
 * Avoids React / engine-package imports per established test convention.
 */

describe('boot-overlay — session #48 M2', () => {
  test('bootProgress default value is 0 and labelKey is boot.loading', () => {
    resetGameState();
    expect(gameState.bootProgress.value).toBe(0);
    expect(gameState.bootProgress.labelKey).toBe('boot.loading');
  });

  test('resetGameState resets bootProgress regardless of prior mutation', () => {
    gameState.bootProgress = { value: 0.75, labelKey: 'boot.loading.audio' };
    resetGameState();
    expect(gameState.bootProgress.value).toBe(0);
    expect(gameState.bootProgress.labelKey).toBe('boot.loading');
  });

  test('boot locale keys present in both en.json and pl.json', () => {
    const keys = ['boot.loading', 'boot.loading.save', 'boot.loading.audio'] as const;
    for (const key of keys) {
      expect((enJson as Record<string, string>)[key], `en.json missing "${key}"`).toBeDefined();
      expect((plJson as Record<string, string>)[key], `pl.json missing "${key}"`).toBeDefined();
    }
  });
});
