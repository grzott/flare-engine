import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createCreditsScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'credits',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'credits';
      notifyStateChanged();
    },
  });
}
