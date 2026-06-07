import type { A11yBridge } from '@flare-engine/a11y';
import type { GameContextValue } from '@flare-engine/engine';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';
import type { BossPostFxKind } from '../../fx/boss-postfx';
import { type PanPostFxController, createPanTvardowskiPostFx } from '../../fx/postfx';

export function createPostFxCoordinator(
  skia: SkiaPostFxModuleLike | null,
  ctx: GameContextValue,
  a11y: A11yBridge | undefined,
): PanPostFxController {
  const postfx: PanPostFxController = createPanTvardowskiPostFx(skia);
  if (a11y) {
    a11y.attachCamera(ctx.camera);
    a11y.attachPostfx(postfx);
  }
  return postfx;
}

export function applyBossPostFxChain(postfx: PanPostFxController, kind: BossPostFxKind): void {
  if (kind === 'bloom+chrom') {
    postfx.triggerChromaticAb(200);
  } else if (kind === 'bloom+flash') {
    postfx.triggerHitFlash();
  } else if (kind === 'bloom+chrom+flash') {
    postfx.triggerChromaticAb(200);
    postfx.triggerHitFlash();
  } else if (kind === 'bloom+flash+CRT') {
    postfx.triggerHitFlash();
    postfx.setCrtEnabled(true);
  }
}
