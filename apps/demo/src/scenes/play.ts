import type { GameContextValue, Query, SFXPool, Scene } from '@flare/engine';
import { CollisionWorld, Position } from '@flare/engine';
import type { BeepKey } from '../audio';
import { Boss, type BossPhase, Bullet, Enemy, Hp, Ship } from '../components';
import { Layer } from '../layers';
import type { AtlasHandle, SpawnCtx } from '../spawn';
import { spawnBoss, spawnEnemy, spawnPlayer } from '../spawn';
import { bombButtonState, gameState, notifyStateChanged } from '../state';
import {
  type BombFlashState,
  bombFlashAlpha,
  createBombFlashState,
  tickBombFlash,
  tryBomb,
} from '../systems/bomb';
import { computeBossStatus, updateBoss } from '../systems/boss';
import { cleanup } from '../systems/cleanup';
import { updateEnemyAI } from '../systems/enemy-ai';
import { destroyEntity } from '../systems/entity-ops';
import { integrate } from '../systems/integrate';
import { syncColliders } from '../systems/physics-sync';
import { updatePlayer } from '../systems/player';
import {
  type SpawnEvent,
  type SpawnerState,
  createSpawnerState,
  defaultSchedule,
  tickSpawner,
} from '../systems/spawner';
import { shellDefaults } from './scene-shell';

export interface SfxRef {
  current: SFXPool | null;
}

export interface PlaySceneDeps {
  ctx: GameContextValue;
  atlas: AtlasHandle;
  sfx: SfxRef;
}

const BOSS_HP_MAX = 40;

interface PlayState {
  coll: CollisionWorld;
  spawner: SpawnerState;
  playerId: number;
  bossId: number;
  bossSpawned: boolean;
  spawnEvents: SpawnEvent[];
  flash: BombFlashState;
  shipQuery: Query;
  enemyQuery: Query;
  bulletQuery: Query;
  posQuery: Query;
  allMoversQuery: Query;
  bossQuery: Query;
}

function playSfx(sfx: SFXPool | null, key: BeepKey, volume = 1): void {
  sfx?.play(key, { volume });
}

function isBossInvulnerable(world: GameContextValue['world'], id: number): boolean {
  const boss = world.get(id, Boss);
  if (!boss) return false;
  return boss.phase === 'entering' || boss.phase === 'dying' || boss.phase === 'defeated';
}

function resolveCollision(
  world: GameContextValue['world'],
  state: PlayState,
  a: number,
  b: number,
  sfx: SFXPool | null,
): void {
  const bulletA = world.get(a, Bullet);
  const bulletB = world.get(b, Bullet);
  const shipA = world.get(a, Ship);
  const shipB = world.get(b, Ship);
  const enemyA = world.get(a, Enemy);
  const enemyB = world.get(b, Enemy);
  const bossA = world.has(a, Boss);
  const bossB = world.has(b, Boss);

  const bullet = bulletA ?? bulletB;
  const bulletId = bulletA ? a : bulletB ? b : -1;
  const otherId = bulletA ? b : bulletB ? a : -1;

  if (bullet && bulletId !== -1 && otherId !== -1) {
    if (bullet.ownerLayer === Layer.player) {
      if (world.has(otherId, Boss) && isBossInvulnerable(world, otherId)) {
        destroyEntity(world, state.coll, bulletId);
        return;
      }
      const hp = world.get(otherId, Hp);
      if (hp) {
        hp.current -= bullet.damage;
        playSfx(sfx, 'hit', 0.5);
      }
    } else {
      const hp = world.get(otherId, Hp);
      if (hp) {
        hp.current -= bullet.damage;
        playSfx(sfx, 'hit', 0.8);
        if (world.has(otherId, Ship)) {
          gameState.playerHp = Math.max(0, hp.current);
          notifyStateChanged();
        }
      }
    }
    destroyEntity(world, state.coll, bulletId);
    return;
  }

  const shipHit = shipA || shipB;
  const otherHit = (shipA && (enemyB || bossB)) || (shipB && (enemyA || bossA));
  if (shipHit && otherHit) {
    const shipId = shipA ? a : b;
    const otherBodyId = shipA ? b : a;
    const shipHp = world.get(shipId, Hp);
    if (shipHp) {
      shipHp.current -= 1;
      gameState.playerHp = Math.max(0, shipHp.current);
      notifyStateChanged();
    }
    if (!world.has(otherBodyId, Boss)) {
      destroyEntity(world, state.coll, otherBodyId);
    }
    playSfx(sfx, 'explode', 0.6);
  }
}

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
        flash: createBombFlashState(),
        shipQuery: ctx.world.query(Ship),
        enemyQuery: ctx.world.query(Enemy),
        bulletQuery: ctx.world.query(Bullet),
        posQuery: ctx.world.query(Position),
        allMoversQuery: ctx.world.query(Position),
        bossQuery: ctx.world.query(Boss),
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
    }

    function publishBossStatus(s: PlayState): void {
      const status = computeBossStatus(ctx.world, s.bossQuery);
      const wasActive = gameState.bossActive;
      const visible = status.alive && status.phase !== 'defeated';
      const activeNow = visible && status.phase !== 'entering';
      if (
        gameState.bossActive !== activeNow ||
        gameState.bossHp !== status.hp ||
        gameState.bossHpMax !== status.hpMax
      ) {
        gameState.bossActive = activeNow;
        gameState.bossHp = status.hp;
        gameState.bossHpMax = status.hpMax;
        notifyStateChanged();
      } else if (!activeNow && wasActive) {
        notifyStateChanged();
      }
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
        gameState.currentScene = 'play';
        notifyStateChanged();

        const w = ctx.camera.viewportWidth || 360;
        const h = ctx.camera.viewportHeight || 640;
        ctx.camera.x = w / 2;
        ctx.camera.y = h / 2;
        ctx.camera.zoom = 1;
        ctx.camera.rotation = 0;
        state.playerId = spawnPlayer({ world: ctx.world, coll: state.coll, atlas }, w / 2, h - 90);
      },

      onUpdate(dt: number) {
        if (!state) return;
        const s = state;
        const w = ctx.camera.viewportWidth || 360;
        const h = ctx.camera.viewportHeight || 640;
        const bounds = { width: w, height: h };

        const player = ctx.world.get(s.playerId, Position);
        const playerX = player?.x ?? w / 2;
        const playerY = player?.y ?? h - 90;

        const spawnCtx: SpawnCtx = { world: ctx.world, coll: s.coll, atlas };

        updatePlayer(ctx.world, dt, {
          spawnCtx,
          query: s.shipQuery,
          bounds,
          onShoot: () => playSfx(sfxRef.current, 'shoot', 0.4),
        });

        updateEnemyAI(ctx.world, dt, {
          spawnCtx,
          query: s.enemyQuery,
          playerX,
          playerY,
        });

        updateBoss(ctx.world, dt, {
          spawnCtx,
          query: s.bossQuery,
          playerX,
          playerY,
          bounds,
          onPhaseChange: () => {
            playSfx(sfxRef.current, 'hit', 0.7);
          },
          onDefeated: () => {
            s.bossId = -1;
          },
          onExplosion: () => {
            playSfx(sfxRef.current, 'explode', 0.5);
          },
        });

        integrate(ctx.world, dt, s.allMoversQuery);

        s.spawnEvents.length = 0;
        tickSpawner(s.spawner, defaultSchedule, dt, s.spawnEvents);
        for (const ev of s.spawnEvents) {
          spawnEnemy(spawnCtx, ev.pattern, ev.x, ev.y);
        }

        if (s.spawner.done && !s.bossSpawned && s.enemyQuery.count === 0) {
          s.bossId = spawnBoss(spawnCtx, w / 2, -40, BOSS_HP_MAX);
          s.bossSpawned = true;
          gameState.bossHpMax = BOSS_HP_MAX;
          gameState.bossHp = BOSS_HP_MAX;
          notifyStateChanged();
        }

        const newCharges = tryBomb(ctx.world, gameState.bombCharges, bombButtonState.justPressed, {
          coll: s.coll,
          enemyQuery: s.enemyQuery,
          bulletQuery: s.bulletQuery,
          bossQuery: s.bossQuery,
          flash: s.flash,
          onBossHit: () => playSfx(sfxRef.current, 'hit', 0.9),
          onEnemyCleared: () => playSfx(sfxRef.current, 'bomb', 0.8),
        });
        if (newCharges !== gameState.bombCharges) {
          gameState.bombCharges = newCharges;
          notifyStateChanged();
        }
        tickBombFlash(s.flash, dt);
        const nextAlpha = bombFlashAlpha(s.flash);
        if (Math.abs(gameState.bombFlashAlpha - nextAlpha) > 0.001) {
          gameState.bombFlashAlpha = nextAlpha;
          notifyStateChanged();
        }

        syncColliders(ctx.world, s.coll, s.posQuery);
        s.coll.step();

        cleanup(ctx.world, dt, {
          coll: s.coll,
          bulletQuery: s.bulletQuery,
          enemyQuery: s.enemyQuery,
          shipQuery: s.shipQuery,
          bounds,
          onEnemyKilled: (score) => {
            gameState.score += score;
            notifyStateChanged();
            playSfx(sfxRef.current, 'explode', 0.7);
          },
          onPlayerDown: () => {
            gameState.gameOver = true;
            notifyStateChanged();
            playSfx(sfxRef.current, 'explode', 1);
          },
        });

        publishBossStatus(s);

        if (gameState.gameOver) {
          void ctx.scenes.go('game-over');
          return;
        }
        const phase: BossPhase | null = s.bossSpawned
          ? (computeBossStatus(ctx.world, s.bossQuery).phase ?? null)
          : null;
        const bossDone = s.bossSpawned && (!s.bossQuery.count || phase === 'defeated');
        if (s.spawner.done && bossDone && !gameState.victory) {
          gameState.victory = true;
          gameState.bossActive = false;
          notifyStateChanged();
          void ctx.scenes.go('victory');
        }
      },

      onExit() {
        if (!state) return;
        clearWorld(state);
        sfxRef.current?.stopAll();
      },
    };
  };
}
