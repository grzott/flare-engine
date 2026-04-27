import {
  type CaptureSource,
  type NativeShareLike,
  type ScreenshotScene,
  type ScreenshotTarget,
  ShareManager,
  createNativeShareTransport,
  createScreenshotScene,
} from '@flare-engine/share';

export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/** Factory: wire a ShareManager against RN's `Share` module. */
export function createShareManager(rnShare: NativeShareLike): ShareManager {
  const manager = new ShareManager();
  manager.register(createNativeShareTransport(rnShare));
  return manager;
}

export interface ShareHighScoreParams {
  manager: ShareManager;
  score: number;
  victory: boolean;
  t: TranslateFn;
}

/** Fire a share intent with localized copy for victory / game-over. */
export function shareHighScore({
  manager,
  score,
  victory,
  t,
}: ShareHighScoreParams): Promise<unknown> {
  const messageKey = victory ? 'hud.share.victory' : 'hud.share.gameover';
  return manager.share({
    title: t('hud.share'),
    message: t(messageKey, { score }),
    url: 'https://flare-engine.dev',
  });
}

/**
 * Store-page screenshot specs (Play Store + App Store portrait phone slots).
 * Stable ids — `capture(id)` looks them up by string. The 6.5" iOS slot at
 * 1242×2688 is a Pan Tvardowski submission requirement; the 6.7" Play slot at
 * 1080×1920 covers the Android phone tier.
 */
export const PT_SCREENSHOT_TARGETS: readonly ScreenshotTarget[] = [
  { id: 'play-1080x1920', width: 1080, height: 1920, format: 'png' },
  { id: 'play-1080x2400', width: 1080, height: 2400, format: 'png' },
  { id: 'ios-1242x2688', width: 1242, height: 2688, format: 'png' },
  { id: 'ios-1290x2796', width: 1290, height: 2796, format: 'png' },
];

export interface CreatePTScreenshotSceneOptions {
  /** Live capture source — typically the GameView's Skia surface. */
  readonly source: CaptureSource;
  /** Override the default PT store-target list (e.g., dev-only single shot). */
  readonly targets?: readonly ScreenshotTarget[];
  /** Per-target staging hook — resize render target, mute HUD, etc. */
  readonly setup?: (target: ScreenshotTarget) => void | Promise<void>;
}

export function createPTScreenshotScene(options: CreatePTScreenshotSceneOptions): ScreenshotScene {
  return createScreenshotScene({
    source: options.source,
    targets: options.targets ?? PT_SCREENSHOT_TARGETS,
    setup: options.setup,
    defaults: { format: 'png', quality: 90 },
  });
}
