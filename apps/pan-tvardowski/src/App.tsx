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
import { disposeAudio, initAudio } from './audio/init';
import { Boss, Bullet, Enemy } from './components';
import { createNativeSource, createPanTvardowskiDeepLinks } from './deep-links/router';
import { type GameSnapshot, createGameSnapshot } from './devtools/snapshot';
import { createDialogueController } from './dialogue';
import { gameEvents } from './events';
import type { ZoneId } from './events';
import { DialogueOverlay } from './hud/DialogueOverlay';
import { Hud } from './hud/Hud';
import { createLocalization } from './localization/index';
import { createSaveStore } from './save/store';
import { createBootScene } from './scenes/boot';
import { createGameOverScene, createVictoryScene } from './scenes/end';
import type { PlayRenderHooks } from './scenes/play';
import { createPlayScene } from './scenes/play';
import { buildShapeAtlas } from './shape-atlas';
import { createShareManager, shareHighScore } from './share/manager';
import {
  bombButtonState,
  gameState,
  joystickState,
  resetBombButtonFrame,
  resetGameState,
} from './state';

interface AudioRef {
  current: AudioHandles | null;
}

type RuntimeDisposer = () => void;

function bootstrap(
  ctx: GameContextValue,
  localization: LocalizationManager,
  renderHooks: PlayRenderHooks,
  audioRef: AudioRef,
  dialogue: ReturnType<typeof createDialogueController>,
): RuntimeDisposer {
  const atlas = buildShapeAtlas(Skia);
  const saveStore = createSaveStore();
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
      },
      () => initAudio(ctx),
      audioRef,
    ),
  );
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
  const ctxRef = useMemo<{ current: GameContextValue | null }>(() => ({ current: null }), []);
  const disposerRef = useMemo<{ current: RuntimeDisposer | null }>(() => ({ current: null }), []);
  const renderHooks = useMemo<PlayRenderHooks>(() => ({ background: null, postfx: null }), []);
  const shareManager = useMemo<ShareManager>(() => createShareManager(Share), []);
  const [ctx, setCtx] = useState<GameContextValue | null>(null);

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
    }),
    [ctxRef, shareManager, localization],
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

  const joystickStyle = useMemo(
    () => ({
      ...styles.joystick,
      left: 24 + insets.left,
      bottom: 48 + insets.bottom,
    }),
    [insets.left, insets.bottom],
  );
  const bombStyle = useMemo(
    () => ({
      ...styles.bombBtn,
      right: 24 + insets.right,
      bottom: 48 + insets.bottom,
    }),
    [insets.right, insets.bottom],
  );

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
            disposerRef.current = bootstrap(
              ready,
              localization,
              renderHooks,
              audioRef,
              dialogueController,
            );
          }}
        >
          <VirtualJoystick onStateChange={onJoystick} style={joystickStyle} />
          <VirtualButton onStateChange={onBomb} style={bombStyle} />
        </GameView>
        <Hud localization={localization} actions={actions} insets={insets} />
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
