import type { BaseTile } from './ui-state';

/** Title string for a base-hub tile modal. */
export function tileTitle(tile: BaseTile | null): string {
  switch (tile) {
    case 'shop':
      return 'SHOP';
    case 'inventory':
      return 'INVENTORY';
    case 'ships':
      return 'SHIPS';
    case 'leaderboard':
      return 'SCORES';
    default:
      return '';
  }
}

/**
 * Persist a partial settings patch. Uses a lazy `require` to avoid pulling
 * save-store modules into the HUD's module-init graph (circular ref guard).
 */
export function settingsPatch(patch: {
  sfxVolume?: number;
  musicVolume?: number;
  screenShake?: boolean;
}): void {
  const m = require('../save/ref') as typeof import('../save/ref');
  void m.getSaveStore().setSettings(patch);
}

/** Lazy-imported wrapper around `ui-state.requestResetSlot`. */
export function requestReset(i: number | null): void {
  const m = require('./ui-state') as typeof import('./ui-state');
  m.requestResetSlot(i);
}
