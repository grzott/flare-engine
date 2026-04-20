import type { GameContextValue, Scene } from '@flare-engine/engine';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { gameState, notifyStateChanged, resetGameState } from '../state';
import { shellDefaults } from './scene-shell';

const TRIPLE_TAP_WINDOW = 0.6;

export function createMenuScene(ctx: GameContextValue): () => Scene {
  return () => {
    let armTimer = 0;
    let titleTapCount = 0;
    let titleTapTimer = 0;
    return {
      name: 'menu',
      ...shellDefaults(),
      onEnter() {
        armTimer = 0.2;
        titleTapCount = 0;
        titleTapTimer = 0;
        const w = ctx.camera.viewportWidth || 360;
        const h = ctx.camera.viewportHeight || 640;
        ctx.camera.x = w / 2;
        ctx.camera.y = h / 2;
        ctx.camera.zoom = 1;
        ctx.camera.rotation = 0;
        resetGameState();
        gameState.currentScene = 'menu';
        notifyStateChanged();
        setMenuActions({
          onStart: () => {
            void ctx.scenes.go('play');
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
