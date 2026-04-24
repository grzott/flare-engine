import { describe, expect, test } from 'bun:test';
import en from '../locales/en.json' with { type: 'json' };
import pl from '../locales/pl.json' with { type: 'json' };
import {
  CODEX_ENTRIES,
  type CodexEntryId,
  createCodexUnlockState,
  findCodexEntry,
  getCodexEntriesByCategory,
  isCodexEntryUnlocked,
  unlockCodexEntry,
} from '../src/codex';

const enTable = en as Record<string, string>;
const plTable = pl as Record<string, string>;

describe('codex entries', () => {
  test('roster has 24 unique rows split 12/4/8 across categories', () => {
    expect(CODEX_ENTRIES).toHaveLength(24);

    const ids = CODEX_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    const counts = { enemy: 0, miniboss: 0, boss: 0 };
    for (const e of CODEX_ENTRIES) {
      counts[e.category] += 1;
    }
    expect(counts).toEqual({ enemy: 12, miniboss: 4, boss: 8 });

    expect(getCodexEntriesByCategory('enemy')).toHaveLength(12);
    expect(getCodexEntriesByCategory('miniboss')).toHaveLength(4);
    expect(getCodexEntriesByCategory('boss')).toHaveLength(8);

    // No boss-spawned adds promoted to first-class entries.
    expect(ids).not.toContain('hound');
    expect(ids).not.toContain('moon-wraith');
  });

  test('findCodexEntry resolves known ids and returns undefined for unknown', () => {
    const skrzat = findCodexEntry('skrzat');
    expect(skrzat).toBeDefined();
    expect(skrzat?.category).toBe('enemy');
    expect(skrzat?.nameKey).toBe('enemies.skrzat.name');

    const lucyper = findCodexEntry('lucyper-ksiezycowy');
    expect(lucyper).toBeDefined();
    expect(lucyper?.category).toBe('boss');
    expect(lucyper?.firstSeenZone).toBe(8);

    expect(findCodexEntry('not-a-real-thing')).toBeUndefined();
    expect(findCodexEntry('hound')).toBeUndefined();
  });

  test('every entry has non-empty EN and PL strings for name/lore/stats', () => {
    for (const entry of CODEX_ENTRIES) {
      for (const key of [entry.nameKey, entry.loreKey, entry.statsKey]) {
        const enVal = enTable[key];
        const plVal = plTable[key];
        expect(typeof enVal, `en[${key}]`).toBe('string');
        expect((enVal ?? '').length, `en[${key}]`).toBeGreaterThan(0);
        expect(typeof plVal, `pl[${key}]`).toBe('string');
        expect((plVal ?? '').length, `pl[${key}]`).toBeGreaterThan(0);
      }
    }
  });

  test('unlock state is empty, idempotent, and rejects unknown ids', () => {
    const empty = createCodexUnlockState();
    expect(empty.unlocked.size).toBe(0);
    expect(isCodexEntryUnlocked(empty, 'skrzat')).toBe(false);

    const once = unlockCodexEntry(empty, 'skrzat');
    expect(once.unlocked.size).toBe(1);
    expect(isCodexEntryUnlocked(once, 'skrzat')).toBe(true);
    // Original state is untouched (functional update).
    expect(empty.unlocked.size).toBe(0);

    const twice = unlockCodexEntry(once, 'skrzat');
    expect(twice.unlocked.size).toBe(1);
    expect(isCodexEntryUnlocked(twice, 'skrzat')).toBe(true);

    const both = unlockCodexEntry(once, 'boruta');
    expect(both.unlocked.size).toBe(2);
    expect(isCodexEntryUnlocked(both, 'boruta')).toBe(true);
    expect(isCodexEntryUnlocked(both, 'skrzat')).toBe(true);
    expect(isCodexEntryUnlocked(both, 'mefistofeles')).toBe(false);

    expect(() => unlockCodexEntry(empty, 'not-a-real-id' as CodexEntryId)).toThrow(
      /unknown codex id/,
    );
  });
});
