import type { GameContextValue, Scene } from '@flare/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createGameOverScene(ctx: GameContextValue): () => Scene {
  return () => {
    let tapArmed = false;
    let armTimer = 0;
    return {
      name: 'game-over',
      ...shellDefaults(),
      onEnter() {
        tapArmed = false;
        armTimer = 0.5;
        gameState.currentScene = 'game-over';
        notifyStateChanged();
      },
      onUpdate(dt: number) {
        if (!tapArmed) {
          armTimer -= dt;
          if (armTimer <= 0) tapArmed = true;
          return;
        }
        if (ctx.input.pointer.justPressed) {
          tapArmed = false;
          void ctx.scenes.go('menu');
        }
      },
    };
  };
}
