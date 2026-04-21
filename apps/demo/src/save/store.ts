import { type StorageAdapter, createMemoryAdapter, createMmkvAdapter } from '@flare-engine/storage';
import {
  type RunStats,
  type Settings,
  type SlotMeta,
  createSlot,
  gameState,
  notifyStateChanged,
} from '../state';
import {
  SAVE_VERSION,
  type SaveFile,
  defaultSaveFile,
  mergeRunIntoSlot,
  parseSaveFile,
} from './schema';

const KEY = 'flare-shmup:save';

export interface SaveStore {
  load(): Promise<void>;
  persist(): Promise<void>;
  setSettings(patch: Partial<Settings>): Promise<void>;
  selectSlot(index: number): Promise<void>;
  createSlot(index: number): Promise<void>;
  resetSlot(index: number): Promise<void>;
  commitRun(run: RunStats, victory: boolean): Promise<void>;
  clearPendingVictoryDialogue(index: number): Promise<void>;
}

function makeMmkvAdapter(): StorageAdapter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-mmkv') as {
      MMKV: new (opts?: object) => unknown;
    };
    const instance = new mod.MMKV({ id: 'flare-shmup' }) as Parameters<typeof createMmkvAdapter>[0];
    return createMmkvAdapter(instance);
  } catch {
    return null;
  }
}

export function createSaveStore(adapter?: StorageAdapter): SaveStore {
  const a: StorageAdapter = adapter ?? makeMmkvAdapter() ?? createMemoryAdapter();

  function apply(file: SaveFile): void {
    gameState.settings = file.settings;
    gameState.slots = [file.slots[0] ?? null, file.slots[1] ?? null, file.slots[2] ?? null];
    gameState.lastSlotIndex = file.lastSlotIndex;
  }

  function snapshot(): SaveFile {
    return {
      version: SAVE_VERSION,
      settings: gameState.settings,
      slots: gameState.slots.slice(0, 3),
      lastSlotIndex: gameState.lastSlotIndex,
    };
  }

  async function write(): Promise<void> {
    await a.set(KEY, JSON.stringify(snapshot()));
  }

  return {
    async load() {
      const raw = await a.get(KEY);
      apply(raw === null ? defaultSaveFile() : parseSaveFile(raw));
      notifyStateChanged();
    },
    persist: write,
    async setSettings(patch) {
      gameState.settings = { ...gameState.settings, ...patch };
      await write();
      notifyStateChanged();
    },
    async selectSlot(index) {
      gameState.activeSlot = index;
      gameState.lastSlotIndex = index;
      await write();
      notifyStateChanged();
    },
    async createSlot(index) {
      gameState.slots[index] = createSlot(index);
      gameState.activeSlot = index;
      gameState.lastSlotIndex = index;
      await write();
      notifyStateChanged();
    },
    async resetSlot(index) {
      gameState.slots[index] = null;
      if (gameState.activeSlot === index) gameState.activeSlot = null;
      if (gameState.lastSlotIndex === index) gameState.lastSlotIndex = null;
      await write();
      notifyStateChanged();
    },
    async commitRun(run, victory) {
      const i = gameState.activeSlot;
      if (i === null) return;
      const existing: SlotMeta = gameState.slots[i] ?? createSlot(i);
      gameState.slots[i] = mergeRunIntoSlot(existing, run, victory);
      gameState.lastSlotIndex = i;
      await write();
      notifyStateChanged();
    },
    async clearPendingVictoryDialogue(index) {
      const slot = gameState.slots[index];
      if (!slot) return;
      gameState.slots[index] = { ...slot, pendingVictoryDialogue: false };
      await write();
      notifyStateChanged();
    },
  };
}
