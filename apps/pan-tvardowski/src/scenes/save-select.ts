import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createSaveSelectScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'save-select',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'save-select';
      notifyStateChanged();
    },
  });
}
