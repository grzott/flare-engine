import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { closeBaseTile, closeSettings, openBaseTile, openSettings, resetUi } from '../hud/ui-state';
import { createArmedScene } from '../scene-helpers';
import { gameState, notifyStateChanged } from '../state';

export function createBaseScene(ctx: GameContextValue): () => Scene {
  return createArmedScene({
    name: 'base',
    onEnter() {
      gameState.currentScene = 'base';
      gameState.paused = false;
      resetUi();
      notifyStateChanged();
      setMenuActions({
        onLaunchRun: () => {
          const slot = gameState.activeSlot;
          if (slot === null) {
            void ctx.scenes.go('menu');
            return;
          }
          const meta = gameState.slots[slot];
          const needsDialogue = !!meta && (!meta.firstRunSeen || meta.pendingVictoryDialogue);
          void ctx.scenes.go(needsDialogue ? 'dialogue' : 'play');
        },
        onBaseBack: () => {
          void ctx.scenes.go('menu');
        },
        onOpenBaseTile: (tile) => openBaseTile(tile),
        onCloseBaseTile: () => closeBaseTile(),
        onOpenSettings: () => openSettings(),
        onCloseSettings: () => closeSettings(),
      });
    },
    onExit() {
      clearMenuActions();
      resetUi();
    },
  });
}
