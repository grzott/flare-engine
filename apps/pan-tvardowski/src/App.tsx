import { EBGaramond_500Medium, EBGaramond_500Medium_Italic } from '@expo-google-fonts/eb-garamond';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import { parseTexturePackerHash } from '@flare-engine/assets';
import { DevtoolsHUD, DevtoolsProvider } from '@flare-engine/devtools';
import type {
  GameContextValue,
  VirtualButtonState,
  VirtualJoystickState,
} from '@flare-engine/engine';
import { AppLifecycle, GameView, VirtualButton, VirtualJoystick } from '@flare-engine/engine';
import type { CrashPayload } from '@flare-engine/errors';
import { ErrorBoundary, createCrashPayload } from '@flare-engine/errors';
import { NoopIAPProvider } from '@flare-engine/iap';
import { Canvas, Group, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import zone1Json from '../assets/kenney/zone1.json';
import type { ImageResolver } from './assets';
import { disposeAudio, getAudio } from './audio/init';
import { Boss, Bullet, Enemy } from './components';
import { createNativeSource, createPanTvardowskiDeepLinks } from './deep-links/router';
import { type GameSnapshot, createGameSnapshot } from './devtools/snapshot';
import { gameEvents } from './events';
import type { ZoneId } from './events';
import { AchievementsOverlay } from './hud/AchievementsOverlay';
import { BootOverlay } from './hud/BootOverlay';
import { CodexOverlay } from './hud/CodexOverlay';
import { DialogueOverlay } from './hud/DialogueOverlay';
import { Hud } from './hud/Hud';
import { InventoryOverlay } from './hud/InventoryOverlay';
import { MenuOverlay, type MenuOverlayActions } from './hud/MenuOverlay';
import { PaywallOverlay } from './hud/PaywallOverlay';
import { ShopOverlay } from './hud/ShopOverlay';
import { PT_ENTITLEMENT } from './iap/catalog';
import { activateBenchMode, getBenchReport, isBenchDone } from './perf/bench-mode';
import { markBootMilestone, markBootStart } from './perf/cold-start';
import { useAppProviders } from './providers';
import { applyVolumes, buildSceneRegistry } from './scene-registry';
import { shareHighScore } from './share/manager';
import {
  bombButtonState,
  gameState,
  joystickState,
  notifyStateChanged,
  resetBombButtonFrame,
  resetGameState,
  stateChanged,
} from './state';
import { getTier2Providers } from './tier2/providers';
import { mountTier2Wiring } from './tier2/wiring';
import { hexToArgb } from './util/hex';
import { THEME_SPEC } from './visual-spec/theme';

markBootStart();

// Suppress the expo-keep-awake auto-activation on Android so the screen
// obeys the OS setting during menus and cutscenes. Wrapped in try/catch
// because the module may be absent in test / web environments.
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { deactivateKeepAwake } = require('expo-keep-awake') as {
      deactivateKeepAwake: () => void;
    };
    deactivateKeepAwake();
  } catch {
    // no-op — module absent
  }
}

const GATED_ZONES = new Set<string>(['z4', 'z5', 'z6', 'z7', 'z8']);

// Kenney controls — Large (2×) standalone PNGs bundled for Metro.
// Placed in assets/kenney-controls/ (separate from kenney-src/ so the atlas
// packer never picks them up). Required at module level so Metro can statically
// analyse the paths and include them in the bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IMG_BUTTON_CIRCLE = require('../assets/kenney-controls/button_circle.png') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IMG_JOYSTICK_PAD = require('../assets/kenney-controls/joystick_circle_pad_a.png') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IMG_JOYSTICK_NUB = require('../assets/kenney-controls/joystick_circle_nub_a.png') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IMG_ICON_FIRE = require('../assets/kenney-controls/icon_fire.png') as number;

// Parse the kenney atlas sheet once at module load to extract the icon_cog
// frame rect. Static — no runtime dependency on Skia or image decode.
const _zone1Sheet = parseTexturePackerHash(zone1Json);
const _cogFrameIdx = _zone1Sheet.frameMap.get('icon_cog');
const COG_FRAME = _cogFrameIdx !== undefined ? _zone1Sheet.frames[_cogFrameIdx] : null;

function isGatedZone(zone: ZoneId): boolean {
  return GATED_ZONES.has(zone);
}

type RuntimeDisposer = () => void;

interface BootstrapDeps {
  ctx: GameContextValue;
  localization: ReturnType<typeof useAppProviders>['localization'];
  renderHooks: ReturnType<typeof useAppProviders>['renderHooks'];
  audioRef: ReturnType<typeof useAppProviders>['audioRef'];
  dialogue: ReturnType<typeof useAppProviders>['dialogueController'];
  saveStore: ReturnType<typeof useAppProviders>['saveStore'];
  entitlementStore: ReturnType<typeof useAppProviders>['entitlementStore'];
  getBottomInset: () => number;
  /** Stable closure that reads the current useImage values for each manifest
   *  entry. Refs are updated via useEffect as images load. */
  getImage: ImageResolver;
}

function bootstrap(deps: BootstrapDeps): RuntimeDisposer {
  const {
    ctx,
    localization,
    renderHooks,
    audioRef,
    dialogue,
    saveStore,
    entitlementStore,
    getBottomInset,
    getImage,
  } = deps;

  buildSceneRegistry(ctx, {
    localization,
    renderHooks,
    audioRef,
    dialogue,
    saveStore,
    entitlementStore,
    getBottomInset,
    getImage,
  });

  const offUpdate = ctx.loop.onUpdate.add((dt) => {
    ctx.scenes.update(dt);
    resetBombButtonFrame();
  });

  // Deep links:
  //   pantvardowski://zone/:n  → jump to zone n
  //   pantvardowski://bench/:id → activate bench mode + jump to play scene
  const manager = createPanTvardowskiDeepLinks(createNativeSource(Linking), {
    onZoneRequest: (zone: ZoneId) => {
      gameState.currentZone = zone;
      void ctx.scenes.go('play');
    },
    onBenchRequest: (scenarioId) => {
      activateBenchMode(scenarioId);
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
  const providers = useAppProviders();
  const {
    localization,
    audioRef,
    dialogueController,
    saveStore,
    entitlementStore,
    renderHooks,
    shareManager,
    crashTransport,
  } = providers;
  const [, fontError] = useFonts({
    EBGaramond_500Medium,
    EBGaramond_500Medium_Italic,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  if (fontError) {
    void crashTransport.report(createCrashPayload(fontError, { source: 'expo-font' }));
  }

  // Kenney atlas images — loaded async by RN-Skia's bundled-asset loader.
  // Null on first render; transitions to SkImage once the PNG is decoded.
  // useImage is the idiomatic RN-Skia hook for bundled assets (handles
  // dev/release/platform resolution + caching automatically).
  const kenneyAtlasImage = useImage(require('../assets/kenney/zone1.png'));
  const kenneyAtlasCbImage = useImage(require('../assets/kenney/zone1-cb.png'));
  const kenneyBgImage = useImage(require('../assets/kenney/darkPurple.png'));

  // Stable refs so the getImage closure captures a mutable cell rather than
  // a stale render's value. Updated by useEffect whenever the image arrives.
  const kenneyAtlasImageRef = useRef(kenneyAtlasImage);
  const kenneyAtlasCbImageRef = useRef(kenneyAtlasCbImage);
  const kenneyBgImageRef = useRef(kenneyBgImage);
  // Stable ref to current settings so getImage can read colorBlindMode without
  // recreating the closure on every settings change.
  const settingsRef = useRef(gameState.settings);

  useEffect(() => {
    kenneyAtlasImageRef.current = kenneyAtlasImage;
  }, [kenneyAtlasImage]);
  useEffect(() => {
    kenneyAtlasCbImageRef.current = kenneyAtlasCbImage;
  }, [kenneyAtlasCbImage]);
  useEffect(() => {
    kenneyBgImageRef.current = kenneyBgImage;
  }, [kenneyBgImage]);
  // Keep settingsRef current whenever settings change (controlsTick bump is the
  // trigger — persistSettings calls setControlsTick which re-renders AppRoot).
  useEffect(() => {
    settingsRef.current = gameState.settings;
  });

  // Stable image resolver — closes over the refs (not their values), so each
  // atlas handle's live-image getter reads the current useImage result on every
  // access, picking up the async PNG decode after bootstrap. Empty deps: refs
  // are stable, so the closure never needs recreating.
  const getImage = useMemo<ImageResolver>(() => {
    return (entry) => {
      if (entry.key === 'kenney-zone1') {
        if (settingsRef.current.colorBlindMode) {
          const cb = kenneyAtlasCbImageRef.current;
          if (cb !== null) return cb;
        }
        return kenneyAtlasImageRef.current;
      }
      if (entry.key === 'kenney-bg') return kenneyBgImageRef.current;
      return null;
    };
  }, []);

  // Pause icon — RN-Skia Canvas rendering the icon_cog atlas sub-rect.
  // While kenneyAtlasImage is null (pre-decode) or COG_FRAME is unavailable,
  // returns undefined so <Hud> falls back to the '||' text label.
  const pauseIcon = useMemo((): React.ReactNode | undefined => {
    if (!kenneyAtlasImage || !COG_FRAME) return undefined;
    const { x: fx, y: fy, w: fw, h: fh } = COG_FRAME;
    const displayW = Math.round(fw * 0.5);
    const displayH = Math.round(fh * 0.5);
    const imgW = kenneyAtlasImage.width();
    const imgH = kenneyAtlasImage.height();
    return (
      <Canvas style={{ width: displayW, height: displayH }}>
        <Group clip={{ x: 0, y: 0, width: displayW, height: displayH }}>
          <SkiaImage
            image={kenneyAtlasImage}
            x={-fx * 0.5}
            y={-fy * 0.5}
            width={imgW * 0.5}
            height={imgH * 0.5}
            fit="fill"
          />
        </Group>
      </Canvas>
    );
  }, [kenneyAtlasImage]);

  const ctxRef = useMemo<{ current: GameContextValue | null }>(() => ({ current: null }), []);
  const disposerRef = useMemo<{ current: RuntimeDisposer | null }>(() => ({ current: null }), []);
  const [ctx, setCtx] = useState<GameContextValue | null>(null);
  const [currentScene, setCurrentScene] = useState(() => gameState.currentScene);
  const [paywallVisible, setPaywallVisible] = useState(false);
  // Re-render trigger for controls-side changes so joystick / bomb swap
  // position as soon as the settings toggle is flipped.
  const [controlsTick, setControlsTick] = useState(0);
  // Bench mode: flips to true when markBenchDone() is called by a scenario.
  const [benchDone, setBenchDone] = useState(false);
  // Bench mode: perf report JSON rendered as the BENCH_DONE Text content so
  // Maestro extracts it via copyTextFrom (release Hermes does not forward
  // console.log to logcat).
  const [benchReport, setBenchReportState] = useState<string | null>(null);

  // Release runtime resources on unmount — prevents a second game from
  // booting when the component remounts (OS relaunch, hot reload, Android
  // config-change while singleTask is set).
  useEffect(() => {
    markBootMilestone('providers-mounted');
    return () => {
      disposerRef.current?.();
      disposerRef.current = null;
      ctxRef.current = null;
    };
  }, [disposerRef, ctxRef]);

  useEffect(() => {
    const off = stateChanged.add(() => setCurrentScene(gameState.currentScene));
    return () => off();
  }, []);

  useEffect(() => {
    const offTrigger = gameEvents.on('paywall-trigger', () => setPaywallVisible(true));
    const offPurchased = gameEvents.on('purchase-completed', () => setPaywallVisible(false));
    return () => {
      offTrigger();
      offPurchased();
    };
  }, []);

  // Bench mode — poll isBenchDone() from the game loop so the BENCH_DONE
  // sentinel Text becomes visible for Maestro assertVisible.
  useEffect(() => {
    if (!ctx) return;
    const off = ctx.loop.onUpdate.add(() => {
      if (isBenchDone()) {
        setBenchDone(true);
        const report = getBenchReport();
        if (report !== null) setBenchReportState(report);
      }
    });
    return () => off();
  }, [ctx]);

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
      onSettings: () => {
        gameState.settingsOrigin = 'pause';
        void ctxRef.current?.scenes.go('settings');
      },
    }),
    [ctxRef, shareManager, localization],
  );

  const menuActions = useMemo<MenuOverlayActions>(
    () => ({
      goMenu: () => {
        void ctxRef.current?.scenes.go('menu');
      },
      goPlay: () => {
        void ctxRef.current?.scenes.go('play');
      },
      goSaveSelect: () => {
        void ctxRef.current?.scenes.go('save-select');
      },
      goSettings: () => {
        gameState.settingsOrigin = 'menu';
        void ctxRef.current?.scenes.go('settings');
      },
      goCredits: () => {
        void ctxRef.current?.scenes.go('credits');
      },
      goInventory: () => {
        void ctxRef.current?.scenes.go('inventory');
      },
      goCodex: () => {
        void ctxRef.current?.scenes.go('codex-shards');
      },
      goAchievements: () => {
        void ctxRef.current?.scenes.go('achievements');
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
            gameEvents.emit('paywall-trigger', 'zone-locked-click');
            gameState.shopGateVisible = true;
            notifyStateChanged();
            void ctxRef.current?.scenes.go('shop');
            return;
          }
          gameState.shopGateVisible = false;
          void ctxRef.current?.scenes.go('play');
        })();
      },
      startSlotAtZone: (index, zoneId) => {
        void (async () => {
          const existing = saveStore.getSlot(index);
          if (existing === null) await saveStore.createSlot(index);
          else await saveStore.selectSlot(index);
          if (isGatedZone(zoneId) && !entitlementStore.isEntitled(PT_ENTITLEMENT.FULL_GAME)) {
            gameEvents.emit('paywall-trigger', 'zone-locked-click');
            gameState.shopGateVisible = true;
            notifyStateChanged();
            void ctxRef.current?.scenes.go('shop');
            return;
          }
          gameState.shopGateVisible = false;
          gameState.currentZone = zoneId;
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

  // Joystick skin nodes — stable (no changing deps).
  const joystickBase = useMemo(
    () => <Image source={IMG_JOYSTICK_PAD} style={{ width: 128, height: 128 }} />,
    [],
  );
  const joystickThumb = useMemo(
    () => <Image source={IMG_JOYSTICK_NUB} style={{ width: 64, height: 64 }} />,
    [],
  );

  // Bomb button skin — button_circle bg + icon_fire overlay, both standalone PNGs.
  // Standalone path chosen for C: the button is a plain RN View; keeping both
  // layers as RN <Image> nodes avoids mixing a Skia Canvas into the button tree.
  const bombChildren = useMemo(
    () => (
      <>
        <Image source={IMG_BUTTON_CIRCLE} style={styles.bombBg} />
        <Image source={IMG_ICON_FIRE} style={styles.bombIcon} />
      </>
    ),
    [],
  );

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
      transport={crashTransport}
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
            clearColor: hexToArgb(THEME_SPEC.colors.pitchBrown),
            // Android: promote the Skia canvas to SurfaceView so full-screen RN
            // overlays (HUDs, menus, dialogue) layer above it without needing
            // per-overlay elevation. Game canvas is fully opaque (clearColor
            // alpha = FF), so SurfaceView is safe.
            opaque: true,
            onRenderBackground: (ctx, canvas) => renderHooks.background?.(ctx, canvas),
            onRenderPostFx: (ctx, canvas, bridge) => renderHooks.postfx?.(ctx, canvas, bridge),
          }}
          onReady={(ready) => {
            // StrictMode / hot-reload safety — if a prior bootstrap is still
            // live, tear it down before replacing it.
            disposerRef.current?.();
            ctxRef.current = ready;
            setCtx(ready);
            markBootMilestone('first-frame');
            disposerRef.current = bootstrap({
              ctx: ready,
              localization,
              renderHooks,
              audioRef,
              dialogue: dialogueController,
              saveStore,
              entitlementStore,
              getBottomInset: () => insets.bottom,
              getImage,
            });
          }}
        >
          {currentScene === 'play' && (
            <>
              <VirtualJoystick
                onStateChange={onJoystick}
                style={joystickStyle}
                config={{ maxRadius: 64 }}
                base={joystickBase}
                thumb={joystickThumb}
              />
              <VirtualButton onStateChange={onBomb} style={bombStyle}>
                {bombChildren}
              </VirtualButton>
            </>
          )}
        </GameView>
        <Hud localization={localization} actions={actions} insets={insets} pauseIcon={pauseIcon} />
        <BootOverlay localization={localization} appVersion="0.1.0" />
        <MenuOverlay
          localization={localization}
          save={saveStore}
          actions={menuActions}
          appVersion="0.1.0"
          onLocaleChange={(loc) => localization.setLocale(loc)}
          onVolumesChange={() => applyVolumes(getAudio())}
          entitlementStore={entitlementStore}
        />
        <InventoryOverlay
          localization={localization}
          save={saveStore}
          actions={{ goMenu: menuActions.goMenu }}
        />
        <CodexOverlay
          localization={localization}
          save={saveStore}
          actions={{ goMenu: menuActions.goMenu }}
        />
        <AchievementsOverlay
          localization={localization}
          save={saveStore}
          actions={{ goMenu: menuActions.goMenu }}
        />
        <ShopOverlay
          localization={localization}
          entitlementStore={entitlementStore}
          actions={{ goMenu: menuActions.goMenu, goSaveSelect: menuActions.goSaveSelect }}
          isNoopProvider={getTier2Providers().iap === NoopIAPProvider}
        />
        <PaywallOverlay
          localization={localization}
          entitlementStore={entitlementStore}
          visible={paywallVisible}
          onDismiss={() => setPaywallVisible(false)}
        />
        <DialogueOverlay localization={localization} controller={dialogueController} />
        {__DEV__ && ctx && snapshotSource ? (
          <DevtoolsProvider world={ctx.world} loop={ctx.loop} snapshot={snapshotSource}>
            <DevtoolsHUD />
          </DevtoolsProvider>
        ) : null}
        {benchDone ? (
          <Text
            testID="BENCH_DONE"
            accessible={true}
            importantForAccessibility="yes"
            accessibilityLabel="BENCH_DONE"
            style={[
              styles.benchDoneSentinel,
              { bottom: 16 + insets.bottom, right: 16 + insets.right },
            ]}
          >
            {benchReport !== null ? `[perf-bench] ${benchReport}` : 'BENCH_DONE'}
          </Text>
        ) : null}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME_SPEC.colors.pureBlack },
  crashRoot: {
    flex: 1,
    backgroundColor: THEME_SPEC.colors.crashBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  crashTitle: {
    color: THEME_SPEC.colors.parchmentLight,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  crashMessage: {
    color: THEME_SPEC.colors.ashGrey,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  crashButton: {
    backgroundColor: THEME_SPEC.colors.crashButtonBg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  crashButtonText: { color: THEME_SPEC.colors.white, fontSize: 15, fontWeight: '600' },
  joystick: {
    position: 'absolute',
    width: 128,
    height: 128,
  },
  bombBtn: {
    position: 'absolute',
    width: 64,
    height: 64,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bombBg: {
    position: 'absolute',
    width: 64,
    height: 64,
  },
  bombIcon: {
    width: 32,
    height: 32,
  },
  benchDoneSentinel: {
    position: 'absolute',
    color: THEME_SPEC.colors.white,
    backgroundColor: THEME_SPEC.colors.pureBlack,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
