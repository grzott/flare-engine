import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

/**
 * Shop scene — IAP purchase flow for the Full Game unlock and optional
 * cosmetic / currency packs. Pure state transition; the React overlay
 * (`<ShopOverlay>` in `App.tsx`) renders on top of the paused canvas.
 */
export function createShopScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'shop',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'shop';
      notifyStateChanged();
    },
  });
}
