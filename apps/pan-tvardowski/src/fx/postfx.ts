/**
 * Pan-Tvardowski post-processing controller for Zone 3 (Wisła).
 *
 * Wires the @flare-engine/postfx package end-to-end: a three-effect chain
 * (vignette + bloom + grayscale-flash), a Skia runtime, and a buildPass()
 * helper the scene calls each frame. The grayscale-flash fades automatically
 * so the scene only has to fire `triggerHitFlash()` on damage events.
 *
 * NOTE: The GameView `onRenderPostFx` hook exposes only a limited CanvasLike
 * surface today — raw Skia compositing is not yet bridged through. This
 * controller is wired and tested; visible pixel application awaits the
 * GameView Skia-canvas bridge (flagged in the M3 change-log entry).
 */

import {
  type CompiledPass,
  EffectChain,
  type PostFxRuntime,
  type SkiaPostFxModuleLike,
  createBloom,
  createGrayscaleFlash,
  createPostFxRuntime,
  createVignette,
} from '@flare-engine/postfx';

const FLASH_DECAY = 4.2; // intensity/sec — ~0.3s to fade from 1.0 to ~0.

export interface PostFxController {
  readonly chain: EffectChain;
  readonly runtime: PostFxRuntime;
  /** Spike grayscale-flash intensity to 1 — decays automatically. */
  triggerHitFlash(): void;
  /** Advance auto-decaying effects (grayscale-flash). */
  update(dt: number): void;
  /** Build the per-frame compiled pass list (empty if runtime is unsupported). */
  buildPass(width: number, height: number): CompiledPass[];
  /** Scale every effect's perceived strength (0 = fully neutralized). */
  setMotionScale(k: number): void;
}

export function createPanTvardowskiPostFx(skia: SkiaPostFxModuleLike | null): PostFxController {
  const chain = new EffectChain();
  chain.add(createVignette('vignette', { intensity: 0.35, radius: 0.82 }));
  chain.add(createBloom('bloom', { threshold: 0.72, intensity: 0.5 }));
  chain.add(createGrayscaleFlash('grayscale-flash', { intensity: 0 }));

  const runtime = createPostFxRuntime(skia);
  let flashIntensity = 0;

  return {
    chain,
    runtime,
    triggerHitFlash(): void {
      flashIntensity = 1;
      chain.setUniforms('grayscale-flash', {
        kind: 'grayscale-flash',
        intensity: 1,
      });
    },
    update(dt: number): void {
      if (flashIntensity <= 0) return;
      flashIntensity = Math.max(0, flashIntensity - dt * FLASH_DECAY);
      chain.setUniforms('grayscale-flash', {
        kind: 'grayscale-flash',
        intensity: flashIntensity,
      });
    },
    buildPass(width: number, height: number): CompiledPass[] {
      return runtime.buildPass(chain, width, height);
    },
    setMotionScale(k: number): void {
      chain.setGlobalIntensity(k);
    },
  };
}
