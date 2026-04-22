import { type StorageAdapter, createMemoryAdapter, createMmkvAdapter } from '@flare-engine/storage';
import { gameState, notifyStateChanged } from '../state';
import {
  SAVE_VERSION,
  type SaveFile,
  type SlotData,
  createSlot,
  defaultSaveFile,
  mergeRun,
  parseSaveFile,
} from './schema';

const KEY = 'pan-tvardowski:save';

export interface SaveStore {
  load(): Promise<void>;
  persist(): Promise<void>;
  selectSlot(index: number): Promise<void>;
  createSlot(index: number): Promise<void>;
  commitRun(score: number, victory: boolean): Promise<void>;
  getSlot(index: number): SlotData | null;
  activeSlot(): number | null;
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
  }

  function snapshot(): SaveFile {
    return {
      version: SAVE_VERSION,
      settings: gameState.settings,
      slots: state.slots,
      activeSlot: state.activeSlot,
    };
  }

  async function write(): Promise<void> {
    state = snapshot();
    await a.set(KEY, JSON.stringify(state));
  }

  return {
    async load() {
      const raw = await a.get(KEY);
      apply(raw === null ? defaultSaveFile() : parseSaveFile(raw));
      notifyStateChanged();
    },
    persist: write,
    async selectSlot(index) {
      state = { ...state, activeSlot: index };
      await a.set(KEY, JSON.stringify(state));
      notifyStateChanged();
    },
    async createSlot(index) {
      const slots = state.slots.slice();
      slots[index] = createSlot(index);
      state = { ...state, slots, activeSlot: index };
      await a.set(KEY, JSON.stringify(state));
      notifyStateChanged();
    },
    async commitRun(score, victory) {
      const idx = state.activeSlot ?? 0;
      const slots = state.slots.slice();
      const current = slots[idx] ?? createSlot(idx);
      slots[idx] = mergeRun(current, score, victory);
      state = { ...state, slots, activeSlot: idx };
      await a.set(KEY, JSON.stringify(state));
      notifyStateChanged();
    },
    getSlot(index) {
      return state.slots[index] ?? null;
    },
    activeSlot() {
      return state.activeSlot;
    },
  };
}
