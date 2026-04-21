import { type RunStats, type Settings, type SlotMeta, createSlot, defaultSettings } from '../state';
import { runMigrations } from './migrations';

export const SAVE_VERSION = 2;

export interface SaveFile {
  version: number;
  settings: Settings;
  slots: (SlotMeta | null)[];
  lastSlotIndex: number | null;
}

export function defaultSaveFile(): SaveFile {
  return {
    version: SAVE_VERSION,
    settings: defaultSettings(),
    slots: [null, null, null],
    lastSlotIndex: null,
  };
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function parseSlot(v: unknown): SlotMeta | null {
  if (v === null || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (
    !isNum(o.index) ||
    !isNum(o.savedAt) ||
    !isNum(o.runs) ||
    !isNum(o.bestScore) ||
    !isNum(o.lastScore) ||
    !isNum(o.totalKills) ||
    !isBool(o.bossDefeated) ||
    !isBool(o.firstRunSeen) ||
    !isBool(o.pendingVictoryDialogue)
  ) {
    return null;
  }
  return {
    index: o.index,
    savedAt: o.savedAt,
    runs: o.runs,
    bestScore: o.bestScore,
    lastScore: o.lastScore,
    totalKills: o.totalKills,
    bossDefeated: o.bossDefeated,
    firstRunSeen: o.firstRunSeen,
    pendingVictoryDialogue: o.pendingVictoryDialogue,
  };
}

export function parseSettings(v: unknown): Settings {
  if (v === null || typeof v !== 'object') return defaultSettings();
  const o = v as Record<string, unknown>;
  return {
    sfxVolume: isNum(o.sfxVolume) ? clamp01(o.sfxVolume) : 1,
    musicVolume: isNum(o.musicVolume) ? clamp01(o.musicVolume) : 1,
    screenShake: isBool(o.screenShake) ? o.screenShake : true,
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
  if (data === null || typeof data !== 'object') return defaultSaveFile();
  const migrated = runMigrations(data as Record<string, unknown>, SAVE_VERSION);
  if (!migrated) return defaultSaveFile();
  const settings = parseSettings(migrated.settings);
  const slotsRaw = Array.isArray(migrated.slots) ? migrated.slots : [null, null, null];
  const slots: (SlotMeta | null)[] = [0, 1, 2].map((i) => parseSlot(slotsRaw[i]));
  const lastSlotIndex = isNum(migrated.lastSlotIndex)
    ? Math.max(0, Math.min(2, Math.floor(migrated.lastSlotIndex)))
    : null;
  return { version: SAVE_VERSION, settings, slots, lastSlotIndex };
}

export function mergeRunIntoSlot(slot: SlotMeta, run: RunStats, victory: boolean): SlotMeta {
  const totalKills =
    slot.totalKills + run.kills.straight + run.kills.sine + run.kills.diagonal + run.kills.boss;
  return {
    ...slot,
    savedAt: Date.now(),
    runs: slot.runs + 1,
    bestScore: Math.max(slot.bestScore, run.score),
    lastScore: run.score,
    totalKills,
    bossDefeated: slot.bossDefeated || victory,
    firstRunSeen: true,
    pendingVictoryDialogue: slot.pendingVictoryDialogue || victory,
  };
}

export { createSlot };
