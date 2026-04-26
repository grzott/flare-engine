import { DevtoolsHUD, DevtoolsProvider } from '@flare-engine/devtools';
import type {
  GameContextValue,
  VirtualButtonState,
  VirtualJoystickState,
} from '@flare-engine/engine';
import {
  AppLifecycle,
  GameView,
  VirtualButton,
  VirtualJoystick,
  fadeTransition,
} from '@flare-engine/engine';
import { ErrorBoundary, createConsoleTransport } from '@flare-engine/errors';
import type { CrashPayload } from '@flare-engine/errors';
import { type EntitlementStore, NoopIAPProvider } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import type { ShareManager } from '@flare-engine/share';
import { Skia } from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createA11yBridge } from './a11y/manager';
import type { AudioHandles } from './audio/init';
import { disposeAudio, getAudio, initAudio } from './audio/init';
import { Boss, Bullet, Enemy } from './components';
import { createNativeSource, createPanTvardowskiDeepLinks } from './deep-links/router';
import { type GameSnapshot, createGameSnapshot } from './devtools/snapshot';
import { createDialogueController } from './dialogue';
import { gameEvents } from './events';
import type { ZoneId } from './events';
import { DialogueOverlay } from './hud/DialogueOverlay';
import { Hud } from './hud/Hud';
import { InventoryOverlay } from './hud/InventoryOverlay';
import { MenuOverlay, type MenuOverlayActions } from './hud/MenuOverlay';
import { ShopOverlay } from './hud/ShopOverlay';
import { PT_ENTITLEMENT } from './iap/catalog';
import { createPTEntitlementStore } from './iap/store';
import { createLocalization } from './localization/index';
import { createSaveStore } from './save/store';
import { createBootScene } from './scenes/boot';
import { createCreditsScene } from './scenes/credits';
import { createGameOverScene, createVictoryScene } from './scenes/end';
import { createInventoryScene } from './scenes/inventory';
import { createMenuScene } from './scenes/menu';
import type { PlayRenderHooks } from './scenes/play';
import { createPlayScene } from './scenes/play';
import { createSaveSelectScene } from './scenes/save-select';
import { createSettingsScene } from './scenes/settings';
import { createShopScene } from './scenes/shop';
import { buildShapeAtlas } from './shape-atlas';
import { createShareManager, shareHighScore } from './share/manager';
import {
  bombButtonState,
  gameState,
  joystickState,
  notifyStateChanged,
  resetBombButtonFrame,
  resetGameState,
} from './state';
import { mountTier2Wiring } from './tier2/wiring';

const GATED_ZONES = new Set<string>(['z4', 'z5', 'z6', 'z7', 'z8']);

function isGatedZone(zone: ZoneId): boolean {
  return GATED_ZONES.has(zone);
}

interface AudioRef {
  current: AudioHandles | null;
}

type RuntimeDisposer = () => void;

interface BootstrapDeps {
  ctx: GameContextValue;
  localization: LocalizationManager;
  renderHooks: PlayRenderHooks;
  audioRef: AudioRef;
  dialogue: ReturnType<typeof createDialogueController>;
  saveStore: ReturnType<typeof createSaveStore>;
  entitlementStore: EntitlementStore;
}

function applyVolumes(audio: AudioHandles | null): void {
  if (!audio) return;
  const master = audio.channels.get('master');
  const music = audio.channels.get('music');
  const sfx = audio.channels.get('sfx');
  if (master) master.volume = gameState.settings.masterVolume;
  if (music) music.volume = gameState.settings.musicVolume;
  if (sfx) sfx.volume = gameState.settings.sfxVolume;
}

function bootstrap(deps: BootstrapDeps): RuntimeDisposer {
  const { ctx, localization, renderHooks, audioRef, dialogue, saveStore, entitlementStore } = deps;
  const atlas = buildShapeAtlas(Skia);
  // PostFx: pass `null` Skia module — visible SkSL compositing requires a
  // GameView SkCanvas bridge that the current CanvasLike hook doesn't expose.
  const skiaPostFx = null;

  const a11y = createA11yBridge();

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
    }),
  );
  ctx.scenes.register('game-over', createGameOverScene(ctx));
  ctx.scenes.register('victory', createVictoryScene(ctx));
  ctx.scenes.setTransition(fadeTransition(0.3));

  const offUpdate = ctx.loop.onUpdate.add((dt) => {
    ctx.scenes.update(dt);
    resetBombButtonFrame();
  });

  // Deep links — `pantvardowski://zone/:n` jumps into the requested zone.
  const manager = createPanTvardowskiDeepLinks(createNativeSource(Linking), {
    onZoneRequest: (zone: ZoneId) => {
      gameState.currentZone = zone;
      void ctx.scenes.go('play');
    },
  });
  void manager.start();

  // AppState bridge → engine AppLifecycle. Pauses the loop + suspends audio
  // on background; resumes both on foreground. Without this, minimising and
  // restoring the app causes the old loop + audio graph to linger while a
  // remount would spin up a second one — visible on device as "a second game
  // starts" and "all sounds overlap".
  const lifecycle = new AppLifecycle(ctx.loop);
  const offBackground = lifecycle.onBackground.add(() => {
    void ctx.audio.suspend();
    audioRef.current?.music.stop();
  });
  const offForeground = lifecycle.onForeground.add(() => {
    void ctx.audio.resume();
  });
  const onAppStateChange = (next: AppStateStatus): void => {
    if (next === 'active') lifecycle.foreground();
    else if (next === 'background' || next === 'inactive') lifecycle.background();
  };
  const appStateSub = AppState.addEventListener('change', onAppStateChange);

  void ctx.scenes.go('boot');

  return () => {
    appStateSub.remove();
    offBackground();
    offForeground();
    manager.stop();
    offUpdate();
    gameEvents.removeAll();
    disposeAudio();
    audioRef.current = null;
    resetGameState();
  };
}

export function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}

function AppRoot(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const localization = useMemo(() => createLocalization(), []);
  const audioRef = useMemo<AudioRef>(() => ({ current: null }), []);
  const dialogueController = useMemo(() => createDialogueController(), []);
  const saveStore = useMemo(() => createSaveStore(), []);
  const entitlementStore = useMemo(() => createPTEntitlementStore(), []);
  const ctxRef = useMemo<{ current: GameContextValue | null }>(() => ({ current: null }), []);
  const disposerRef = useMemo<{ current: RuntimeDisposer | null }>(() => ({ current: null }), []);
  const renderHooks = useMemo<PlayRenderHooks>(() => ({ background: null, postfx: null }), []);
  const shareManager = useMemo<ShareManager>(() => createShareManager(Share), []);
  const [ctx, setCtx] = useState<GameContextValue | null>(null);
  // Re-render trigger for controls-side changes so joystick / bomb swap
  // position as soon as the settings toggle is flipped.
  const [controlsTick, setControlsTick] = useState(0);

  // Release runtime resources on unmount — prevents a second game from
  // booting when the component remounts (OS relaunch, hot reload, Android
  // config-change while singleTask is set).
  useEffect(() => {
    return () => {
      disposerRef.current?.();
      disposerRef.current = null;
      ctxRef.current = null;
    };
  }, [disposerRef, ctxRef]);

  // Tier-2 wiring (analytics / leaderboards / achievements / iap) — the
  // 0.1.x build ships noop providers; this call exercises the interface
  // surface so gameplay events flow through the providers end-to-end.
  useEffect(() => {
    const unmount = mountTier2Wiring();
    return unmount;
  }, []);

  const onJoystick = (s: VirtualJoystickState): void => {
    joystickState.dx = s.direction.x;
    joystickState.dy = s.direction.y;
    joystickState.active = s.active;
  };
  const onBomb = (s: VirtualButtonState): void => {
    if (s.justPressed) bombButtonState.justPressed = true;
    bombButtonState.isPressed = s.isPressed;
  };

  const actions = useMemo(
    () => ({
      onRetry: () => {
        void ctxRef.current?.scenes.go('play');
      },
      onContinue: () => {
        void ctxRef.current?.scenes.go('play');
      },
      onShare: () => {
        void shareHighScore({
          manager: shareManager,
          score: gameState.score,
          victory: gameState.victory,
          t: (key, params) => localization.t(key, params as Record<string, string | number>),
        });
      },
      onMainMenu: () => {
        void ctxRef.current?.scenes.go('menu');
      },
    }),
    [ctxRef, shareManager, localization],
  );

  const menuActions = useMemo<MenuOverlayActions>(
    () => ({
      goMenu: () => {
        void ctxRef.current?.scenes.go('menu');
      },
      goSaveSelect: () => {
        void ctxRef.current?.scenes.go('save-select');
      },
      goSettings: () => {
        void ctxRef.current?.scenes.go('settings');
      },
      goCredits: () => {
        void ctxRef.current?.scenes.go('credits');
      },
      goInventory: () => {
        void ctxRef.current?.scenes.go('inventory');
      },
      goShop: () => {
        void ctxRef.current?.scenes.go('shop');
      },
      startSlot: (index) => {
        void (async () => {
          const existing = saveStore.getSlot(index);
          if (existing === null) await saveStore.createSlot(index);
          else await saveStore.selectSlot(index);
          const slot = saveStore.getSlot(index);
          if (
            slot !== null &&
            isGatedZone(slot.zoneReached) &&
            !entitlementStore.isEntitled(PT_ENTITLEMENT.FULL_GAME)
          ) {
            gameState.shopGateVisible = true;
            notifyStateChanged();
            void ctxRef.current?.scenes.go('shop');
            return;
          }
          gameState.shopGateVisible = false;
          void ctxRef.current?.scenes.go('play');
        })();
      },
      persistSettings: () => {
        setControlsTick((n) => n + 1);
        applyVolumes(getAudio());
        localization.setLocale(gameState.settings.locale);
      },
    }),
    [ctxRef, saveStore, localization, entitlementStore],
  );

  const snapshotSource = useMemo(() => {
    if (!ctx) return null;
    const enemyQuery = ctx.world.query(Enemy);
    const bulletQuery = ctx.world.query(Bullet);
    const bossQuery = ctx.world.query(Boss);
    let elapsed = 0;
    ctx.loop.onUpdate.add((dt) => {
      elapsed += dt;
    });
    return (): GameSnapshot =>
      createGameSnapshot({
        world: ctx.world,
        enemyQuery,
        bulletQuery,
        bossQuery,
        elapsed: () => elapsed,
      });
  }, [ctx]);

  // `controlsTick` is a manual bump counter — `gameState` is a mutable
  // singleton, so reading `gameState.settings.controls.*` alone does not
  // trigger re-computation; bumping `controlsTick` in the settings-scene
  // completion callback forces these memos to re-evaluate.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  const joystickStyle = useMemo(() => {
    const side = gameState.settings.controls.joystickSide;
    const base = { ...styles.joystick, bottom: 48 + insets.bottom };
    return side === 'left'
      ? { ...base, left: 24 + insets.left }
      : { ...base, right: 24 + insets.right };
  }, [insets.left, insets.right, insets.bottom, controlsTick]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  const bombStyle = useMemo(() => {
    const side = gameState.settings.controls.fireButtonSide;
    const base = { ...styles.bombBtn, bottom: 48 + insets.bottom };
    return side === 'right'
      ? { ...base, right: 24 + insets.right }
      : { ...base, left: 24 + insets.left };
  }, [insets.left, insets.right, insets.bottom, controlsTick]);

  return (
    <ErrorBoundary
      transport={createConsoleTransport()}
      fallback={(payload: CrashPayload, reset: () => void) => (
        <View style={styles.crashRoot}>
          <StatusBar hidden />
          <Text style={styles.crashTitle}>{localization.t('menu.error.title')}</Text>
          <Text style={styles.crashMessage}>{payload.message}</Text>
          <Pressable style={styles.crashButton} onPress={reset}>
            <Text style={styles.crashButtonText}>{localization.t('menu.error.reset')}</Text>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.root}>
        <StatusBar hidden />
        <GameView
          config={{
            clearColor: 0xff1a0e0a,
            onRenderBackground: (ctx, canvas) => renderHooks.background?.(ctx, canvas),
            onRenderPostFx: (ctx, canvas) => renderHooks.postfx?.(ctx, canvas),
          }}
          onReady={(ready) => {
            // StrictMode / hot-reload safety — if a prior bootstrap is still
            // live, tear it down before replacing it.
            disposerRef.current?.();
            ctxRef.current = ready;
            setCtx(ready);
            disposerRef.current = bootstrap({
              ctx: ready,
              localization,
              renderHooks,
              audioRef,
              dialogue: dialogueController,
              saveStore,
              entitlementStore,
            });
          }}
        >
          <VirtualJoystick onStateChange={onJoystick} style={joystickStyle} />
          <VirtualButton onStateChange={onBomb} style={bombStyle} />
        </GameView>
        <Hud localization={localization} actions={actions} insets={insets} />
        <MenuOverlay
          localization={localization}
          save={saveStore}
          actions={menuActions}
          appVersion="0.1.0"
          onLocaleChange={(loc) => localization.setLocale(loc)}
          onVolumesChange={() => applyVolumes(getAudio())}
        />
        <InventoryOverlay
          localization={localization}
          save={saveStore}
          actions={{ goMenu: menuActions.goMenu }}
        />
        <ShopOverlay
          localization={localization}
          save={saveStore}
          entitlementStore={entitlementStore}
          iapProvider={NoopIAPProvider}
          actions={{ goMenu: menuActions.goMenu, goSaveSelect: menuActions.goSaveSelect }}
        />
        <DialogueOverlay localization={localization} controller={dialogueController} />
        {__DEV__ && ctx && snapshotSource ? (
          <DevtoolsProvider world={ctx.world} loop={ctx.loop} snapshot={snapshotSource}>
            <DevtoolsHUD />
          </DevtoolsProvider>
        ) : null}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  crashRoot: {
    flex: 1,
    backgroundColor: '#0a0610',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  crashTitle: {
    color: '#f3d6a4',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  crashMessage: {
    color: '#a89b8c',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  crashButton: {
    backgroundColor: '#8a2f2f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  crashButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  joystick: {
    position: 'absolute',
    width: 120,
    height: 120,
  },
  bombBtn: {
    position: 'absolute',
    width: 72,
    height: 72,
  },
});
