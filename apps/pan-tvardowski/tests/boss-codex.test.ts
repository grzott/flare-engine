import { describe, expect, test } from 'bun:test';
import { BOSS_CODEX_EXTRAS, findBossExtra } from '../src/codex/boss-entries';
import { getCodexEntriesByCategory } from '../src/codex/entries';
import { LOCALIZATION_KEYS } from '../src/localization/keys';

describe('boss codex extras', () => {
  test('BOSS_CODEX_EXTRAS covers every boss entry and only boss entries', () => {
    const bossIds = getCodexEntriesByCategory('boss').map((e) => e.id);
    const extraIds = BOSS_CODEX_EXTRAS.map((e) => e.id);

    expect(extraIds.sort()).toEqual([...bossIds].sort());
  });

  test('each extra has phaseStatsKeys.length === phases and all keys are in LOCALIZATION_KEYS', () => {
    const keySet = new Set<string>(LOCALIZATION_KEYS);
    for (const extra of BOSS_CODEX_EXTRAS) {
      expect(extra.phaseStatsKeys.length, `${String(extra.id)}.phases`).toBe(extra.phases);
      for (const key of extra.phaseStatsKeys) {
        expect(keySet.has(key), `key "${key}" missing from LOCALIZATION_KEYS`).toBe(true);
      }
    }
  });

  test('findBossExtra returns undefined for unknown id and the correct object for a known boss id', () => {
    expect(findBossExtra('not-a-boss')).toBeUndefined();

    const extra = findBossExtra('lucyper-ksiezycowy');
    expect(extra).toBeDefined();
    expect(extra?.id).toBe('lucyper-ksiezycowy');
    expect(extra?.phases).toBe(3);
    expect(extra?.phaseStatsKeys).toHaveLength(3);
  });
});
