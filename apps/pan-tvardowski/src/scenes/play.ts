import type { A11yBridge } from '@flare-engine/a11y';
import type { GameContextValue, Scene } from '@flare-engine/engine';
import type { EntitlementStore } from '@flare-engine/iap';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';
import type { PostFxRenderHook } from '@flare-engine/react';
import type { BgImageHandle, KenneyAtlasHandle } from '../assets/sprites-loader';
import type { AudioHandles } from '../audio/init';
import type { DialogueController } from '../dialogue';
import type { ZoneId } from '../events';
import { resetFpsRing } from '../fx/budget';
import type { EntitlementFallbackHandler } from '../iap/fallback';
import type { SaveStore } from '../save/store';
import type { AtlasHandle } from '../spawn';
import { gameState } from '../state';
import { clearBossFsms } from '../systems/boss';
import { clearMinibossFsms } from '../systems/miniboss';
import { clearBench, initBenchmark } from './play/benchmark';
import type { BenchRef } from './play/benchmark';
import { createPostFxCoordinator } from './play/postfx-coordinator';
import { clearWorld, startZone } from './play/setup';
import { initState } from './play/state';
import type { PlayState } from './play/types';
import { playOnUpdate } from './play/update';
import { shellDefaults } from './scene-shell';

export { bulletPulseAlpha } from '../fx/bullet-pulse';

export interface AudioRef {
  current: AudioHandles | null;
}

export interface PlayRenderHooks {
  background: ((ctx: GameContextValue, canvas: unknown) => void) | null;
  postfx: PostFxRenderHook | null;
}

export interface PlaySceneDeps {
  ctx: GameContextValue;
  atlas: AtlasHandle;
  save: SaveStore;
  audio?: AudioRef;
  /** Seed for the wave schedule. Tests override; runtime uses Date.now(). */
  seed?: number;
  /** Skia module for postfx. Tests may pass null (runtime → unsupported passthrough). */
  skia?: SkiaPostFxModuleLike | null;
  /** Mutable ref the scene populates so <GameView>'s hooks can dispatch to it. */
  renderHooks?: PlayRenderHooks;
  /** Optional a11y bridge — attaches camera + postfx so reduced-motion scales
   *  screen-shake and postfx intensity globally. */
  a11y?: A11yBridge;
  /** Dialogue controller — pauses gameplay while a graph is running. */
  dialogue?: DialogueController;
  /** Entitlement store — guards zone transitions for premium zones. */
  entitlementStore?: EntitlementStore;
  /** Fallback handler — allows stale-access when entitlement check fails. */
  entitlementFallback?: EntitlementFallbackHandler;
  /** Returns the current safe-area bottom inset in logical pixels. Called on
   *  every refreshBounds so orientation changes are reflected automatically.
   *  Subtracted from the play-area height used for player clamp, spawn position,
   *  and entity cull. The canvas stays full-bleed — only gameplay logic is
   *  reduced. Defaults to () => 0 when absent. */
  getBottomInset?: () => number;
  /** Kenney zone-1 atlas handle — null when PNG not yet loaded (KG2). KG3 uses
   *  this for frame lookup with shape-atlas fallback. */
  kenney?: KenneyAtlasHandle | null;
  /** Kenney background image handle — null when PNG not yet loaded (KG2).
   *  KG6 uses this to render the zone-1 image background. */
  bg?: BgImageHandle | null;
}

export function createPlayScene(deps: PlaySceneDeps): () => Scene {
  const { ctx, atlas } = deps;
  const getBottomInset = deps.getBottomInset ?? (() => 0);
  const audioRef = deps.audio;
  const postfx = createPostFxCoordinator(deps.skia ?? null, ctx, deps.a11y);

  return () => {
    const sBox: { s: PlayState | null } = { s: null };
    const benchRef: BenchRef = { scenario: null, elapsed: 0, recorder: null };

    function startZoneLocal(zoneId: ZoneId, fullReset: boolean): void {
      startZone(zoneId, fullReset, sBox, ctx, atlas, deps, audioRef, getBottomInset, postfx);
    }

    if (deps.renderHooks) {
      // Background: tile entities live in the ECS world so the sprite system
      // draws them naturally — no raw canvas work needed here.
      deps.renderHooks.background = null;
      deps.renderHooks.postfx = (_ctx, _canvas, bridge) => {
        if (!sBox.s) return;
        bridge?.setPostFxBinding(postfx.runtime, postfx.chain);
      };
    }

    return {
      name: 'play',
      ...shellDefaults(),

      onInit() {
        sBox.s = initState(gameState.currentZone, ctx, atlas, deps, audioRef);
      },

      onEnter() {
        resetFpsRing();
        startZoneLocal(gameState.currentZone, true);

        // Bench mode: if activated by deep-link, wire a scenario against the
        // live play.ts state so the full render pipeline (Sprite + atlas frame)
        // is exercised. spawnBoss is forwarded so boss scenarios get a real
        // entity with collision body + Sprite — not the headless stub.
        clearBench(benchRef);
        if (sBox.s) {
          const newBench = initBenchmark(sBox.s, ctx, atlas);
          benchRef.scenario = newBench.scenario;
          benchRef.elapsed = newBench.elapsed;
          benchRef.recorder = newBench.recorder;
        }
      },

      onUpdate(dt: number) {
        const s = sBox.s;
        if (!s || s.disposed) return;
        playOnUpdate(s, benchRef, ctx, atlas, deps, audioRef, getBottomInset, postfx, sBox, dt);
      },

      onExit() {
        const s = sBox.s;
        if (!s) return;
        s.disposed = true;
        ctx.loop.clock.timescale = 1;
        clearBench(benchRef);
        clearWorld(s, ctx);
        clearBossFsms();
        clearMinibossFsms();
        gameState.bossShieldActive = false;
        if (deps.renderHooks) {
          deps.renderHooks.background = null;
          deps.renderHooks.postfx = null;
        }
        const a = audioRef?.current;
        if (a) {
          a.pool.stopAll();
          a.music.stop();
        }
      },
    };
  };
}
