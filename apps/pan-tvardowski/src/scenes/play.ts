import type { GameContextValue, Scene } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Bullet, Enemy, Lifetime, Ship } from '../components';
import { BOSS_SPAWN_T, PLAYER_HP_MAX, SMOK_HP_MAX, START_BOMBS } from '../config/gameplay';
import { burstExplosion } from '../particles';
import type { SaveStore } from '../save/store';
import { type AtlasHandle, type SpawnCtx, spawnBoss, spawnEnemy, spawnPlayer } from '../spawn';
import {
  bombButtonState,
  createRunStats,
  gameState,
  notifyStateChanged,
  resetBombButtonFrame,
} from '../state';
import { type BombFlashState, createBombFlashState, processBomb } from '../systems/bomb';
import { clearBossFsms, computeBossStatus, updateBoss } from '../systems/boss';
import { cleanup } from '../systems/cleanup';
import { resolveCollision } from '../systems/collision';
import { updateEnemyAI } from '../systems/enemy-ai';
import { destroyEntity } from '../systems/entity-ops';
import { integrate } from '../systems/integrate';
import { syncColliders } from '../systems/physics-sync';
import { updatePlayer } from '../systems/player';
import {
  type SpawnEvent,
  type SpawnerState,
  buildZone1Schedule,
  createSpawnerState,
  tickSpawner,
} from '../systems/spawner';
import { shellDefaults } from './scene-shell';

export interface PlaySceneDeps {
  ctx: GameContextValue;
  atlas: AtlasHandle;
  save: SaveStore;
  /** Seed for the wave schedule. Tests override; runtime uses Date.now(). */
  seed?: number;
}

interface PlayState {
  coll: CollisionWorld;
  spawnCtx: SpawnCtx;
  spawner: SpawnerState;
  schedule: ReturnType<typeof buildZone1Schedule>;
  spawnEvents: SpawnEvent[];
  playerId: number;
  bossId: number;
  bossSpawned: boolean;
  elapsed: number;
  flash: BombFlashState;
  shipQuery: ReturnType<GameContextValue['world']['query']>;
  enemyQuery: ReturnType<GameContextValue['world']['query']>;
  bulletQuery: ReturnType<GameContextValue['world']['query']>;
  posQuery: ReturnType<GameContextValue['world']['query']>;
  bossQuery: ReturnType<GameContextValue['world']['query']>;
  lifetimeQuery: ReturnType<GameContextValue['world']['query']>;
  bounds: { width: number; height: number };
  pendingShake: boolean;
}

export function createPlayScene(deps: PlaySceneDeps): () => Scene {
  const { ctx, atlas, save } = deps;

  return () => {
    let s: PlayState | null = null;

    function initState(): PlayState {
      const coll = new CollisionWorld();
      const state: PlayState = {
        coll,
        spawnCtx: { world: ctx.world, coll, atlas },
        spawner: createSpawnerState(),
        schedule: buildZone1Schedule(deps.seed ?? Date.now() & 0xffffffff),
        spawnEvents: [],
        playerId: -1,
        bossId: -1,
        bossSpawned: false,
        elapsed: 0,
        flash: createBombFlashState(),
        shipQuery: ctx.world.query(Ship),
        enemyQuery: ctx.world.query(Enemy),
        bulletQuery: ctx.world.query(Bullet),
        posQuery: ctx.world.query(Position),
        bossQuery: ctx.world.query(Boss),
        lifetimeQuery: ctx.world.query(Lifetime),
        bounds: { width: 360, height: 640 },
        pendingShake: false,
      };

      const handlePair = (pair: { entityA: number; entityB: number }): void => {
        resolveCollision(ctx.world, state.coll, pair.entityA, pair.entityB, {
          requestShake: () => {
            state.pendingShake = true;
          },
        });
      };
      coll.onTriggerEnter.add(handlePair);
      coll.onCollisionStart.add(handlePair);

      return state;
    }

    function clearWorld(state: PlayState): void {
      const ids: number[] = [];
      for (const id of state.posQuery) ids.push(id);
      for (const id of ids) destroyEntity(ctx.world, state.coll, id);
      state.coll = new CollisionWorld();
      state.spawnCtx.coll = state.coll;
    }

    function refreshBounds(state: PlayState): void {
      state.bounds.width = ctx.camera.viewportWidth || 360;
      state.bounds.height = ctx.camera.viewportHeight || 640;
    }

    return {
      name: 'play',
      ...shellDefaults(),

      onInit() {
        s = initState();
      },

      onEnter() {
        if (!s) return;
        clearWorld(s);
        clearBossFsms();
        s = initState();
        gameState.playerHp = PLAYER_HP_MAX;
        gameState.playerHpMax = PLAYER_HP_MAX;
        gameState.score = 0;
        gameState.bombCharges = START_BOMBS;
        gameState.bossActive = false;
        gameState.bossHp = 0;
        gameState.bossHpMax = 0;
        gameState.gameOver = false;
        gameState.victory = false;
        gameState.currentScene = 'play';
        gameState.runStats = createRunStats();
        notifyStateChanged();

        refreshBounds(s);
        ctx.camera.x = s.bounds.width / 2;
        ctx.camera.y = s.bounds.height / 2;
        ctx.camera.zoom = 1;
        ctx.camera.rotation = 0;
        s.playerId = spawnPlayer(s.spawnCtx, s.bounds.width / 2, s.bounds.height - 90);
      },

      onUpdate(dt: number) {
        if (!s) return;
        if (gameState.gameOver || gameState.victory) {
          resetBombButtonFrame();
          return;
        }

        refreshBounds(s);
        s.elapsed += dt;
        gameState.runStats.durationSec += dt;

        // Player + enemy tick
        const playerPos = ctx.world.get(s.playerId, Position);
        const px = playerPos?.x ?? s.bounds.width / 2;
        const py = playerPos?.y ?? s.bounds.height - 90;
        updatePlayer(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.shipQuery,
          bounds: s.bounds,
        });
        updateEnemyAI(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.enemyQuery,
          playerX: px,
          playerY: py,
        });
        updateBoss(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.bossQuery,
          playerX: px,
          playerY: py,
          bounds: s.bounds,
          onPhaseChange: () => {
            if (gameState.settings.screenShake) ctx.camera.shake(8, 0.3);
          },
          onDefeated: () => {
            if (s) s.bossId = -1;
            gameState.runStats.kills.boss += 1;
            if (gameState.settings.screenShake) ctx.camera.shake(14, 0.6);
            gameState.victory = true;
            gameState.bossActive = false;
            notifyStateChanged();
            void save.commitRun(gameState.score, true);
            void ctx.scenes.go('victory');
          },
          onExplosion: (x: number, y: number) => {
            burstExplosion(ctx.world, atlas, x, y, 14, ((s?.elapsed ?? 0) * 1000) | 1);
          },
        });
        integrate(ctx.world, dt, s.posQuery);

        // Spawning
        s.spawnEvents.length = 0;
        if (!s.bossSpawned) tickSpawner(s.spawner, s.schedule, dt, s.spawnEvents);
        for (const ev of s.spawnEvents) {
          spawnEnemy(s.spawnCtx, ev.pattern, ev.x, ev.y, ev.seed);
        }
        if (!s.bossSpawned && s.elapsed >= BOSS_SPAWN_T) {
          s.bossSpawned = true;
          s.bossId = spawnBoss(s.spawnCtx, s.bounds.width / 2, -40, SMOK_HP_MAX);
          gameState.bossActive = true;
          gameState.bossHpMax = SMOK_HP_MAX;
          gameState.bossHp = SMOK_HP_MAX;
          notifyStateChanged();
        }

        // Bomb
        processBomb(ctx.world, dt, {
          coll: s.coll,
          enemyQuery: s.enemyQuery,
          bossQuery: s.bossQuery,
          flash: s.flash,
        });
        resetBombButtonFrame();
        // Eat any residual justPressed so it can't re-trigger next frame.
        bombButtonState.justPressed = false;

        // Physics
        syncColliders(ctx.world, s.coll, s.posQuery);
        s.coll.step();

        // Cleanup
        cleanup(ctx.world, dt, {
          coll: s.coll,
          bulletQuery: s.bulletQuery,
          enemyQuery: s.enemyQuery,
          shipQuery: s.shipQuery,
          lifetimeQuery: s.lifetimeQuery,
          bounds: s.bounds,
          onEnemyKilled: (score, x, y, pattern) => {
            gameState.score += score;
            gameState.runStats.score = gameState.score;
            gameState.runStats.kills[pattern] += 1;
            burstExplosion(ctx.world, atlas, x, y, 8, (x * 31 + y * 17) | 0 || 1);
            notifyStateChanged();
          },
          onPlayerDown: () => {
            gameState.gameOver = true;
            notifyStateChanged();
            if (gameState.settings.screenShake) ctx.camera.shake(16, 0.7);
            void save.commitRun(gameState.score, false);
            void ctx.scenes.go('game-over');
          },
        });

        if (s.pendingShake) {
          s.pendingShake = false;
          if (gameState.settings.screenShake) ctx.camera.shake(6, 0.2);
        }

        // Publish boss status to HUD state.
        const status = computeBossStatus(ctx.world, s.bossQuery);
        gameState.bossActive = status.alive;
        gameState.bossHp = status.hp;
        gameState.bossHpMax = status.hpMax;
      },

      onExit() {
        if (!s) return;
        clearWorld(s);
        clearBossFsms();
      },
    };
  };
}
