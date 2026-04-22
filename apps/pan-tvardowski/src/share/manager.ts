import {
  type NativeShareLike,
  ShareManager,
  createNativeShareTransport,
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
