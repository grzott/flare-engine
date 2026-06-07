import type { GameContextValue } from '@flare-engine/engine';
import { AppLifecycle } from '@flare-engine/engine';
import type { AppStateStatus } from 'react-native';
import { AppState, Linking } from 'react-native';
import type { ImageResolver } from './assets';
import { disposeAudio } from './audio/init';
import { createNativeSource, createPanTvardowskiDeepLinks } from './deep-links/router';
import type { ZoneId } from './events';
import { gameEvents } from './events';
import { activateBenchMode } from './perf/bench-mode';
import type { useAppProviders } from './providers';
import { buildSceneRegistry } from './scene-registry';
import { gameState, resetBombButtonFrame, resetGameState } from './state';

export type RuntimeDisposer = () => void;

export interface BootstrapDeps {
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

export function bootstrap(deps: BootstrapDeps): RuntimeDisposer {
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
