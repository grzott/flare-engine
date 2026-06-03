import { createA11yBridge } from '@flare-engine/a11y';
import type { GameContextValue } from '@flare-engine/engine';
import { fadeTransition } from '@flare-engine/engine';
import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { easeOutCubic } from '@flare-engine/math';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';
import { Skia } from '@shopify/react-native-skia';
import { SPRITES_MANIFEST, loadGameAtlases, loadSpriteAtlas } from './assets';
import type { ImageResolver } from './assets';
import type { AudioHandles } from './audio/init';
import { initAudio } from './audio/init';
import type { createDialogueController } from './dialogue';
import { createEntitlementFallback } from './iap/fallback';
import type { AudioRef } from './providers';
import type { createSaveStore } from './save/store';
export { SCENE_KEYS } from './scene-keys';
import { createAchievementsScene } from './scenes/achievements';
import { createBootScene } from './scenes/boot';
import { createCodexShardsScene } from './scenes/codex-shards';
import { createCreditsScene } from './scenes/credits';
import { createGameOverScene, createVictoryScene } from './scenes/end';
import { createInventoryScene } from './scenes/inventory';
import { createMenuScene } from './scenes/menu';
import type { PlayRenderHooks } from './scenes/play';
import { createPlayScene } from './scenes/play';
import { createSaveSelectScene } from './scenes/save-select';
import { createSettingsScene } from './scenes/settings';
import { createShopScene } from './scenes/shop';
import { gameState } from './state';

export interface SceneRegistryDeps {
  localization: LocalizationManager;
  renderHooks: PlayRenderHooks;
  audioRef: AudioRef;
  dialogue: ReturnType<typeof createDialogueController>;
  saveStore: ReturnType<typeof createSaveStore>;
  entitlementStore: EntitlementStore;
  /** Returns the current safe-area bottom inset in logical pixels. Forwarded
   *  into createPlayScene so orientation changes are reflected per-frame. */
  getBottomInset?: () => number;
  /**
   * Image resolver for texture-packer and image manifest entries (KG2).
   * Device path: wires useImage results keyed by entry.key.
   * Absent (or omitted): falls back to null for all kenney/bg handles so the
   * shape atlas is used as sole fallback.
   */
  getImage?: ImageResolver;
}

export function applyVolumes(audio: AudioHandles | null): void {
  if (!audio) return;
  const master = audio.channels.get('master');
  const music = audio.channels.get('music');
  const sfx = audio.channels.get('sfx');
  if (master) master.volume = gameState.settings.masterVolume;
  if (music) music.volume = gameState.settings.musicVolume;
  if (sfx) sfx.volume = gameState.settings.sfxVolume;
}

export function buildSceneRegistry(ctx: GameContextValue, deps: SceneRegistryDeps): void {
  const {
    localization,
    renderHooks,
    audioRef,
    dialogue,
    saveStore,
    entitlementStore,
    getBottomInset,
    getImage,
  } = deps;

  // When getImage is provided, build the full multi-atlas set (shape + kenney + bg).
  // Otherwise fall back to the legacy single-entry path so existing call-sites
  // that predate KG2 continue to compile and run unchanged.
  const atlases = getImage ? loadGameAtlases(Skia, SPRITES_MANIFEST, getImage) : null;
  const atlas = atlases?.shape ?? loadSpriteAtlas(Skia, SPRITES_MANIFEST);

  // PostFx chain runs against Skia. Visible compositing requires the GameView
  // SkCanvas bridge to land in a future engine session; until then the chain
  // still tracks intensities for triggerHitFlash() etc.
  // Cast: SkiaPostFxModuleLike.makeShader signature differs from the real Skia
  // type at the type level only; the runtime object satisfies the contract.
  const skiaPostFx = Skia as unknown as SkiaPostFxModuleLike;

  const a11y = createA11yBridge({
    initial: { reducedMotion: gameState.settings.reducedMotion },
  });
  a11y.manager.onChange.add((s) => {
    gameState.settings.reducedMotion = s.reducedMotion;
  });

  ctx.scenes.register(
    'boot',
    createBootScene(
      ctx,
      async () => {
        await saveStore.load();
        localization.setLocale(gameState.settings.locale);
        for (const key of saveStore.entitlements()) {
          entitlementStore.grant(key);
        }
      },
      async () => {
        const handles = await initAudio(ctx);
        applyVolumes(handles);
        return handles;
      },
      audioRef,
    ),
  );
  ctx.scenes.register('menu', createMenuScene(ctx));
  ctx.scenes.register('save-select', createSaveSelectScene(ctx));
  ctx.scenes.register('settings', createSettingsScene(ctx));
  ctx.scenes.register('credits', createCreditsScene(ctx));
  ctx.scenes.register('inventory', createInventoryScene(ctx));
  ctx.scenes.register('codex-shards', createCodexShardsScene(ctx));
  ctx.scenes.register('achievements', createAchievementsScene(ctx));
  ctx.scenes.register('shop', createShopScene(ctx));
  ctx.scenes.register(
    'play',
    createPlayScene({
      ctx,
      atlas,
      kenney: atlases?.kenney ?? null,
      bg: atlases?.bg ?? null,
      save: saveStore,
      audio: audioRef,
      skia: skiaPostFx,
      renderHooks,
      a11y,
      dialogue,
      entitlementStore,
      entitlementFallback: createEntitlementFallback(),
      getBottomInset,
    }),
  );
  ctx.scenes.register('game-over', createGameOverScene(ctx));
  ctx.scenes.register('victory', createVictoryScene(ctx));
  ctx.scenes.setTransition(fadeTransition(0.32, easeOutCubic));
}
