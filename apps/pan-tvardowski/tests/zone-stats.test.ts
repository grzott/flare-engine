import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { parseSaveFile } from '../src/save/schema';
import { createSaveStore } from '../src/save/store';

describe('zone-stats / v5→v6 migration', () => {
  test('v5 save (no zoneStats, no unlockedAchievements) migrates to v6 defaults and round-trips', () => {
    const v5Raw = JSON.stringify({
      version: 5,
      settings: {
        screenShake: true,
        reducedMotion: false,
        locale: 'en',
        masterVolume: 1,
        musicVolume: 1,
        sfxVolume: 1,
        controls: { joystickSide: 'left', fireButtonSide: 'right' },
      },
      slots: [
        {
          index: 0,
          runs: 3,
          bestScore: 500,
          lastScore: 200,
          bossDefeated: false,
          savedAt: 1000,
          zoneReached: 'z2',
        },
        null,
        null,
      ],
      activeSlot: 0,
      introSeen: true,
      codexUnlocked: ['c1'],
      entitlements: ['pack1'],
    });

    const parsed = parseSaveFile(v5Raw);
    expect(parsed.version).toBe(6);
    expect(parsed.unlockedAchievements).toEqual([]);
    const slot = parsed.slots[0];
    expect(slot).not.toBeNull();
    expect(slot!.zoneStats).toEqual({});

    // Round-trip: serialise then re-parse — shape must be identical.
    const reRaw = JSON.stringify(parsed);
    const reParsed = parseSaveFile(reRaw);
    expect(reParsed.version).toBe(6);
    expect(reParsed.unlockedAchievements).toEqual([]);
    expect(reParsed.slots[0]!.zoneStats).toEqual({});
  });
});

describe('zone-stats / recordZoneOutcome', () => {
  test('death increments deaths; multiple deaths accumulate', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    await store.recordZoneOutcome('z1', { cleared: false, died: true, timeMs: null, noHit: false });
    expect(store.zoneStats('z1').deaths).toBe(1);

    await store.recordZoneOutcome('z1', { cleared: false, died: true, timeMs: null, noHit: false });
    expect(store.zoneStats('z1').deaths).toBe(2);

    await store.recordZoneOutcome('z1', { cleared: false, died: true, timeMs: null, noHit: false });
    expect(store.zoneStats('z1').deaths).toBe(3);

    // Persists across reload
    const store2 = createSaveStore(adapter);
    await store2.load();
    expect(store2.zoneStats('z1').deaths).toBe(3);
  });

  test('bestTimeMs keeps the minimum across multiple clears', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    await store.recordZoneOutcome('z2', {
      cleared: true,
      died: false,
      timeMs: 12000,
      noHit: false,
    });
    expect(store.zoneStats('z2').bestTimeMs).toBe(12000);

    await store.recordZoneOutcome('z2', {
      cleared: true,
      died: false,
      timeMs: 9500,
      noHit: false,
    });
    expect(store.zoneStats('z2').bestTimeMs).toBe(9500);

    await store.recordZoneOutcome('z2', {
      cleared: true,
      died: false,
      timeMs: 11000,
      noHit: false,
    });
    expect(store.zoneStats('z2').bestTimeMs).toBe(9500);
  });

  test('noHit: starts false, flips on clean clear, stays true even after hit-taken clear', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    // First clear with hits — noHit stays false.
    await store.recordZoneOutcome('z3', {
      cleared: true,
      died: false,
      timeMs: 8000,
      noHit: false,
    });
    expect(store.zoneStats('z3').noHit).toBe(false);

    // First clean clear — noHit flips to true.
    await store.recordZoneOutcome('z3', {
      cleared: true,
      died: false,
      timeMs: 7500,
      noHit: true,
    });
    expect(store.zoneStats('z3').noHit).toBe(true);

    // Subsequent hit-taken clear — noHit stays true (sticky).
    await store.recordZoneOutcome('z3', {
      cleared: true,
      died: false,
      timeMs: 9000,
      noHit: false,
    });
    expect(store.zoneStats('z3').noHit).toBe(true);
  });
});
