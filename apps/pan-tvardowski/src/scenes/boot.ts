import type { GameContextValue, Scene } from '@flare-engine/engine';
import type { AudioHandles } from '../audio/init';
import { markBootMilestone } from '../perf/cold-start';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export interface AudioInitResult {
  current: AudioHandles | null;
}

/**
 * Boot scene — loads the save file, initializes audio, then jumps to the
 * main menu. Deep-links (`pantvardowski://zone/N`) handled by the router
 * in `App.tsx` still bypass the menu and go straight to `play`.
 */
export function createBootScene(
  ctx: GameContextValue,
  loadSave: () => Promise<void>,
  initAudio?: () => Promise<AudioHandles | null>,
  audioRef?: AudioInitResult,
): () => Scene {
  return () => ({
    name: 'boot',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'boot';
      notifyStateChanged();
      void (async () => {
        await loadSave();
        markBootMilestone('save-loaded');
        gameState.bootProgress = { value: 0.5, labelKey: 'boot.loading.save' };
        notifyStateChanged();
        if (initAudio && audioRef) {
          audioRef.current = await initAudio();
          markBootMilestone('audio-ready');
        }
        gameState.bootProgress = { value: 1, labelKey: 'boot.loading.audio' };
        notifyStateChanged();
        void ctx.scenes.go('menu');
      })();
    },
  });
}
