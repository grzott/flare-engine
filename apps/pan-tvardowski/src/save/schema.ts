import type { ZoneId } from '../events';
import type { ControlsSettings, FireButtonSide, JoystickSide, Settings } from '../state';
import { defaultControls, defaultSettings } from '../state';

export const SAVE_VERSION = 5;

const ZONE_IDS: readonly ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];

export interface SlotData {
  readonly index: number;
  readonly runs: number;
  readonly bestScore: number;
  readonly lastScore: number;
  readonly bossDefeated: boolean;
  readonly savedAt: number;
  /** Highest zone the player has started or cleared in this slot. */
  readonly zoneReached: ZoneId;
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
  };
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isZone(v: unknown): v is ZoneId {
  return typeof v === 'string' && (ZONE_IDS as readonly string[]).includes(v);
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
  // v1/v2 → v3: `zoneReached` absent → default 'z1'.
  const zoneReached: ZoneId = isZone(o.zoneReached) ? o.zoneReached : 'z1';
  return {
    index: o.index,
    runs: o.runs,
    bestScore: o.bestScore,
    lastScore: o.lastScore,
    bossDefeated: o.bossDefeated,
    savedAt: o.savedAt,
    zoneReached,
  };
}

function parseControls(v: unknown): ControlsSettings {
  if (v === null || typeof v !== 'object') return defaultControls();
  const o = v as Record<string, unknown>;
  const joystickSide: JoystickSide = o.joystickSide === 'right' ? 'right' : 'left';
  const fireButtonSide: FireButtonSide = o.fireButtonSide === 'left' ? 'left' : 'right';
  return { joystickSide, fireButtonSide };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function parseSettings(v: unknown): Settings {
  if (v === null || typeof v !== 'object') return defaultSettings();
  const o = v as Record<string, unknown>;
  const shake = isBool(o.screenShake) ? o.screenShake : true;
  const reducedMotion = isBool(o.reducedMotion) ? o.reducedMotion : false;
  const rawLocale = typeof o.locale === 'string' ? o.locale : 'en';
  const locale: Settings['locale'] = rawLocale === 'pl' ? 'pl' : 'en';
  // v2 → v3: volumes + controls absent → defaults.
  const masterVolume = isNum(o.masterVolume) ? clamp01(o.masterVolume) : 1;
  const musicVolume = isNum(o.musicVolume) ? clamp01(o.musicVolume) : 1;
  const sfxVolume = isNum(o.sfxVolume) ? clamp01(o.sfxVolume) : 1;
  const controls = parseControls(o.controls);
  return {
    screenShake: shake,
    reducedMotion,
    locale,
    masterVolume,
    musicVolume,
    sfxVolume,
    controls,
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
  const o = data as Record<string, unknown>;
  const slotsArr = Array.isArray(o.slots) ? o.slots : [null, null, null];
  const slots: (SlotData | null)[] = [0, 1, 2].map((i) => parseSlot(slotsArr[i]));
  const activeSlot = isNum(o.activeSlot)
    ? Math.max(0, Math.min(2, Math.floor(o.activeSlot)))
    : null;
  // v1 → v2 migration: if `introSeen` is absent, replay the prologue once
  // (acts as a re-introduction after update).
  const introSeen = isBool(o.introSeen) ? o.introSeen : false;
  // v3 → v4 migration: `codexUnlocked` absent → empty (all locked).
  const codexUnlocked: string[] = Array.isArray(o.codexUnlocked)
    ? (o.codexUnlocked as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  // v4 → v5 migration: `entitlements` absent → empty (no IAP owned).
  const entitlements: string[] = Array.isArray(o.entitlements)
    ? (o.entitlements as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return {
    version: SAVE_VERSION,
    settings: parseSettings(o.settings),
    slots,
    activeSlot,
    introSeen,
    codexUnlocked,
    entitlements,
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
    zoneReached: 'z1',
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
  return ZONE_IDS.indexOf(b) > ZONE_IDS.indexOf(a) ? b : a;
}
