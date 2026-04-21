import type { Scene } from '@flare-engine/engine';
import { SCENE_ARM_DURATION } from './config/gameplay';
import { shellDefaults } from './scenes/scene-shell';
import { gameState, notifyStateChanged } from './state';

export interface ArmedSceneOptions {
  name: Scene['name'];
  /** Invoked on scene entry after shell setup. */
  onEnter?: () => void;
  onUpdate?: (dt: number) => void;
  onExit?: () => void;
  onDestroy?: () => void;
  /** Override the arm duration (seconds) if a scene needs a different input lockout. */
  armDuration?: number;
}

/**
 * Build a Scene that defers `gameState.menuReady = true` (and the matching
 * notification) until `armDuration` seconds have elapsed after entry. Prevents
 * trailing touches from the previous scene from immediately triggering menu
 * actions.
 *
 * Replaces per-scene `armTimer` bookkeeping that was duplicated across
 * menu / base / victory / game-over / dialogue scenes.
 */
export function createArmedScene(options: ArmedSceneOptions): () => Scene {
  const armDuration = options.armDuration ?? SCENE_ARM_DURATION;
  return () => {
    let armTimer = 0;
    return {
      name: options.name,
      ...shellDefaults(),
      onEnter() {
        armTimer = armDuration;
        gameState.menuReady = false;
        options.onEnter?.();
      },
      onUpdate(dt: number) {
        if (armTimer > 0) {
          armTimer -= dt;
          if (armTimer <= 0) {
            gameState.menuReady = true;
            notifyStateChanged();
          }
        }
        options.onUpdate?.(dt);
      },
      onExit() {
        gameState.menuReady = false;
        options.onExit?.();
      },
      onDestroy() {
        options.onDestroy?.();
      },
    };
  };
}
