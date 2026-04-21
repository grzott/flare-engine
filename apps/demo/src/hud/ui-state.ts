import { Signal } from '@flare-engine/events';

export type BaseTile = 'shop' | 'inventory' | 'ships' | 'leaderboard';

export interface UiState {
  settingsOpen: boolean;
  pauseOpen: boolean;
  baseTile: BaseTile | null;
  slotPickerOpen: boolean;
  /** Transient toast for slot-reset confirm (two-step: first tap asks, second confirms). */
  pendingResetSlot: number | null;
}

export const uiState: UiState = {
  settingsOpen: false,
  pauseOpen: false,
  baseTile: null,
  slotPickerOpen: false,
  pendingResetSlot: null,
};

export const uiChanged = new Signal<void>();

export function openSettings(): void {
  uiState.settingsOpen = true;
  uiChanged.emit();
}
export function closeSettings(): void {
  uiState.settingsOpen = false;
  uiChanged.emit();
}
export function openPause(): void {
  uiState.pauseOpen = true;
  uiChanged.emit();
}
export function closePause(): void {
  uiState.pauseOpen = false;
  uiChanged.emit();
}
export function openBaseTile(tile: BaseTile): void {
  uiState.baseTile = tile;
  uiChanged.emit();
}
export function closeBaseTile(): void {
  uiState.baseTile = null;
  uiChanged.emit();
}
export function requestResetSlot(index: number | null): void {
  uiState.pendingResetSlot = index;
  uiChanged.emit();
}
export function openSlotPicker(): void {
  uiState.slotPickerOpen = true;
  uiState.pendingResetSlot = null;
  uiChanged.emit();
}
export function closeSlotPicker(): void {
  uiState.slotPickerOpen = false;
  uiState.pendingResetSlot = null;
  uiChanged.emit();
}
export function resetUi(): void {
  uiState.settingsOpen = false;
  uiState.pauseOpen = false;
  uiState.baseTile = null;
  uiState.slotPickerOpen = false;
  uiState.pendingResetSlot = null;
  uiChanged.emit();
}
