import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

/**
 * Inventory scene — lore codex, shard counter, run stats, achievement list.
 * Pure state transition; the React overlay (`<InventoryOverlay>` in `App.tsx`)
 * renders on top of the paused canvas and dispatches back to `menu` via
 * `goInventory` callbacks.
 */
export function createInventoryScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'inventory',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'inventory';
      notifyStateChanged();
    },
  });
}
