import type {
  GameContextValue,
  VirtualButtonState,
  VirtualJoystickState,
} from '@flare-engine/engine';
import { GameView, VirtualButton, VirtualJoystick, fadeTransition } from '@flare-engine/engine';
import type { LocalizationManager } from '@flare-engine/localization';
import { Skia } from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { AudioHandles } from './audio/init';
import { initAudio } from './audio/init';
import { createNativeSource, createPanTvardowskiDeepLinks } from './deep-links/router';
import { gameEvents } from './events';
import type { ZoneId } from './events';
import { Hud } from './hud/Hud';
import { createLocalization } from './localization/index';
import { createSaveStore } from './save/store';
import { createBootScene } from './scenes/boot';
import { createGameOverScene, createVictoryScene } from './scenes/end';
import { createPlayScene } from './scenes/play';
import { buildShapeAtlas } from './shape-atlas';
import { bombButtonState, gameState, joystickState, resetBombButtonFrame } from './state';

interface AudioRef {
  current: AudioHandles | null;
}

function onReady(ctx: GameContextValue, localization: LocalizationManager): void {
  const atlas = buildShapeAtlas(Skia);
  const saveStore = createSaveStore();
  const audioRef: AudioRef = { current: null };

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
  ctx.scenes.register('play', createPlayScene({ ctx, atlas, save: saveStore, audio: audioRef }));
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
    }),
    [ctxRef],
  );

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <GameView
        config={{ clearColor: 0xff1a0e0a }}
        onReady={(ctx) => {
          ctxRef.current = ctx;
          onReady(ctx, localization);
        }}
      >
        <VirtualJoystick onStateChange={onJoystick} style={styles.joystick} />
        <VirtualButton onStateChange={onBomb} style={styles.bombBtn} />
      </GameView>
      <Hud localization={localization} actions={actions} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
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
