/**
 * Codex (bestiary) data model — M9.2.
 *
 * Pure data + cold-path helpers. No engine imports, no runtime allocations
 * in any hot path: this module backs the in-game lore screen, which is
 * scene-cold UI. Save-state plumbing lands in a later session — for now
 * `CodexUnlockState` is in-memory only.
 */

import type { BossPattern, EnemyPattern, MinibossPattern } from '../components';

export type CodexCategory = 'enemy' | 'miniboss' | 'boss';

/**
 * `id` reuses existing engine pattern unions so the codex can never drift
 * from the actual roster. `hound` and `moon-wraith` are intentionally
 * excluded — they are boss-spawned adds, not first-class entries.
 */
export type CodexEntryId =
  | Exclude<EnemyPattern, 'hound' | 'moon-wraith'>
  | MinibossPattern
  | BossPattern;

export interface CodexEntry {
  readonly id: CodexEntryId;
  readonly category: CodexCategory;
  readonly nameKey: string;
  readonly loreKey: string;
  readonly statsKey: string;
  /** Zone in which the player first encounters the entity (1..8). */
  readonly firstSeenZone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export interface CodexUnlockState {
  readonly unlocked: ReadonlySet<CodexEntryId>;
}

const enemyEntry = (
  id: Exclude<EnemyPattern, 'hound' | 'moon-wraith'>,
  firstSeenZone: CodexEntry['firstSeenZone'],
): CodexEntry => ({
  id,
  category: 'enemy',
  nameKey: `enemies.${id}.name`,
  loreKey: `codex.${id}.lore`,
  statsKey: `codex.${id}.stats`,
  firstSeenZone,
});

const minibossEntry = (
  id: MinibossPattern,
  firstSeenZone: CodexEntry['firstSeenZone'],
): CodexEntry => ({
  id,
  category: 'miniboss',
  nameKey: `minibosses.${id}.name`,
  loreKey: `codex.${id}.lore`,
  statsKey: `codex.${id}.stats`,
  firstSeenZone,
});

const bossEntry = (id: BossPattern, firstSeenZone: CodexEntry['firstSeenZone']): CodexEntry => ({
  id,
  category: 'boss',
  nameKey: `bosses.${id}.name`,
  loreKey: `codex.${id}.lore`,
  statsKey: `codex.${id}.stats`,
  firstSeenZone,
});

/**
 * Canonical roster — 12 enemies + 4 minibosses + 8 bosses = 24 rows.
 * Order is encounter order (zone, then category-within-zone) so the codex
 * UI can render a chronological list without re-sorting.
 */
export const CODEX_ENTRIES: readonly CodexEntry[] = [
  // Zone 1 — Dachy Krakowa
  enemyEntry('skrzat', 1),
  enemyEntry('latawiec', 1),
  bossEntry('smok-krzemionkowski', 1),
  // Zone 2 — Puszcza Mazowiecka
  enemyEntry('czart', 2),
  enemyEntry('bies', 2),
  minibossEntry('rokita', 2),
  bossEntry('borowy-krol', 2),
  // Zone 3 — Wisła
  enemyEntry('topielec', 3),
  enemyEntry('strzyga', 3),
  bossEntry('wodnik-wislanny', 3),
  // Zone 4 — Łęczyckie Błota
  enemyEntry('mamuna', 4),
  enemyEntry('licho', 4),
  minibossEntry('leszy', 4),
  bossEntry('boruta', 4),
  // Zone 5 — Łysa Góra
  enemyEntry('nocnica', 5),
  enemyEntry('dziwozona', 5),
  bossEntry('baba-jaga', 5),
  // Zone 6 — Katakumby Warszawskie
  enemyEntry('wapierz', 6),
  enemyEntry('poludnica', 6),
  minibossEntry('nocny-lowca', 6),
  bossEntry('bazyliszek-warszawski', 6),
  // Zone 7 — Karczma "Rzym"
  minibossEntry('madej', 7),
  bossEntry('mefistofeles', 7),
  // Zone 8 — Księżyc
  bossEntry('lucyper-ksiezycowy', 8),
];

const ENTRY_BY_ID: ReadonlyMap<CodexEntryId, CodexEntry> = new Map(
  CODEX_ENTRIES.map((e) => [e.id, e] as const),
);

export function findCodexEntry(id: string): CodexEntry | undefined {
  return ENTRY_BY_ID.get(id as CodexEntryId);
}

export function getCodexEntriesByCategory(category: CodexCategory): readonly CodexEntry[] {
  return CODEX_ENTRIES.filter((e) => e.category === category);
}

export function createCodexUnlockState(): CodexUnlockState {
  return { unlocked: new Set<CodexEntryId>() };
}

export function isCodexEntryUnlocked(state: CodexUnlockState, id: CodexEntryId): boolean {
  return state.unlocked.has(id);
}

/**
 * Returns a new state with `id` marked unlocked. Idempotent: unlocking the
 * same id twice produces a state with the same set membership. Throws on
 * unknown ids so test runs catch typos at the boundary rather than
 * silently growing the unlock set.
 */
export function unlockCodexEntry(state: CodexUnlockState, id: CodexEntryId): CodexUnlockState {
  if (!ENTRY_BY_ID.has(id)) {
    throw new Error(`unlockCodexEntry: unknown codex id "${String(id)}"`);
  }
  if (state.unlocked.has(id)) {
    return state;
  }
  const next = new Set<CodexEntryId>(state.unlocked);
  next.add(id);
  return { unlocked: next };
}
