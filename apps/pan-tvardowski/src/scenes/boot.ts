import type { GameContextValue, Scene } from '@flare-engine/engine';
import type { AudioHandles } from '../audio/init';
import { dumpBootTrace, markBootMilestone } from '../perf/cold-start';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export interface AudioInitResult {
  current: AudioHandles | null;
}

/**
 * Boot scene — loads the save file, initializes audio, then jumps to the
 * main menu. Deep-links (`pantvardowski://zone/N`, `pantvardowski://bench/<id>`)
 * handled by the router in `App.tsx` may take over mid-boot by calling
 * `scenes.go('play')`; the final `go('menu')` below must respect that and
 * only fire if no other scene has claimed the stack.
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
          let audioResult: AudioHandles | null = null;
          try {
            audioResult = await Promise.race([
              initAudio(),
              new Promise<null>((res) => setTimeout(() => res(null), 10000)),
            ]);
          } catch (err) {
            console.warn('[boot] initAudio failed, continuing without audio', err);
            audioResult = null;
          }
          audioRef.current = audioResult;
          markBootMilestone('audio-ready');
        }
        dumpBootTrace();
        gameState.bootProgress = { value: 1, labelKey: 'boot.loading.audio' };
        notifyStateChanged();
        // Guard against deep-link race: if a `pantvardowski://zone/N` or
        // `pantvardowski://bench/<id>` link arrived during the async chain
        // above, App.tsx already called scenes.go('play') and currentScene
        // is no longer 'boot'. Clobbering with go('menu') here would tear
        // down the play scene the deep-link just activated.
        if (gameState.currentScene === 'boot') {
          void ctx.scenes.go('menu');
        }
      })();
    },
  });
}
