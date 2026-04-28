import { createA11yBridge } from '@flare-engine/a11y';
import type { GameContextValue } from '@flare-engine/engine';
import { fadeTransition } from '@flare-engine/engine';
import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { Skia } from '@shopify/react-native-skia';
import { SPRITES_MANIFEST, loadSpriteAtlas } from './assets';
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
  /** Safe-area bottom inset forwarded into createPlayScene. */
  bottomInset?: number;
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
    bottomInset,
  } = deps;
  const atlas = loadSpriteAtlas(Skia, SPRITES_MANIFEST);
  // PostFx: pass `null` Skia module — visible SkSL compositing requires a
  // GameView SkCanvas bridge that the current CanvasLike hook doesn't expose.
  const skiaPostFx = null;

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
      save: saveStore,
      audio: audioRef,
      skia: skiaPostFx,
      renderHooks,
      a11y,
      dialogue,
      entitlementStore,
      entitlementFallback: createEntitlementFallback(),
      bottomInset,
    }),
  );
  ctx.scenes.register('game-over', createGameOverScene(ctx));
  ctx.scenes.register('victory', createVictoryScene(ctx));
  ctx.scenes.setTransition(fadeTransition(0.3));
}
