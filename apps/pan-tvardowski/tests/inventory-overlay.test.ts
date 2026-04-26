/**
 * Inventory overlay logic tests — M9.2.
 *
 * Deliberately avoids runtime engine-package imports (Signal, ECS, storage)
 * because Bun v1.3.11 on Windows has intermittent EACCES when reading the
 * @flare-engine/* symlinks in node_modules. All save-schema round-trip tests
 * live in save.test.ts (which also imports those packages and is equally
 * subject to the Windows symlink issue).
 */
import { describe, expect, test } from 'bun:test';
import { CODEX_ENTRIES, getCodexEntriesByCategory } from '../src/codex';
import type { CodexCategory } from '../src/codex';
import { ACHIEVEMENTS } from '../src/hud/achievements-list';

describe('inventory overlay — codex roster', () => {
  test('total entry count is 24 (12 enemies + 4 minibosses + 8 bosses)', () => {
    expect(CODEX_ENTRIES).toHaveLength(24);

    const counts: Record<CodexCategory, number> = { enemy: 0, miniboss: 0, boss: 0 };
    for (const e of CODEX_ENTRIES) {
      counts[e.category] += 1;
    }
    expect(counts).toEqual({ enemy: 12, miniboss: 4, boss: 8 });
  });

  test('getCodexEntriesByCategory returns correct subsets', () => {
    expect(getCodexEntriesByCategory('enemy')).toHaveLength(12);
    expect(getCodexEntriesByCategory('miniboss')).toHaveLength(4);
    expect(getCodexEntriesByCategory('boss')).toHaveLength(8);
  });

  test('boss category has exactly 8 entries', () => {
    const bosses = getCodexEntriesByCategory('boss');
    expect(bosses).toHaveLength(8);

    const expectedIds = [
      'smok-krzemionkowski',
      'borowy-krol',
      'wodnik-wislanny',
      'boruta',
      'baba-jaga',
      'bazyliszek-warszawski',
      'mefistofeles',
      'lucyper-ksiezycowy',
    ];
    for (const id of expectedIds) {
      const found = bosses.find((e) => e.id === id);
      expect(found, `boss entry '${id}' missing`).toBeDefined();
    }
  });

  test('all entries have valid locale key structure', () => {
    for (const entry of CODEX_ENTRIES) {
      expect(entry.loreKey.startsWith('codex.')).toBe(true);
      expect(entry.statsKey.startsWith('codex.')).toBe(true);
      expect(entry.loreKey.endsWith('.lore')).toBe(true);
      expect(entry.statsKey.endsWith('.stats')).toBe(true);
    }
  });

  test('firstSeenZone is in range 1..8 for all entries', () => {
    for (const entry of CODEX_ENTRIES) {
      expect(entry.firstSeenZone).toBeGreaterThanOrEqual(1);
      expect(entry.firstSeenZone).toBeLessThanOrEqual(8);
    }
  });
});

describe('inventory overlay — achievements list', () => {
  test('achievement list has exactly 12 entries', () => {
    expect(ACHIEVEMENTS).toHaveLength(12);
  });

  test('all achievement entries have non-empty ids and valid key prefixes', () => {
    for (const ach of ACHIEVEMENTS) {
      expect(ach.id.length).toBeGreaterThan(0);
      expect(ach.nameKey.startsWith('achievements.')).toBe(true);
      expect(ach.nameKey.endsWith('.name')).toBe(true);
      expect(ach.descKey.startsWith('achievements.')).toBe(true);
      expect(ach.descKey.endsWith('.desc')).toBe(true);
    }
  });

  test('achievement ids are unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
