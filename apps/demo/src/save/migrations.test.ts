import { describe, expect, it } from 'bun:test';
import { SAVE_VERSION, parseSaveFile } from './schema';

describe('save migrations', () => {
  it('upgrades a v1 payload to the current schema without data loss', () => {
    const v1Raw = JSON.stringify({
      version: 1,
      settings: { sfxVolume: 0.4, musicVolume: 0.2, screenShake: false },
      slots: [
        {
          index: 0,
          savedAt: 12345,
          runs: 3,
          bestScore: 900,
          lastScore: 700,
          totalKills: 42,
          bossDefeated: true,
          firstRunSeen: true,
          pendingVictoryDialogue: true,
        },
        null,
        null,
      ],
      lastSlotIndex: 0,
    });
    const f = parseSaveFile(v1Raw);
    expect(f.version).toBe(SAVE_VERSION);
    expect(f.settings.sfxVolume).toBe(0.4);
    expect(f.settings.screenShake).toBe(false);
    expect(f.slots[0]?.bestScore).toBe(900);
    expect(f.slots[0]?.totalKills).toBe(42);
    expect(f.slots[0]?.pendingVictoryDialogue).toBe(true);
    expect(f.lastSlotIndex).toBe(0);
  });

  it('returns defaults when version is unknown (future payload)', () => {
    const futureRaw = JSON.stringify({ version: 999, settings: {}, slots: [] });
    const f = parseSaveFile(futureRaw);
    expect(f.version).toBe(SAVE_VERSION);
    expect(f.slots[0]).toBeNull();
  });
});
