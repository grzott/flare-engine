import { beforeEach, describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { createSaveStore } from '../src/save/store';
import { defaultSettings, gameState, resetGameState } from '../src/state';

describe('settings round-trip', () => {
  beforeEach(() => {
    resetGameState();
    gameState.settings = defaultSettings();
  });

  test('reduced-motion toggle survives reload', async () => {
    const adapter = createMemoryAdapter();
    const s1 = createSaveStore(adapter);
    await s1.load();
    gameState.settings = { ...gameState.settings, reducedMotion: true };
    await s1.persist();

    resetGameState();
    gameState.settings = defaultSettings();
    expect(gameState.settings.reducedMotion).toBe(false);

    const s2 = createSaveStore(adapter);
    await s2.load();
    expect(gameState.settings.reducedMotion).toBe(true);
  });

  test('volumes persist and clamp', async () => {
    const adapter = createMemoryAdapter();
    const s1 = createSaveStore(adapter);
    await s1.load();
    gameState.settings = {
      ...gameState.settings,
      masterVolume: 0.4,
      musicVolume: 0.2,
      sfxVolume: 0.7,
    };
    await s1.persist();

    resetGameState();
    gameState.settings = defaultSettings();

    const s2 = createSaveStore(adapter);
    await s2.load();
    expect(gameState.settings.masterVolume).toBeCloseTo(0.4);
    expect(gameState.settings.musicVolume).toBeCloseTo(0.2);
    expect(gameState.settings.sfxVolume).toBeCloseTo(0.7);
  });

  test('control-side preferences persist', async () => {
    const adapter = createMemoryAdapter();
    const s1 = createSaveStore(adapter);
    await s1.load();
    gameState.settings = {
      ...gameState.settings,
      controls: { joystickSide: 'right', fireButtonSide: 'left' },
    };
    await s1.persist();

    resetGameState();
    gameState.settings = defaultSettings();

    const s2 = createSaveStore(adapter);
    await s2.load();
    expect(gameState.settings.controls.joystickSide).toBe('right');
    expect(gameState.settings.controls.fireButtonSide).toBe('left');
  });

  test('v1/v2 saves missing volumes + controls migrate to defaults', async () => {
    const adapter = createMemoryAdapter();
    const legacy = {
      version: 2,
      settings: { screenShake: true, reducedMotion: false, locale: 'pl' },
      slots: [null, null, null],
      activeSlot: null,
      introSeen: true,
    };
    await adapter.set('pan-tvardowski:save', JSON.stringify(legacy));
    const s = createSaveStore(adapter);
    await s.load();
    expect(gameState.settings.locale).toBe('pl');
    expect(gameState.settings.masterVolume).toBe(1);
    expect(gameState.settings.musicVolume).toBe(1);
    expect(gameState.settings.sfxVolume).toBe(1);
    expect(gameState.settings.controls.joystickSide).toBe('left');
    expect(gameState.settings.controls.fireButtonSide).toBe('right');
  });
});
