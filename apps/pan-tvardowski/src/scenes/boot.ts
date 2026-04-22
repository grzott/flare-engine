import type { GameContextValue, Scene } from '@flare-engine/engine';
import type { AudioHandles } from '../audio/init';
import { shellDefaults } from './scene-shell';

export interface AudioInitResult {
  current: AudioHandles | null;
}

/**
 * Boot scene — loads the save file, initializes audio, then jumps to play.
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
      void (async () => {
        await loadSave();
        if (initAudio && audioRef) {
          audioRef.current = await initAudio();
        }
        void ctx.scenes.go('play');
      })();
    },
  });
}
