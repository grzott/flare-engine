import { DevtoolsHUD, DevtoolsProvider } from '@flare-engine/devtools';
import type {
  GameContextValue,
  VirtualButtonState,
  VirtualJoystickState,
} from '@flare-engine/engine';
import { GameView, VirtualButton, VirtualJoystick, fadeTransition } from '@flare-engine/engine';
import { ErrorBoundary, createConsoleTransport } from '@flare-engine/errors';
import type { CrashPayload } from '@flare-engine/errors';
import type { LocalizationManager } from '@flare-engine/localization';
import type { ShareManager } from '@flare-engine/share';
import { Skia } from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { createA11yBridge } from './a11y/manager';
import type { AudioHandles } from './audio/init';
import { initAudio } from './audio/init';
import { Boss, Bullet, Enemy } from './components';
import { createNativeSource, createPanTvardowskiDeepLinks } from './deep-links/router';
import { type GameSnapshot, createGameSnapshot } from './devtools/snapshot';
import { gameEvents } from './events';
import type { ZoneId } from './events';
import { Hud } from './hud/Hud';
import { createLocalization } from './localization/index';
import { createSaveStore } from './save/store';
import { createBootScene } from './scenes/boot';
import { createGameOverScene, createVictoryScene } from './scenes/end';
import type { PlayRenderHooks } from './scenes/play';
import { createPlayScene } from './scenes/play';
import { buildShapeAtlas } from './shape-atlas';
import { createShareManager, shareHighScore } from './share/manager';
import { bombButtonState, gameState, joystickState, resetBombButtonFrame } from './state';

interface AudioRef {
  current: AudioHandles | null;
}

function onReady(
  ctx: GameContextValue,
  localization: LocalizationManager,
  renderHooks: PlayRenderHooks,
): void {
  const atlas = buildShapeAtlas(Skia);
  const saveStore = createSaveStore();
  const audioRef: AudioRef = { current: null };
  // PostFx: pass `null` Skia module — visible SkSL compositing requires a
  // GameView SkCanvas bridge that the current CanvasLike hook doesn't expose.
  // The chain + uniform packing are still exercised via tests (postfx.test.ts).
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
    }),
  );
  ctx.scenes.register('game-over', createGameOverScene(ctx));
  ctx.scenes.register('victory', createVictoryScene(ctx));
  ctx.scenes.setTransition(fadeTransition(0.3));

  ctx.loop.onUpdate.add((dt) => {
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

  // Bridge engine-side zone events for external observers (devtools, analytics).
  gameEvents.on('zone-start', () => {
    /* hook point */
  });

  void ctx.scenes.go('boot');
}

export function App(): React.ReactElement {
  const localization = useMemo(() => createLocalization(), []);
  const ctxRef = useMemo<{ current: GameContextValue | null }>(() => ({ current: null }), []);
  const renderHooks = useMemo<PlayRenderHooks>(() => ({ background: null, postfx: null }), []);
  const shareManager = useMemo<ShareManager>(() => createShareManager(Share), []);
  const [ctx, setCtx] = useState<GameContextValue | null>(null);

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

  // Snapshot source: requires stable pre-created queries from the live World.
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
          onReady={(ctx) => {
            ctxRef.current = ctx;
            setCtx(ctx);
            onReady(ctx, localization, renderHooks);
          }}
        >
          <VirtualJoystick onStateChange={onJoystick} style={styles.joystick} />
          <VirtualButton onStateChange={onBomb} style={styles.bombBtn} />
        </GameView>
        <Hud localization={localization} actions={actions} />
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
    left: 24,
    bottom: 48,
    width: 120,
    height: 120,
  },
  bombBtn: {
    position: 'absolute',
    right: 24,
    bottom: 48,
    width: 72,
    height: 72,
  },
});
