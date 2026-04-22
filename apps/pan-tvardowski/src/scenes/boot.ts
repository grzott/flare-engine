import type { GameContextValue, Scene } from '@flare-engine/engine';
import { shellDefaults } from './scene-shell';

/**
 * Boot scene — loads the save file then jumps to play. No menu in M1.
 */
export function createBootScene(ctx: GameContextValue, loadSave: () => Promise<void>): () => Scene {
  return () => ({
    name: 'boot',
    ...shellDefaults(),
    onEnter() {
      void loadSave().finally(() => {
        void ctx.scenes.go('play');
      });
    },
  });
}
