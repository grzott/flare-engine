import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { resetUi } from '../hud/ui-state';
import { getSaveStore } from '../save/ref';
import { createArmedScene } from '../scene-helpers';
import { gameState, notifyStateChanged } from '../state';

export function createVictoryScene(ctx: GameContextValue): () => Scene {
  return createArmedScene({
    name: 'victory',
    armDuration: 0.5,
    onEnter() {
      gameState.currentScene = 'victory';
      resetUi();
      notifyStateChanged();
      void getSaveStore().commitRun(gameState.runStats, true);
      setMenuActions({
        onEndContinue: () => {
          void ctx.scenes.go('base');
        },
      });
    },
    onExit() {
      clearMenuActions();
    },
  });
}
