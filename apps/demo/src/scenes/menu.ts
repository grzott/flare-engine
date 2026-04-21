import type { GameContextValue, Scene } from '@flare-engine/engine';
import { TRIPLE_TAP_WINDOW } from '../config/gameplay';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import {
  closeSettings,
  closeSlotPicker,
  openSettings,
  openSlotPicker,
  resetUi,
} from '../hud/ui-state';
import { getSaveStore } from '../save/ref';
import { createArmedScene } from '../scene-helpers';
import { gameState, notifyStateChanged } from '../state';

export function createMenuScene(ctx: GameContextValue): () => Scene {
  let titleTapCount = 0;
  let titleTapTimer = 0;
  return createArmedScene({
    name: 'menu',
    onEnter() {
      titleTapCount = 0;
      titleTapTimer = 0;
      const w = ctx.camera.viewportWidth || 360;
      const h = ctx.camera.viewportHeight || 640;
      ctx.camera.x = w / 2;
      ctx.camera.y = h / 2;
      ctx.camera.zoom = 1;
      ctx.camera.rotation = 0;
      gameState.currentScene = 'menu';
      gameState.paused = false;
      resetUi();
      notifyStateChanged();

      const store = getSaveStore();
      setMenuActions({
        onNewGame: () => openSlotPicker(),
        onContinue: () => {
          const idx = gameState.lastSlotIndex;
          if (idx === null) return;
          void store.selectSlot(idx).then(() => {
            void ctx.scenes.go('base');
          });
        },
        onOpenSettings: () => openSettings(),
        onCloseSettings: () => closeSettings(),
        onPickSlot: (i) => {
          const existing = gameState.slots[i];
          const p = existing ? store.selectSlot(i) : store.createSlot(i);
          void p.then(() => {
            closeSlotPicker();
            void ctx.scenes.go('base');
          });
        },
        onResetSlot: (i) => {
          void store.resetSlot(i);
        },
        onTitleTap: () => {
          if (titleTapTimer <= 0) titleTapCount = 0;
          titleTapCount++;
          titleTapTimer = TRIPLE_TAP_WINDOW;
          if (titleTapCount >= 3) {
            titleTapCount = 0;
            void ctx.scenes.go('bench');
          }
        },
      });
    },
    onUpdate(dt: number) {
      if (titleTapTimer > 0) {
        titleTapTimer -= dt;
        if (titleTapTimer <= 0) titleTapCount = 0;
      }
    },
    onExit() {
      clearMenuActions();
      resetUi();
    },
  });
}
