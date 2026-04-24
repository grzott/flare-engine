import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createSettingsScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'settings',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'settings';
      notifyStateChanged();
    },
  });
}
