import type { GameContextValue, Scene } from '@flare-engine/engine';
import type { ScreenshotResult, ScreenshotScene } from '@flare-engine/share';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export interface CaptureSceneOptions {
  /** Pre-built screenshot scene — usually `createPTScreenshotScene({ source })`. */
  readonly screenshots: ScreenshotScene;
  /** Receives the captured frames in order. Failed targets are skipped. */
  readonly onComplete?: (results: readonly ScreenshotResult[]) => void;
  /** Receives any error thrown by the capture pipeline. */
  readonly onError?: (err: unknown) => void;
}

/**
 * Capture scene — when entered, runs `screenshots.captureAll()` and forwards
 * the result to `onComplete`. Pure orchestration: no rendering of its own.
 * Used for batch store-page screenshot capture during M9.6 release prep.
 */
export function createCaptureScene(
  _ctx: GameContextValue,
  options: CaptureSceneOptions,
): () => Scene {
  return () => ({
    name: 'capture',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'capture';
      notifyStateChanged();
      void runCaptures(options);
    },
  });
}

async function runCaptures(options: CaptureSceneOptions): Promise<void> {
  try {
    const results = await options.screenshots.captureAll();
    options.onComplete?.(results);
  } catch (err) {
    options.onError?.(err);
  }
}
