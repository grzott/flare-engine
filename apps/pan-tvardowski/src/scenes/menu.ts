import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

/**
 * Menu scene — title screen. Pure state transition; the React overlay
 * (`<MenuOverlay>` in `App.tsx`) renders on top of the paused canvas and
 * dispatches navigation back into the SceneManager via callbacks.
 */
export function createMenuScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'menu',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'menu';
      notifyStateChanged();
    },
  });
}
