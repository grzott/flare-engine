import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged, resetGameState } from '../state';
import { shellDefaults } from './scene-shell';

const TRIPLE_TAP_WINDOW = 0.6;
const TITLE_HIT_TOP = 0;
const TITLE_HIT_HEIGHT = 200;

export function createMenuScene(ctx: GameContextValue): () => Scene {
  return () => {
    let tapArmed = false;
    let armTimer = 0;
    let titleTapCount = 0;
    let titleTapTimer = 0;
    return {
      name: 'menu',
      ...shellDefaults(),
      onEnter() {
        tapArmed = false;
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
      },
      onUpdate(dt: number) {
        if (titleTapTimer > 0) {
          titleTapTimer -= dt;
          if (titleTapTimer <= 0) titleTapCount = 0;
        }
        if (!tapArmed) {
          armTimer -= dt;
          if (armTimer <= 0) tapArmed = true;
          return;
        }
        if (ctx.input.pointer.justPressed) {
          const py = ctx.input.pointer.position.y;
          const inTitle = py >= TITLE_HIT_TOP && py <= TITLE_HIT_TOP + TITLE_HIT_HEIGHT;
          if (inTitle) {
            titleTapCount++;
            titleTapTimer = TRIPLE_TAP_WINDOW;
            if (titleTapCount >= 3) {
              titleTapCount = 0;
              tapArmed = false;
              void ctx.scenes.go('bench');
              return;
            }
            return;
          }
          tapArmed = false;
          void ctx.scenes.go('play');
        }
      },
    };
  };
}
