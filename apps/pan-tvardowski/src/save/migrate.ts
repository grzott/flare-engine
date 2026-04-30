import { defineMigrationChain, runMigrations } from '@flare-engine/storage';
import type { ZoneId } from '../events';
import type { ControlsSettings, FireButtonSide, JoystickSide, Settings } from '../state';
import { defaultControls, defaultSettings } from '../state';
import type { PrivacySettings, SaveFile, SlotData, ZoneClearStats } from './schema';

/** Must equal SAVE_VERSION in schema.ts. */
const CURRENT_VERSION = 8;

// ---------------------------------------------------------------------------
// Primitive guards
// ---------------------------------------------------------------------------

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

const ZONE_IDS: readonly ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];

export function isZone(v: unknown): v is ZoneId {
  return typeof v === 'string' && (ZONE_IDS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Structural parsers
// ---------------------------------------------------------------------------

export function parseZoneStats(v: unknown): Partial<Record<ZoneId, ZoneClearStats>> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const result: Partial<Record<ZoneId, ZoneClearStats>> = {};
  for (const id of ZONE_IDS) {
    const entry = o[id];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    if (!isNum(e.deaths) || !isBool(e.noHit)) continue;
    const bestTimeMs = e.bestTimeMs === null ? null : isNum(e.bestTimeMs) ? e.bestTimeMs : null;
    result[id] = { deaths: e.deaths, bestTimeMs, noHit: e.noHit };
  }
  return result;
}

export function parseSlot(v: unknown): SlotData | null {
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
  const zoneReached: ZoneId = isZone(o.zoneReached) ? o.zoneReached : 'z1';
  const zoneStats: Partial<Record<ZoneId, ZoneClearStats>> = parseZoneStats(o.zoneStats);
  return {
    index: o.index,
    runs: o.runs,
    bestScore: o.bestScore,
    lastScore: o.lastScore,
    bossDefeated: o.bossDefeated,
    savedAt: o.savedAt,
    zoneReached,
    zoneStats,
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

export function parseSettings(v: unknown): Settings {
  if (v === null || typeof v !== 'object') return defaultSettings();
  const o = v as Record<string, unknown>;
  const shake = isBool(o.screenShake) ? o.screenShake : true;
  const reducedMotion = isBool(o.reducedMotion) ? o.reducedMotion : false;
  const colorBlindMode = isBool(o.colorBlindMode) ? o.colorBlindMode : false;
  const rawLocale = typeof o.locale === 'string' ? o.locale : 'en';
  const locale: Settings['locale'] = rawLocale === 'pl' ? 'pl' : 'en';
  const masterVolume = isNum(o.masterVolume) ? clamp01(o.masterVolume) : 1;
  const musicVolume = isNum(o.musicVolume) ? clamp01(o.musicVolume) : 1;
  const sfxVolume = isNum(o.sfxVolume) ? clamp01(o.sfxVolume) : 1;
  const controls = parseControls(o.controls);
  return {
    screenShake: shake,
    reducedMotion,
    colorBlindMode,
    locale,
    masterVolume,
    musicVolume,
    sfxVolume,
    controls,
  };
}

export function parsePrivacy(v: unknown): PrivacySettings {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return { analyticsOptIn: false, crashOptIn: false };
  }
  const o = v as Record<string, unknown>;
  return {
    analyticsOptIn: isBool(o.analyticsOptIn) ? o.analyticsOptIn : false,
    crashOptIn: isBool(o.crashOptIn) ? o.crashOptIn : false,
  };
}

// ---------------------------------------------------------------------------
// Default save — inlined to avoid runtime circular dependency with schema.ts.
// Must stay in sync with defaultSaveFile() in schema.ts.
// ---------------------------------------------------------------------------

function makeDefaultSaveFile(): SaveFile {
  return {
    version: CURRENT_VERSION,
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

// ---------------------------------------------------------------------------
// Migration step chain — one function per version boundary.
// ---------------------------------------------------------------------------

const MIGRATIONS = defineMigrationChain([
  {
    from: 1,
    to: 2,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      return {
        ...o,
        version: 2,
        introSeen: typeof o.introSeen === 'boolean' ? o.introSeen : false,
      };
    },
  },
  {
    from: 2,
    to: 3,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      return {
        ...o,
        version: 3,
        codexUnlocked: Array.isArray(o.codexUnlocked) ? o.codexUnlocked : [],
      };
    },
  },
  {
    from: 3,
    to: 4,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      return { ...o, version: 4 };
    },
  },
  {
    from: 4,
    to: 5,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      return {
        ...o,
        version: 5,
        entitlements: Array.isArray(o.entitlements) ? o.entitlements : [],
      };
    },
  },
  {
    from: 5,
    to: 6,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      return {
        ...o,
        version: 6,
        unlockedAchievements: Array.isArray(o.unlockedAchievements) ? o.unlockedAchievements : [],
      };
    },
  },
  {
    from: 6,
    to: 7,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      return {
        ...o,
        version: 7,
        privacy:
          o.privacy !== null && typeof o.privacy === 'object' && !Array.isArray(o.privacy)
            ? o.privacy
            : { analyticsOptIn: false, crashOptIn: false },
      };
    },
  },
  {
    from: 7,
    to: 8,
    migrate: (data: unknown): unknown => {
      const o = data as Record<string, unknown>;
      const settings =
        o.settings !== null && typeof o.settings === 'object' && !Array.isArray(o.settings)
          ? { colorBlindMode: false, ...(o.settings as Record<string, unknown>) }
          : o.settings;
      return { ...o, version: 8, settings };
    },
  },
]);

function applySteps(o: Record<string, unknown>): Record<string, unknown> {
  const v = typeof o.version === 'number' ? Math.floor(o.version) : 1;
  return runMigrations(o, v, CURRENT_VERSION, MIGRATIONS) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Structural parse of a fully-migrated v7 object
// ---------------------------------------------------------------------------

function structuralParse(o: Record<string, unknown>): SaveFile {
  const slotsArr = Array.isArray(o.slots) ? o.slots : [null, null, null];
  const slots = [0, 1, 2].map((i) => parseSlot(slotsArr[i]));

  const rawActiveSlot = o.activeSlot;
  const activeSlot =
    typeof rawActiveSlot === 'number' && Number.isFinite(rawActiveSlot)
      ? Math.max(0, Math.min(2, Math.floor(rawActiveSlot)))
      : null;

  const introSeen = typeof o.introSeen === 'boolean' ? o.introSeen : false;

  const codexUnlocked: string[] = Array.isArray(o.codexUnlocked)
    ? (o.codexUnlocked as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const entitlements: string[] = Array.isArray(o.entitlements)
    ? (o.entitlements as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const unlockedAchievements: string[] = Array.isArray(o.unlockedAchievements)
    ? (o.unlockedAchievements as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  return {
    version: CURRENT_VERSION,
    settings: parseSettings(o.settings),
    slots,
    activeSlot,
    introSeen,
    codexUnlocked,
    entitlements,
    unlockedAchievements,
    privacy: parsePrivacy(o.privacy),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parse an unknown value (already JSON-decoded) into a validated SaveFile.
 *  Returns a default SaveFile if the input is not a plain object.
 */
export function fromUnknown(raw: unknown): SaveFile {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return makeDefaultSaveFile();
  }
  const migrated = applySteps(raw as Record<string, unknown>);
  return structuralParse(migrated);
}
