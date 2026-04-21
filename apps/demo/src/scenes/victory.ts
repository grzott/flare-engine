import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { resetUi } from '../hud/ui-state';
import { getSaveStore } from '../save/ref';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createVictoryScene(ctx: GameContextValue): () => Scene {
  return () => {
    let armTimer = 0;
    return {
      name: 'victory',
      ...shellDefaults(),
      onEnter() {
        armTimer = 0.5;
        gameState.currentScene = 'victory';
        gameState.menuReady = false;
        resetUi();
        notifyStateChanged();

        const store = getSaveStore();
        void store.commitRun(gameState.runStats, true);

        setMenuActions({
          onEndContinue: () => {
            void ctx.scenes.go('base');
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
