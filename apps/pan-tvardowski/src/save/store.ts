import { clamp } from '@flare-engine/math';
import { type StorageAdapter, createMemoryAdapter, createMmkvAdapter } from '@flare-engine/storage';
import type { ZoneId } from '../events';
import { isBenchSaveMuted } from '../perf/bench-mode';
import { gameState, notifyStateChanged } from '../state';
import {
  type PrivacySettings,
  SAVE_VERSION,
  type SaveFile,
  type SlotData,
  type ZoneClearOutcome,
  type ZoneClearStats,
  createSlot,
  defaultSaveFile,
  mergeRun,
  mergeZoneOutcome,
  parseSaveFile,
} from './schema';

const KEY = 'pan-tvardowski:save';

export interface SaveStore {
  load(): Promise<void>;
  persist(): Promise<void>;
  selectSlot(index: number): Promise<void>;
  createSlot(index: number): Promise<void>;
  commitRun(score: number, victory: boolean, zoneReached?: ZoneId): Promise<void>;
  getSlot(index: number): SlotData | null;
  activeSlot(): number | null;
  introSeen(): boolean;
  markIntroSeen(): Promise<void>;
  codexUnlocked(): readonly string[];
  unlockCodexEntry(id: string): Promise<void>;
  entitlements(): readonly string[];
  grantEntitlement(key: string): Promise<void>;
  zoneStats(zoneId: ZoneId): ZoneClearStats;
  recordZoneOutcome(zoneId: ZoneId, outcome: ZoneClearOutcome): Promise<void>;
  unlockedAchievements(): readonly string[];
  unlockAchievement(id: string): Promise<void>;
  privacy(): PrivacySettings;
  setPrivacy(p: PrivacySettings): Promise<void>;
}

function makeMmkvAdapter(): StorageAdapter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-mmkv') as {
      MMKV: new (opts?: object) => unknown;
    };
    const instance = new mod.MMKV({ id: 'pan-tvardowski' }) as Parameters<
      typeof createMmkvAdapter
    >[0];
    return createMmkvAdapter(instance);
  } catch {
    return null;
  }
}

export function createSaveStore(adapter?: StorageAdapter): SaveStore {
  const a: StorageAdapter = adapter ?? makeMmkvAdapter() ?? createMemoryAdapter();

  let state: SaveFile = defaultSaveFile();

  function apply(file: SaveFile): void {
    state = file;
    gameState.settings = file.settings;
    if (file.activeSlot !== null) {
      gameState.activeSlot = clamp(file.activeSlot, 0, 2) as 0 | 1 | 2;
    }
  }

  function snapshot(): SaveFile {
    return {
      version: SAVE_VERSION,
      settings: gameState.settings,
      slots: state.slots,
      activeSlot: state.activeSlot,
      introSeen: state.introSeen,
      codexUnlocked: state.codexUnlocked,
      entitlements: state.entitlements,
      unlockedAchievements: state.unlockedAchievements,
      privacy: state.privacy,
    };
  }

  async function persist(): Promise<void> {
    await a.set(KEY, JSON.stringify(state));
  }

  async function write(): Promise<void> {
    if (isBenchSaveMuted()) return;
    state = snapshot();
    await persist();
  }

  return {
    async load() {
      const raw = await a.get(KEY);
      apply(raw === null ? defaultSaveFile() : parseSaveFile(raw));
      notifyStateChanged();
    },
    persist: write,
    async selectSlot(index) {
      const clamped = clamp(index, 0, 2) as 0 | 1 | 2;
      state = { ...state, activeSlot: clamped };
      gameState.activeSlot = clamped;
      await persist();
      notifyStateChanged();
    },
    async createSlot(index) {
      const clamped = clamp(index, 0, 2) as 0 | 1 | 2;
      const slots = state.slots.slice();
      slots[clamped] = createSlot(clamped);
      state = { ...state, slots, activeSlot: clamped };
      gameState.activeSlot = clamped;
      await persist();
      notifyStateChanged();
    },
    async commitRun(score, victory, zoneReached) {
      const idx = state.activeSlot ?? 0;
      const slots = state.slots.slice();
      const current = slots[idx] ?? createSlot(idx);
      slots[idx] = mergeRun(current, score, victory, zoneReached ?? current.zoneReached);
      state = { ...state, slots, activeSlot: idx };
      await persist();
      notifyStateChanged();
    },
    getSlot(index) {
      return state.slots[index] ?? null;
    },
    activeSlot() {
      return state.activeSlot;
    },
    introSeen() {
      if (isBenchSaveMuted()) return true;
      return state.introSeen;
    },
    async markIntroSeen() {
      if (state.introSeen) return;
      state = { ...state, introSeen: true };
      await persist();
      notifyStateChanged();
    },
    codexUnlocked() {
      return state.codexUnlocked;
    },
    async unlockCodexEntry(id) {
      if (state.codexUnlocked.includes(id)) return;
      state = { ...state, codexUnlocked: [...state.codexUnlocked, id] };
      await persist();
      notifyStateChanged();
    },
    entitlements() {
      return state.entitlements;
    },
    async grantEntitlement(key) {
      if (state.entitlements.includes(key)) return;
      state = { ...state, entitlements: [...state.entitlements, key] };
      await persist();
      notifyStateChanged();
    },
    zoneStats(zoneId) {
      const idx = state.activeSlot ?? 0;
      const slot = state.slots[idx];
      return slot?.zoneStats[zoneId] ?? { deaths: 0, bestTimeMs: null, noHit: false };
    },
    async recordZoneOutcome(zoneId, outcome) {
      const idx = state.activeSlot ?? 0;
      const slots = state.slots.slice();
      const current = slots[idx] ?? createSlot(idx);
      slots[idx] = mergeZoneOutcome(current, zoneId, outcome);
      state = { ...state, slots };
      await persist();
      notifyStateChanged();
    },
    unlockedAchievements() {
      return state.unlockedAchievements;
    },
    async unlockAchievement(id) {
      if (state.unlockedAchievements.includes(id)) return;
      state = { ...state, unlockedAchievements: [...state.unlockedAchievements, id] };
      await persist();
      notifyStateChanged();
    },
    privacy() {
      return state.privacy;
    },
    async setPrivacy(p) {
      state = { ...state, privacy: p };
      await persist();
      notifyStateChanged();
    },
  };
}
