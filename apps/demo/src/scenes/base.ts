import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { closeBaseTile, closeSettings, openBaseTile, openSettings, resetUi } from '../hud/ui-state';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export function createBaseScene(ctx: GameContextValue): () => Scene {
  return () => {
    let armTimer = 0;
    return {
      name: 'base',
      ...shellDefaults(),
      onEnter() {
        armTimer = 0.2;
        gameState.currentScene = 'base';
        gameState.menuReady = false;
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
        resetUi();
        gameState.menuReady = false;
      },
    };
  };
}
