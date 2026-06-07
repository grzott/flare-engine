import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import type { ZoneId } from '../events';
import type { SaveStore } from '../save/store';

export interface MenuOverlayActions {
  goMenu(): void;
  goPlay(): void;
  goSaveSelect(): void;
  goSettings(): void;
  goCredits(): void;
  goInventory(): void;
  goCodex(): void;
  goAchievements(): void;
  goShop(): void;
  startSlot(index: 0 | 1 | 2): void;
  startSlotAtZone(index: 0 | 1 | 2, zoneId: ZoneId): void;
  persistSettings(): void;
}

export interface MenuOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  actions: MenuOverlayActions;
  appVersion: string;
  onLocaleChange(locale: 'en' | 'pl'): void;
  onVolumesChange(volumes: { master: number; music: number; sfx: number }): void;
  entitlementStore?: EntitlementStore;
}
