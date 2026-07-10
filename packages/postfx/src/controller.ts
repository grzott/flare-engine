/**
 * PostFxController — a reusable bridge that owns an EffectChain + PostFxRuntime
 * and adds two game-common conveniences:
 *
 *   - hit-flash: spike a grayscale-flash effect to 1 and auto-decay it.
 *   - motion scale: forward a single scalar to `EffectChain.setGlobalIntensity`
 *     so a11y reduced-motion can null the whole stack at once.
 *
 * Games can instantiate multiple controllers and swap implementations freely.
 */

import { EffectChain } from './chain.js';
import type { Effect, EffectUniforms } from './effect.js';
import type { SkiaPostFxModuleLike } from './runtime.js';
import { type CompiledPass, createPostFxRuntime, type PostFxRuntime } from './runtime.js';

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
  /**
   * Enable `effectId` immediately and auto-disable it after `decayMs` ms of
   * accumulated `update(dt)` time. Uniforms are restored to the pre-trigger
   * snapshot on expiry. Re-triggering before expiry resets the countdown.
   * No-op if `effectId` is not in the chain.
   */
  /** Optional — enable an effect for `decayMs` ms then restore its pre-trigger uniforms. No-op if id is not in the chain. */
  triggerTimed?(effectId: string, decayMs: number): void;
  /** Advance auto-decaying effects (flash + timed triggers). */
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

  // Allocated once at construction — never reallocated on the hot path.
  const timedRemaining = new Map<string, number>();
  const timedRestore = new Map<string, EffectUniforms>();

  return {
    chain,
    runtime,
    triggerHitFlash(): void {
      if (!flashCfg) return;
      flashIntensity = 1;
      chain.setUniforms(flashCfg.id, { kind: 'grayscale-flash', intensity: 1 });
    },
    triggerTimed(effectId: string, decayMs: number): void {
      const effect = chain.get(effectId);
      if (!effect) return;
      timedRestore.set(effectId, { ...effect.uniforms });
      chain.setEnabled(effectId, true);
      timedRemaining.set(effectId, decayMs);
    },
    update(dt: number): void {
      if (flashCfg && flashIntensity > 0) {
        flashIntensity = Math.max(0, flashIntensity - dt * flashDecay);
        chain.setUniforms(flashCfg.id, {
          kind: 'grayscale-flash',
          intensity: flashIntensity,
        });
      }

      if (timedRemaining.size > 0) {
        const dtMs = dt * 1000;
        // Collect expired ids first, then apply — safe under all JS engines.
        const expired: string[] = [];
        for (const [id, rem] of timedRemaining) {
          const next = rem - dtMs;
          if (next <= 0) {
            expired.push(id);
          } else {
            timedRemaining.set(id, next);
          }
        }
        if (expired.length > 0) {
          for (const id of expired) {
            const snapshot = timedRestore.get(id);
            if (snapshot !== undefined) chain.setUniforms(id, snapshot);
            chain.setEnabled(id, false);
            timedRemaining.delete(id);
            timedRestore.delete(id);
          }
        }
      }
    },
    buildPass(width: number, height: number): readonly CompiledPass[] {
      return runtime.buildPass(chain, width, height);
    },
    setMotionScale(k: number): void {
      chain.setGlobalIntensity(k);
    },
  };
}
