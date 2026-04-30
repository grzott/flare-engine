import { describe, expect, test } from 'bun:test';
import { fromUnknown } from '../src/save/migrate';

describe('save-migrator / fromUnknown', () => {
  // T1 — v1 blob: no version field, no introSeen
  test('v1 blob → introSeen false, version 8, analyticsOptIn false', () => {
    const blob = {
      settings: {},
      slots: [null, null, null],
      activeSlot: null,
    };
    const result = fromUnknown(blob);
    expect(result.version).toBe(8);
    expect(result.introSeen).toBe(false);
    expect(result.privacy.analyticsOptIn).toBe(false);
    expect(result.privacy.crashOptIn).toBe(false);
  });

  // T2 — v3 blob: introSeen present, no codexUnlocked, no entitlements
  test('v3 blob → introSeen true, codexUnlocked [], entitlements []', () => {
    const blob = {
      version: 3,
      introSeen: true,
      settings: {},
      slots: [null, null, null],
      activeSlot: null,
    };
    const result = fromUnknown(blob);
    expect(result.introSeen).toBe(true);
    expect(result.codexUnlocked).toEqual([]);
    expect(result.entitlements).toEqual([]);
    expect(result.version).toBe(8);
  });

  // T4 — v5 blob: entitlements present, slot missing zoneStats
  test('v5 blob → slot zoneStats {}, unlockedAchievements []', () => {
    const blob = {
      version: 5,
      introSeen: true,
      codexUnlocked: ['entry-leszy'],
      entitlements: ['premium'],
      settings: {},
      slots: [
        {
          index: 0,
          runs: 3,
          bestScore: 1200,
          lastScore: 900,
          bossDefeated: false,
          savedAt: 1000,
          zoneReached: 'z2',
          // zoneStats intentionally absent
        },
        null,
        null,
      ],
      activeSlot: 0,
    };
    const result = fromUnknown(blob);
    expect(result.unlockedAchievements).toEqual([]);
    const slot = result.slots[0];
    expect(slot).not.toBeNull();
    expect(slot!.zoneStats).toEqual({});
    expect(result.version).toBe(8);
  });

  // T5 — v6 blob: unlockedAchievements present, no privacy
  test('v6 blob → privacy defaults to all-false', () => {
    const blob = {
      version: 6,
      introSeen: true,
      codexUnlocked: [],
      entitlements: [],
      unlockedAchievements: ['ach-first-run'],
      settings: {},
      slots: [null, null, null],
      activeSlot: null,
    };
    const result = fromUnknown(blob);
    expect(result.privacy).toEqual({ analyticsOptIn: false, crashOptIn: false });
    expect(result.unlockedAchievements).toEqual(['ach-first-run']);
    expect(result.version).toBe(8);
  });

  // T6 — v7 blob: migrates to v8, colorBlindMode defaults to false
  test('v7 blob migrates to v8, colorBlindMode defaults false', () => {
    const blob = {
      version: 7,
      introSeen: true,
      codexUnlocked: ['entry-leszy', 'entry-baba-jaga'],
      entitlements: ['premium'],
      unlockedAchievements: ['ach-first-run'],
      privacy: { analyticsOptIn: true, crashOptIn: false },
      settings: {
        screenShake: false,
        reducedMotion: true,
        locale: 'pl',
        masterVolume: 0.8,
        musicVolume: 0.5,
        sfxVolume: 1,
        controls: { joystickSide: 'right', fireButtonSide: 'left' },
      },
      slots: [null, null, null],
      activeSlot: null,
    };
    const result = fromUnknown(blob);
    expect(result.version).toBe(8);
    expect(result.introSeen).toBe(true);
    expect(result.codexUnlocked).toEqual(['entry-leszy', 'entry-baba-jaga']);
    expect(result.entitlements).toEqual(['premium']);
    expect(result.unlockedAchievements).toEqual(['ach-first-run']);
    expect(result.privacy).toEqual({ analyticsOptIn: true, crashOptIn: false });
    expect(result.settings.screenShake).toBe(false);
    expect(result.settings.reducedMotion).toBe(true);
    expect(result.settings.colorBlindMode).toBe(false);
    expect(result.settings.locale).toBe('pl');
    expect(result.settings.masterVolume).toBeCloseTo(0.8);
    expect(result.settings.controls.joystickSide).toBe('right');
  });

  // T7 — v8 blob: fully current — round-trips including colorBlindMode
  test('v8 blob with colorBlindMode=true round-trips', () => {
    const blob = {
      version: 8,
      introSeen: true,
      codexUnlocked: [],
      entitlements: [],
      unlockedAchievements: [],
      privacy: { analyticsOptIn: false, crashOptIn: false },
      settings: {
        screenShake: true,
        reducedMotion: false,
        colorBlindMode: true,
        locale: 'en',
        masterVolume: 1,
        musicVolume: 1,
        sfxVolume: 1,
        controls: { joystickSide: 'left', fireButtonSide: 'right' },
      },
      slots: [null, null, null],
      activeSlot: null,
    };
    const result = fromUnknown(blob);
    expect(result.version).toBe(8);
    expect(result.settings.colorBlindMode).toBe(true);
  });
});
