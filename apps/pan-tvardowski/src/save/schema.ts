import type { ZoneId } from '../events';
import type { Settings } from '../state';
import { defaultSettings } from '../state';
import { fromUnknown } from './migrate';

export const SAVE_VERSION = 7;

export interface ZoneClearStats {
  readonly deaths: number;
  readonly bestTimeMs: number | null;
  readonly noHit: boolean;
}

export interface ZoneClearOutcome {
  readonly cleared: boolean;
  readonly died: boolean;
  readonly timeMs: number | null;
  readonly noHit: boolean;
}

export interface SlotData {
  readonly index: number;
  readonly runs: number;
  readonly bestScore: number;
  readonly lastScore: number;
  readonly bossDefeated: boolean;
  readonly savedAt: number;
  /** Highest zone the player has started or cleared in this slot. */
  readonly zoneReached: ZoneId;
  /** Per-zone clear statistics — keyed by ZoneId. Introduced in v6. */
  readonly zoneStats: Partial<Record<ZoneId, ZoneClearStats>>;
}

/** Opt-in telemetry preferences. Introduced in v7 (M9.6). */
export interface PrivacySettings {
  readonly analyticsOptIn: boolean;
  readonly crashOptIn: boolean;
}

export interface SaveFile {
  readonly version: number;
  readonly settings: Settings;
  readonly slots: ReadonlyArray<SlotData | null>;
  readonly activeSlot: number | null;
  /** Whether the opening cutscene has been shown. Introduced in v2 (M7). */
  readonly introSeen: boolean;
  /** Codex entry ids that have been unlocked across all slots. Introduced in v4 (M9.2). */
  readonly codexUnlocked: readonly string[];
  /** IAP entitlement keys owned by this player. Introduced in v5 (M9.3). */
  readonly entitlements: readonly string[];
  /** Achievement ids unlocked across all slots. Introduced in v6. */
  readonly unlockedAchievements: readonly string[];
  /** User privacy/telemetry opt-in choices. Introduced in v7 (M9.6). */
  readonly privacy: PrivacySettings;
}

export function defaultSaveFile(): SaveFile {
  return {
    version: SAVE_VERSION,
    settings: defaultSettings(),
    slots: [null, null, null],
    activeSlot: null,
    introSeen: false,
    codexUnlocked: [],
    entitlements: [],
    unlockedAchievements: [],
    privacy: { analyticsOptIn: false, crashOptIn: false },
  };
}

export function parseSaveFile(raw: string | null): SaveFile {
  if (!raw) return defaultSaveFile();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSaveFile();
  }
  return fromUnknown(data);
}

export function createSlot(index: number): SlotData {
  return {
    index,
    runs: 0,
    bestScore: 0,
    lastScore: 0,
    bossDefeated: false,
    savedAt: 0,
    zoneReached: 'z1',
    zoneStats: {},
  };
}

export function mergeRun(
  slot: SlotData,
  score: number,
  victory: boolean,
  zoneReached: ZoneId = slot.zoneReached,
): SlotData {
  return {
    ...slot,
    runs: slot.runs + 1,
    bestScore: Math.max(slot.bestScore, score),
    lastScore: score,
    bossDefeated: slot.bossDefeated || victory,
    savedAt: Date.now(),
    zoneReached: maxZone(slot.zoneReached, zoneReached),
  };
}

function maxZone(a: ZoneId, b: ZoneId): ZoneId {
  const ZONE_IDS: readonly ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];
  return ZONE_IDS.indexOf(b) > ZONE_IDS.indexOf(a) ? b : a;
}

export function mergeZoneOutcome(
  slot: SlotData,
  zoneId: ZoneId,
  outcome: ZoneClearOutcome,
): SlotData {
  const prev: ZoneClearStats = slot.zoneStats[zoneId] ?? {
    deaths: 0,
    bestTimeMs: null,
    noHit: false,
  };
  const deaths = prev.deaths + (outcome.died ? 1 : 0);
  const bestTimeMs =
    outcome.cleared && outcome.timeMs !== null
      ? prev.bestTimeMs === null
        ? outcome.timeMs
        : Math.min(prev.bestTimeMs, outcome.timeMs)
      : prev.bestTimeMs;
  // noHit is sticky-true: once set it cannot be cleared.
  // It only gets set on a cleared run where noHit === true.
  const noHit = prev.noHit || (outcome.cleared && outcome.noHit);
  const updated: ZoneClearStats = { deaths, bestTimeMs, noHit };
  return {
    ...slot,
    zoneStats: { ...slot.zoneStats, [zoneId]: updated },
  };
}
