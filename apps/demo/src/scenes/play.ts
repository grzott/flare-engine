import type { Scene } from '@flare-engine/engine';
import { CollisionWorld, Position } from '@flare-engine/engine';
import { Boss, Bullet, Enemy, Ship } from '../components';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { closePause, closeSettings, openPause, openSettings, resetUi } from '../hud/ui-state';
import { spawnPlayer } from '../spawn';
import { createRunStats, gameState, notifyStateChanged } from '../state';
import { createBombFlashState } from '../systems/bomb';
import { clearBossFsms } from '../systems/boss';
import { destroyEntity } from '../systems/entity-ops';
import { createSpawnerState } from '../systems/spawner';
import { checkVictory, publishBossStatus } from './play/check-victory';
import { resolveCollision } from './play/collision';
import type { PlaySceneDeps, PlayState } from './play/deps';
import { processBomb } from './play/process-bomb';
import { processCollisions } from './play/process-collisions';
import { processSpawning } from './play/process-spawning';
import { updateSystems } from './play/update-systems';
import { shellDefaults } from './scene-shell';

export type { PlaySceneDeps, SfxRef } from './play/deps';

export function createPlayScene(deps: PlaySceneDeps): () => Scene {
  const { ctx, atlas } = deps;
  const sfxRef = deps.sfx;

  return () => {
    let state: PlayState | null = null;

    function initState(): PlayState {
      const coll = new CollisionWorld();
      const s: PlayState = {
        coll,
        spawner: createSpawnerState(),
        playerId: -1,
        bossId: -1,
        bossSpawned: false,
        spawnEvents: [],
        spawnCtx: { world: ctx.world, coll, atlas },
        flash: createBombFlashState(),
        shipQuery: ctx.world.query(Ship),
        enemyQuery: ctx.world.query(Enemy),
        bulletQuery: ctx.world.query(Bullet),
        posQuery: ctx.world.query(Position),
        bossQuery: ctx.world.query(Boss),
        playerHitShake: false,
        bounds: { width: 0, height: 0 },
      };

      const handlePair = (pair: { entityA: number; entityB: number }) => {
        resolveCollision(ctx.world, s, pair.entityA, pair.entityB, sfxRef.current);
      };
      coll.onTriggerEnter.add(handlePair);
      coll.onCollisionStart.add(handlePair);

      return s;
    }

    function clearWorld(s: PlayState): void {
      const ids: number[] = [];
      for (const id of s.posQuery) ids.push(id);
      for (const id of ids) destroyEntity(ctx.world, s.coll, id);
      s.coll = new CollisionWorld();
      // The pre-allocated spawn ctx holds a stale `coll` — refresh it.
      s.spawnCtx.coll = s.coll;
    }

    function refreshBounds(s: PlayState): void {
      s.bounds.width = ctx.camera.viewportWidth || 360;
      s.bounds.height = ctx.camera.viewportHeight || 640;
    }

    return {
      name: 'play',
      ...shellDefaults(),

      onInit() {
        state = initState();
      },

      onEnter() {
        if (!state) return;
        sfxRef.current?.stopAll();
        clearWorld(state);
        state = initState();
        gameState.playerHp = gameState.playerHpMax;
        gameState.score = 0;
        gameState.bombCharges = 3;
        gameState.bossActive = false;
        gameState.bossHp = 0;
        gameState.bossHpMax = 0;
        gameState.gameOver = false;
        gameState.victory = false;
        gameState.paused = false;
        gameState.currentScene = 'play';
        gameState.runStats = createRunStats();
        resetUi();
        notifyStateChanged();

        setMenuActions({
          onPauseOpen: () => {
            gameState.paused = true;
            ctx.loop.pause();
            openPause();
            notifyStateChanged();
          },
          onPauseResume: () => {
            gameState.paused = false;
            closePause();
            ctx.loop.resume();
            notifyStateChanged();
          },
          onPauseToMenu: () => {
            gameState.paused = false;
            closePause();
            ctx.loop.resume();
            notifyStateChanged();
            void ctx.scenes.go('menu');
          },
          onOpenSettings: () => openSettings(),
          onCloseSettings: () => closeSettings(),
        });

        refreshBounds(state);
        ctx.camera.x = state.bounds.width / 2;
        ctx.camera.y = state.bounds.height / 2;
        ctx.camera.zoom = 1;
        ctx.camera.rotation = 0;
        state.playerId = spawnPlayer(
          state.spawnCtx,
          state.bounds.width / 2,
          state.bounds.height - 90,
        );
      },

      onUpdate(dt: number) {
        if (!state) return;
        if (gameState.paused) return;
        if (gameState.gameOver || gameState.victory) return;
        const s = state;
        refreshBounds(s);
        gameState.runStats.durationSec += dt;

        updateSystems(ctx.world, dt, s, ctx.camera, sfxRef.current);
        processSpawning(dt, s, ctx.camera);
        processBomb(ctx.world, dt, s, ctx.camera, sfxRef.current);
        processCollisions(ctx.world, dt, s, ctx.camera, sfxRef.current);
        publishBossStatus(ctx.world, s);
        checkVictory(ctx.world, s, ctx);
      },

      onExit() {
        if (!state) return;
        clearWorld(state);
        clearBossFsms();
        sfxRef.current?.stopAll();
        clearMenuActions();
        resetUi();
      },
    };
  };
}
