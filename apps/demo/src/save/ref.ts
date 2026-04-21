import type { SaveStore } from './store';

const noop = async (): Promise<void> => {};

const noopStore: SaveStore = {
  load: noop,
  persist: noop,
  setSettings: noop,
  selectSlot: noop,
  createSlot: noop,
  resetSlot: noop,
  commitRun: noop,
  clearPendingVictoryDialogue: noop,
};

let current: SaveStore = noopStore;

export function setSaveStore(s: SaveStore): void {
  current = s;
}

export function getSaveStore(): SaveStore {
  return current;
}
