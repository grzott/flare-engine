import type { Settings } from '../state';
import { defaultSettings } from '../state';

export const SAVE_VERSION = 2;

export interface SlotData {
  readonly index: number;
  readonly runs: number;
  readonly bestScore: number;
  readonly lastScore: number;
  readonly bossDefeated: boolean;
  readonly savedAt: number;
}

export interface SaveFile {
  readonly version: number;
  readonly settings: Settings;
  readonly slots: ReadonlyArray<SlotData | null>;
  readonly activeSlot: number | null;
  /** Whether the opening cutscene has been shown. Introduced in v2 (M7). */
  readonly introSeen: boolean;
}

export function defaultSaveFile(): SaveFile {
  return {
    version: SAVE_VERSION,
    settings: defaultSettings(),
    slots: [null, null, null],
    activeSlot: null,
    introSeen: false,
  };
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function parseSlot(v: unknown): SlotData | null {
  if (v === null || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (
    !isNum(o.index) ||
    !isNum(o.runs) ||
    !isNum(o.bestScore) ||
    !isNum(o.lastScore) ||
    !isBool(o.bossDefeated) ||
    !isNum(o.savedAt)
  ) {
    return null;
  }
  return {
    index: o.index,
    runs: o.runs,
    bestScore: o.bestScore,
    lastScore: o.lastScore,
    bossDefeated: o.bossDefeated,
    savedAt: o.savedAt,
  };
}

function parseSettings(v: unknown): Settings {
  if (v === null || typeof v !== 'object') return defaultSettings();
  const o = v as Record<string, unknown>;
  const shake = isBool(o.screenShake) ? o.screenShake : true;
  const reducedMotion = isBool(o.reducedMotion) ? o.reducedMotion : false;
  const rawLocale = typeof o.locale === 'string' ? o.locale : 'en';
  const locale: Settings['locale'] = rawLocale === 'pl' ? 'pl' : 'en';
  return { screenShake: shake, reducedMotion, locale };
}

export function parseSaveFile(raw: string | null): SaveFile {
  if (!raw) return defaultSaveFile();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSaveFile();
  }
  if (data === null || typeof data !== 'object') return defaultSaveFile();
  const o = data as Record<string, unknown>;
  const slotsArr = Array.isArray(o.slots) ? o.slots : [null, null, null];
  const slots: (SlotData | null)[] = [0, 1, 2].map((i) => parseSlot(slotsArr[i]));
  const activeSlot = isNum(o.activeSlot)
    ? Math.max(0, Math.min(2, Math.floor(o.activeSlot)))
    : null;
  // v1 → v2 migration: if `introSeen` is absent, replay the prologue once
  // (acts as a re-introduction after update).
  const introSeen = isBool(o.introSeen) ? o.introSeen : false;
  return {
    version: SAVE_VERSION,
    settings: parseSettings(o.settings),
    slots,
    activeSlot,
    introSeen,
  };
}

export function createSlot(index: number): SlotData {
  return {
    index,
    runs: 0,
    bestScore: 0,
    lastScore: 0,
    bossDefeated: false,
    savedAt: 0,
  };
}

export function mergeRun(slot: SlotData, score: number, victory: boolean): SlotData {
  return {
    ...slot,
    runs: slot.runs + 1,
    bestScore: Math.max(slot.bestScore, score),
    lastScore: score,
    bossDefeated: slot.bossDefeated || victory,
    savedAt: Date.now(),
  };
}
