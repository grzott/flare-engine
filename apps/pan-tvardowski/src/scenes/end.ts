import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createGameOverScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'game-over',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'game-over';
      notifyStateChanged();
    },
  });
}

export function createVictoryScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'victory',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'victory';
      notifyStateChanged();
    },
  });
}
