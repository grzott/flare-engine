import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createGameOverScene(ctx: GameContextValue): () => Scene {
  return () => {
    let armTimer = 0;
    return {
      name: 'game-over',
      ...shellDefaults(),
      onEnter() {
        armTimer = 0.5;
        gameState.currentScene = 'game-over';
        gameState.menuReady = false;
        notifyStateChanged();
        setMenuActions({
          onContinue: () => {
            void ctx.scenes.go('menu');
          },
        });
      },
      onUpdate(dt: number) {
        if (armTimer > 0) {
          armTimer -= dt;
          if (armTimer <= 0) {
            gameState.menuReady = true;
            notifyStateChanged();
          }
        }
      },
      onExit() {
        clearMenuActions();
        gameState.menuReady = false;
      },
    };
  };
}
