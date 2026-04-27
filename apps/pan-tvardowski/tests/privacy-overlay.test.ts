import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { createSaveStore } from '../src/save/store';

describe('privacy settings — M9.6', () => {
  test('analyticsOptIn defaults to false on fresh save', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    expect(store.privacy().analyticsOptIn).toBe(false);
  });

  test('crashOptIn persists across reload', async () => {
    const adapter = createMemoryAdapter();
    const s1 = createSaveStore(adapter);
    await s1.load();
    await s1.setPrivacy({ analyticsOptIn: false, crashOptIn: true });

    const s2 = createSaveStore(adapter);
    await s2.load();
    expect(s2.privacy().crashOptIn).toBe(true);
    expect(s2.privacy().analyticsOptIn).toBe(false);
  });

  test('v6 save missing privacy field migrates to both-false defaults', async () => {
    const adapter = createMemoryAdapter();
    const v6Save = {
      version: 6,
      settings: { screenShake: true, reducedMotion: false, locale: 'en' },
      slots: [null, null, null],
      activeSlot: null,
      introSeen: true,
      codexUnlocked: [],
      entitlements: [],
      unlockedAchievements: [],
    };
    await adapter.set('pan-tvardowski:save', JSON.stringify(v6Save));
    const store = createSaveStore(adapter);
    await store.load();
    expect(store.privacy().analyticsOptIn).toBe(false);
    expect(store.privacy().crashOptIn).toBe(false);
  });
});
