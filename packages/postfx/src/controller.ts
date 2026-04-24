/**
 * PostFxController — a small bridge that owns an EffectChain + PostFxRuntime
 * and adds two game-common conveniences:
 *
 *   - hit-flash: spike a grayscale-flash effect to 1 and auto-decay it.
 *   - motion scale: forward a single scalar to `EffectChain.setGlobalIntensity`
 *     so a11y reduced-motion can null the whole stack at once.
 *
 * Extracted from Pan Tvardowski per Phase 11.14. Shape-compatible with the
 * PT `createPanTvardowskiPostFx` controller — games can swap implementations.
 */

import { EffectChain } from './chain.js';
import type { Effect } from './effect.js';
import { type CompiledPass, type PostFxRuntime, createPostFxRuntime } from './runtime.js';
import type { SkiaPostFxModuleLike } from './runtime.js';

export interface PostFxFlashConfig {
  /** Id of a `grayscale-flash` effect already added to the chain. */
  readonly id: string;
  /** Decay rate in intensity units per second. Defaults to 4.2 (≈0.24 s to fade from 1). */
  readonly decay?: number;
}

export interface PostFxControllerOptions {
  /** Effects appended to the internal chain in the given order. */
  readonly effects: readonly Effect[];
  /** Skia module — `null` / `undefined` keeps `buildPass` returning `[]`. */
  readonly skia?: SkiaPostFxModuleLike | null;
  /** Optional hit-flash binding. */
  readonly flash?: PostFxFlashConfig;
}

export interface PostFxController {
  readonly chain: EffectChain;
  readonly runtime: PostFxRuntime;
  /** Spike the configured flash effect to 1. No-op if no flash configured. */
  triggerHitFlash(): void;
  /** Advance auto-decaying effects (currently: the flash). */
  update(dt: number): void;
  /** Build the per-frame compiled pass list. Empty if runtime is unsupported. */
  buildPass(width: number, height: number): readonly CompiledPass[];
  /**
   * Global intensity multiplier forwarded to the chain — intended for a11y
   * reduced-motion (0 = fully neutralized, 1 = default).
   */
  setMotionScale(k: number): void;
}

const DEFAULT_FLASH_DECAY = 4.2;

export function createPostFxController(options: PostFxControllerOptions): PostFxController {
  const chain = new EffectChain();
  for (let i = 0; i < options.effects.length; i++) {
    const e = options.effects[i];
    if (e) chain.add(e);
  }

  const runtime = createPostFxRuntime(options.skia ?? null);
  const flashCfg = options.flash;
  const flashDecay = flashCfg?.decay ?? DEFAULT_FLASH_DECAY;
  let flashIntensity = 0;

  return {
    chain,
    runtime,
    triggerHitFlash(): void {
      if (!flashCfg) return;
      flashIntensity = 1;
      chain.setUniforms(flashCfg.id, { kind: 'grayscale-flash', intensity: 1 });
    },
    update(dt: number): void {
      if (!flashCfg || flashIntensity <= 0) return;
      flashIntensity = Math.max(0, flashIntensity - dt * flashDecay);
      chain.setUniforms(flashCfg.id, {
        kind: 'grayscale-flash',
        intensity: flashIntensity,
      });
    },
    buildPass(width: number, height: number): readonly CompiledPass[] {
      return runtime.buildPass(chain, width, height);
    },
    setMotionScale(k: number): void {
      chain.setGlobalIntensity(k);
    },
  };
}
