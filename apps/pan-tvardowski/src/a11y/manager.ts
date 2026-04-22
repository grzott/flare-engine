/**
 * Pan-Tvardowski accessibility bridge.
 *
 * Wires `@flare-engine/a11y` into the game. Exposes a singleton A11yManager +
 * helpers that attach a Camera2D (for screen-shake motion scaling) and a
 * PostFxController (for global postfx intensity). Reduced-motion setting also
 * mirrors into `gameState.settings.reducedMotion` so the UI toggle reflects it.
 */

import { A11yManager, type A11ySettings, motionScale } from '@flare-engine/a11y';
import type { Camera2D } from '@flare-engine/render';
import type { PostFxController } from '../fx/postfx';
import { gameState } from '../state';

export interface A11yBridge {
  manager: A11yManager;
  attachCamera(cam: Camera2D): void;
  attachPostfx(pfx: PostFxController): void;
  /** Sync from gameState.settings.reducedMotion — call after settings load. */
  syncFromGameState(): void;
}

export function createA11yBridge(): A11yBridge {
  const manager = new A11yManager({
    initial: { reducedMotion: gameState.settings.reducedMotion },
  });

  // Mirror any manager change back into gameState so the settings UI stays accurate.
  manager.onChange.add((s: A11ySettings) => {
    gameState.settings.reducedMotion = s.reducedMotion;
  });

  return {
    manager,
    attachCamera(cam) {
      const apply = (): void => {
        cam.setMotionScale(motionScale(manager.settings));
      };
      apply();
      manager.onChange.add(apply);
    },
    attachPostfx(pfx) {
      const apply = (): void => {
        pfx.setMotionScale(motionScale(manager.settings));
      };
      apply();
      manager.onChange.add(apply);
    },
    syncFromGameState(): void {
      manager.setReducedMotion(gameState.settings.reducedMotion);
    },
  };
}
