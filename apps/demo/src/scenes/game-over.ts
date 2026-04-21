import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { resetUi } from '../hud/ui-state';
import { getSaveStore } from '../save/ref';
import { createArmedScene } from '../scene-helpers';
import { gameState, notifyStateChanged } from '../state';

export function createGameOverScene(ctx: GameContextValue): () => Scene {
  return createArmedScene({
    name: 'game-over',
    armDuration: 0.5,
    onEnter() {
      gameState.currentScene = 'game-over';
      resetUi();
      notifyStateChanged();
      void getSaveStore().commitRun(gameState.runStats, false);
      setMenuActions({
        onEndContinue: () => {
          void ctx.scenes.go('base');
        },
        onEndRetry: () => {
          void ctx.scenes.go('play');
        },
      });
    },
    onExit() {
      clearMenuActions();
    },
  });
}
