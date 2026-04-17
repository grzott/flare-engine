import type { GameContextValue, Scene } from '@flare/engine';
import { shellDefaults } from './scene-shell';

export function createBootScene(ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'boot',
    ...shellDefaults(),
    onEnter() {
      void ctx.scenes.go('menu');
    },
  });
}
