import { StatsTracker, createFpsWidget } from '@flare-engine/debug';
import type {
  AudioContextLike,
  GameContextValue,
  SFXPool,
  VirtualButtonState,
  VirtualJoystickState,
} from '@flare-engine/engine';
import {
  GameView,
  Music,
  SFXPool as SFXPoolCtor,
  VirtualButton,
  VirtualJoystick,
  createChannels,
} from '@flare-engine/engine';
import { Skia } from '@shopify/react-native-skia';
import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { buildPlaceholderAtlas } from './atlas';
import { type MusicKey, createBeepBuffers, createMusicBuffers } from './audio';
import { Hud } from './hud/Hud';
import { publishFps } from './hud/fps-state';
import { createBenchScene } from './scenes/bench';
import { createBootScene } from './scenes/boot';
import { createGameOverScene } from './scenes/game-over';
import { createMenuScene } from './scenes/menu';
import { createPlayScene } from './scenes/play';
import { createVictoryScene } from './scenes/victory';
import { bombButtonState, joystickState, resetBombButtonFrame } from './state';

interface AudioApiModule {
  AudioContext: new () => AudioContextLike;
}

interface AudioHandles {
  pool: SFXPool;
  music: Music;
}

async function initAudio(ctx: GameContextValue): Promise<AudioHandles | null> {
  try {
    const mod = (await import('react-native-audio-api')) as unknown as AudioApiModule;
    ctx.audio.init(() => new mod.AudioContext());
    const audioCtx = ctx.audio.context;
    if (!audioCtx) return null;
    const channels = createChannels(audioCtx);
    const sfxChannel = channels.get('sfx');
    const musicChannel = channels.get('music');
    if (!sfxChannel || !musicChannel) return null;
    const pool = new SFXPoolCtor(16);
    pool.connect(audioCtx, sfxChannel.node);
    const beeps = createBeepBuffers(audioCtx);
    for (const [k, buf] of Object.entries(beeps)) pool.register(k, buf);
    const music = new Music();
    music.connect(audioCtx, musicChannel.node);
    const tracks = createMusicBuffers(audioCtx);
    for (const [k, buf] of Object.entries(tracks)) music.register(k, buf);
    return { pool, music };
  } catch {
    return null;
  }
}

const sceneToTrack: Record<string, MusicKey | null> = {
  menu: 'menu',
  play: 'game',
  'game-over': null,
  victory: 'menu',
  boot: null,
  bench: null,
};

function applySceneMusic(music: Music, sceneName: string): void {
  const next = sceneToTrack[sceneName] ?? null;
  if (next === null) {
    if (music.playing !== null) music.stop();
    return;
  }
  if (music.playing === next) return;
  if (music.playing === null) music.play(next, true);
  else music.crossfadeTo(next, 0.6, true);
}

function onReady(ctx: GameContextValue): void {
  const atlas = buildPlaceholderAtlas(Skia);
  const sfxRef: { current: SFXPool | null } = { current: null };
  const musicRef: { current: Music | null } = { current: null };
  void initAudio(ctx).then((h) => {
    if (!h) return;
    sfxRef.current = h.pool;
    musicRef.current = h.music;
    const current = ctx.scenes.current?.name;
    if (current) applySceneMusic(h.music, current);
  });

  ctx.scenes.register('boot', createBootScene(ctx));
  ctx.scenes.register('menu', createMenuScene(ctx));
  ctx.scenes.register('play', createPlayScene({ ctx, atlas, sfx: sfxRef }));
  ctx.scenes.register('game-over', createGameOverScene(ctx));
  ctx.scenes.register('victory', createVictoryScene(ctx));
  ctx.scenes.register('bench', createBenchScene({ ctx, atlas }));

  const stats = new StatsTracker();
  const fpsWidget = createFpsWidget({ showEntities: false, showDrawCalls: false });
  let fpsSampleFrames = 0;

  let lastScene: string | null = null;
  ctx.loop.onUpdate.add((dt) => {
    ctx.scenes.update(dt);
    resetBombButtonFrame();
    const name = ctx.scenes.current?.name ?? null;
    if (name !== lastScene) {
      lastScene = name;
      if (musicRef.current && name) applySceneMusic(musicRef.current, name);
    }

    fpsSampleFrames++;
    if (fpsSampleFrames >= 15) {
      fpsSampleFrames = 0;
      const clock = ctx.loop.clock;
      stats.updateFromClock(clock.fps, clock.rawDt, clock.dt, clock.frame);
      fpsWidget.update(stats.stats);
      publishFps(fpsWidget.line);
    }
  });

  void ctx.scenes.go('boot');
}

export function App(): React.ReactElement {
  const onJoystick = (s: VirtualJoystickState): void => {
    joystickState.dx = s.direction.x;
    joystickState.dy = s.direction.y;
    joystickState.active = s.active;
  };
  const onBomb = (s: VirtualButtonState): void => {
    if (s.justPressed) bombButtonState.justPressed = true;
    bombButtonState.isPressed = s.isPressed;
  };

  return (
    <View style={styles.root}>
      <GameView config={{ clearColor: 0xff0a0e1a }} onReady={onReady}>
        <VirtualJoystick onStateChange={onJoystick} style={styles.joystick} />
        <VirtualButton onStateChange={onBomb} style={styles.bombBtn} />
      </GameView>
      <Hud />
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
