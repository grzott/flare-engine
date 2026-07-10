/**
 * ScreenshotScene — controller for batch-capturing store-page screenshots
 * (Play, App Store, Steam) at fixed dimensions.
 *
 * The caller supplies a `CaptureSource` (typically the Skia surface driven
 * by the game's render loop) and a list of `ScreenshotTarget`s. An optional
 * `setup` hook runs before each capture — games use it to stage the camera,
 * mute HUD, pause the sim, etc.
 *
 * Pure orchestration: the pixel push is owned by the engine renderer; this
 * module only decides when and at what size to call `makeImageSnapshot`.
 */

import {
  type CaptureOptions,
  type CaptureSource,
  captureScreenshot,
  type ImageFormat,
  type Screenshot,
} from './capture.js';

export interface ScreenshotTarget {
  /** Stable id — used as the lookup key in `capture(id)`. */
  readonly id: string;
  /** Target width in pixels (store-spec). */
  readonly width: number;
  /** Target height in pixels (store-spec). */
  readonly height: number;
  /** Output format override. Defaults to the scene-level default. */
  readonly format?: ImageFormat;
  /** JPEG quality override. Defaults to the scene-level default. */
  readonly quality?: number;
}

export interface ScreenshotResult {
  readonly target: ScreenshotTarget;
  readonly screenshot: Screenshot;
}

export interface ScreenshotSceneOptions {
  /** Source of the current frame — exposes `makeImageSnapshot`. */
  readonly source: CaptureSource;
  /** Store-screenshot specs to capture. */
  readonly targets: readonly ScreenshotTarget[];
  /**
   * Called once before each capture. Typical uses: resize the render target,
   * position the camera, toggle HUD. May be async so callers can wait for a
   * next-frame settle (`await new Promise(queueMicrotask)`).
   */
  readonly setup?: (target: ScreenshotTarget) => void | Promise<void>;
  /** Default capture options — per-target values override. */
  readonly defaults?: CaptureOptions;
}

export interface ScreenshotScene {
  readonly targets: readonly ScreenshotTarget[];
  /** Capture one target by id. Returns `null` if the id is unknown or capture failed. */
  capture(id: string): Promise<ScreenshotResult | null>;
  /** Capture every configured target in order. Skips failed captures. */
  captureAll(): Promise<readonly ScreenshotResult[]>;
}

export function createScreenshotScene(options: ScreenshotSceneOptions): ScreenshotScene {
  const { source, targets, setup, defaults } = options;

  async function captureOne(target: ScreenshotTarget): Promise<ScreenshotResult | null> {
    if (setup) await setup(target);
    const shot = captureScreenshot(source, {
      format: target.format ?? defaults?.format,
      quality: target.quality ?? defaults?.quality,
    });
    if (!shot) return null;
    return { target, screenshot: shot };
  }

  return {
    targets,
    async capture(id) {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t && t.id === id) return captureOne(t);
      }
      return null;
    },
    async captureAll() {
      const results: ScreenshotResult[] = [];
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t) continue;
        const r = await captureOne(t);
        if (r) results.push(r);
      }
      return results;
    },
  };
}
