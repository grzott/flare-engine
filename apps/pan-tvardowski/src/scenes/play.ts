import type { GameContextValue, Scene } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';
import { CollisionWorld } from '@flare-engine/physics';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';
import type { AudioHandles } from '../audio/init';
import { setZoneMusic } from '../audio/init';
import type { MusicKey } from '../audio/synth';
import { type TilemapBgController, createZone3TilemapBg } from '../bg/tilemap-bg';
import { Boss, Bullet, Enemy, Lifetime, Miniboss, Ship } from '../components';
import { DZIWOZONA_SKRZAT_SPAWN, PLAYER_HP_MAX, START_BOMBS } from '../config/gameplay';
import type { ZoneConfig } from '../config/zones';
import { ZONES } from '../config/zones';
import type { ZoneId } from '../events';
import { gameEvents } from '../events';
import { type PostFxController, createPanTvardowskiPostFx } from '../fx/postfx';
import {
  type ZoneBannerState,
  createZoneBannerState,
  showZoneBanner,
  updateZoneBanner,
} from '../hud/zone-banner';
import { burstExplosion } from '../particles';
import type { SaveStore } from '../save/store';
import {
  type AtlasHandle,
  type SpawnCtx,
  spawnBoss,
  spawnEnemy,
  spawnMiniboss,
  spawnPlayer,
} from '../spawn';
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
import { clearMinibossFsms, computeMinibossStatus, updateMiniboss } from '../systems/miniboss';
import { syncColliders } from '../systems/physics-sync';
import { updatePlayer } from '../systems/player';
import {
  type SpawnEvent,
  type SpawnerState,
  createSpawnerState,
  tickSpawner,
} from '../systems/spawner';
import { countTopielecMinions } from '../systems/wodnik';
import { shellDefaults } from './scene-shell';

export interface AudioRef {
  current: AudioHandles | null;
}

export interface PlayRenderHooks {
  background: ((ctx: GameContextValue, canvas: unknown) => void) | null;
  postfx: ((ctx: GameContextValue, canvas: unknown) => void) | null;
}

export interface PlaySceneDeps {
  ctx: GameContextValue;
  atlas: AtlasHandle;
  save: SaveStore;
  audio?: AudioRef;
  /** Seed for the wave schedule. Tests override; runtime uses Date.now(). */
  seed?: number;
  /** Skia module for postfx. Tests may pass null (runtime → unsupported passthrough). */
  skia?: SkiaPostFxModuleLike | null;
  /** Mutable ref the scene populates so <GameView>'s hooks can dispatch to it. */
  renderHooks?: PlayRenderHooks;
}

const ZONE_MUSIC: Record<ZoneId, MusicKey> = {
  z1: 'zone1',
  z2: 'zone2',
  z3: 'zone3',
  z4: 'zone4',
  z5: 'zone5',
};

interface PlayState {
  zone: ZoneConfig;
  coll: CollisionWorld;
  spawnCtx: SpawnCtx;
  spawner: SpawnerState;
  schedule: ReturnType<ZoneConfig['buildSchedule']>;
  spawnEvents: SpawnEvent[];
  playerId: number;
  bossId: number;
  bossSpawned: boolean;
  minibossId: number;
  minibossSpawned: boolean;
  minibossDefeated: boolean;
  elapsed: number;
  flash: BombFlashState;
  banner: ZoneBannerState;
  shipQuery: ReturnType<GameContextValue['world']['query']>;
  enemyQuery: ReturnType<GameContextValue['world']['query']>;
  bulletQuery: ReturnType<GameContextValue['world']['query']>;
  posQuery: ReturnType<GameContextValue['world']['query']>;
  bossQuery: ReturnType<GameContextValue['world']['query']>;
  minibossQuery: ReturnType<GameContextValue['world']['query']>;
  lifetimeQuery: ReturnType<GameContextValue['world']['query']>;
  bounds: { width: number; height: number };
  pendingShake: boolean;
  viewportReady: boolean;
  /** Zone 3 only — drives the scrolling water + fog background. */
  tilemapBg: TilemapBgController | null;
  /** Previous-frame playerHp — used to detect damage and flash postfx. */
  lastPlayerHp: number;
}

export function createPlayScene(deps: PlaySceneDeps): () => Scene {
  const { ctx, atlas, save } = deps;
  const audioRef = deps.audio;
  const postfx: PostFxController = createPanTvardowskiPostFx(deps.skia ?? null);

  return () => {
    let s: PlayState | null = null;

    function initState(zoneId: ZoneId): PlayState {
      const zone = ZONES[zoneId];
      const coll = new CollisionWorld();
      const state: PlayState = {
        zone,
        coll,
        spawnCtx: { world: ctx.world, coll, atlas },
        spawner: createSpawnerState(),
        schedule: zone.buildSchedule(deps.seed ?? Date.now() & 0xffffffff),
        spawnEvents: [],
        playerId: -1,
        bossId: -1,
        bossSpawned: false,
        minibossId: -1,
        minibossSpawned: false,
        minibossDefeated: zone.minibossPattern === null,
        elapsed: 0,
        flash: createBombFlashState(),
        banner: createZoneBannerState(),
        shipQuery: ctx.world.query(Ship),
        enemyQuery: ctx.world.query(Enemy),
        bulletQuery: ctx.world.query(Bullet),
        posQuery: ctx.world.query(Position),
        bossQuery: ctx.world.query(Boss),
        minibossQuery: ctx.world.query(Miniboss),
        lifetimeQuery: ctx.world.query(Lifetime),
        bounds: { width: 360, height: 640 },
        pendingShake: false,
        viewportReady: false,
        tilemapBg: null,
        lastPlayerHp: PLAYER_HP_MAX,
      };

      const handlePair = (pair: { entityA: number; entityB: number }): void => {
        resolveCollision(ctx.world, state.coll, pair.entityA, pair.entityB, {
          requestShake: () => {
            state.pendingShake = true;
            audioRef?.current?.pool.play('hit');
          },
        });
      };
      coll.onTriggerEnter.add(handlePair);
      coll.onCollisionStart.add(handlePair);

      return state;
    }

    function clearWorld(state: PlayState): void {
      if (state.tilemapBg) {
        state.tilemapBg.destroy();
        state.tilemapBg = null;
      }
      const ids: number[] = [];
      for (const id of state.posQuery) ids.push(id);
      for (const id of ids) destroyEntity(ctx.world, state.coll, id);
      state.coll = new CollisionWorld();
      state.spawnCtx.coll = state.coll;
    }

    function refreshBounds(state: PlayState): void {
      const vw = ctx.camera.viewportWidth;
      const vh = ctx.camera.viewportHeight;
      const hasViewport = vw > 0 && vh > 0;
      const prevW = state.bounds.width;
      state.bounds.width = hasViewport ? vw : 360;
      state.bounds.height = hasViewport ? vh : 640;
      // Keep the camera centered on the current viewport so the world isn't
      // offset when the real device layout arrives after the scene mounts.
      ctx.camera.x = state.bounds.width / 2;
      ctx.camera.y = state.bounds.height / 2;
      // First real layout: re-anchor entities that were placed against the
      // fallback 360-wide bounds so they sit on the new viewport midline.
      if (hasViewport && !state.viewportReady) {
        state.viewportReady = true;
        const dx = state.bounds.width / 2 - prevW / 2;
        if (dx !== 0) {
          const recenter = (id: number): void => {
            if (id < 0) return;
            const p = ctx.world.get(id, Position);
            if (p) p.x += dx;
          };
          recenter(state.playerId);
          recenter(state.bossId);
          recenter(state.minibossId);
        }
      }
    }

    function setupZoneHud(zone: ZoneConfig): void {
      gameState.currentZone = zone.id;
      gameState.bossNameKey = zone.bossNameKey;
      gameState.minibossNameKey =
        zone.minibossPattern !== null ? `minibosses.${zone.minibossPattern}.name` : '';
      const zoneNum = zone.id.slice(1); // 'z1' → '1', 'z3' → '3'
      gameState.zoneBanner.nameKey = `zones.${zoneNum}.name`;
      gameState.zoneBanner.subtitleKey = `zones.${zoneNum}.subtitle`;
    }

    function startZone(zoneId: ZoneId, fullReset: boolean): void {
      if (s) {
        clearWorld(s);
      }
      clearBossFsms();
      clearMinibossFsms();
      s = initState(zoneId);

      if (fullReset) {
        gameState.playerHp = PLAYER_HP_MAX;
        gameState.playerHpMax = PLAYER_HP_MAX;
        gameState.score = 0;
        gameState.bombCharges = START_BOMBS;
        gameState.runStats = createRunStats();
      }
      gameState.bossActive = false;
      gameState.bossHp = 0;
      gameState.bossHpMax = 0;
      gameState.minibossActive = false;
      gameState.minibossHp = 0;
      gameState.minibossHpMax = 0;
      gameState.gameOver = false;
      gameState.victory = false;
      gameState.currentScene = 'play';
      setupZoneHud(s.zone);
      showZoneBanner(s.banner);
      gameState.zoneBanner.visible = true;
      gameState.zoneBanner.opacity = 0;
      notifyStateChanged();

      refreshBounds(s);
      ctx.camera.x = s.bounds.width / 2;
      ctx.camera.y = s.bounds.height / 2;
      ctx.camera.zoom = 1;
      ctx.camera.rotation = 0;
      s.playerId = spawnPlayer(s.spawnCtx, s.bounds.width / 2, s.bounds.height - 90);

      if (zoneId === 'z3') {
        s.tilemapBg = createZone3TilemapBg({
          world: ctx.world,
          atlas,
          viewportWidth: s.bounds.width,
          viewportHeight: s.bounds.height,
        });
      }

      setZoneMusic(audioRef?.current?.music ?? null, ZONE_MUSIC[zoneId]);
      gameEvents.emit('zone-start', zoneId);
    }

    if (deps.renderHooks) {
      // Background: tile entities live in the ECS world so the sprite system
      // draws them naturally — no raw canvas work needed here.
      deps.renderHooks.background = null;
      deps.renderHooks.postfx = (_ctx, _canvas) => {
        if (!s) return;
        // Build the per-frame compiled pass list. Visible pixel application
        // awaits the GameView SkCanvas bridge — see M3 change-log entry.
        postfx.buildPass(s.bounds.width, s.bounds.height);
      };
    }

    return {
      name: 'play',
      ...shellDefaults(),

      onInit() {
        s = initState(gameState.currentZone);
      },

      onEnter() {
        startZone(gameState.currentZone, true);
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

        if (s.tilemapBg) s.tilemapBg.update(dt, s.bounds.height);
        postfx.update(dt);

        // Hit-flash on player damage: diff playerHp against last observed value.
        if (gameState.playerHp < s.lastPlayerHp) postfx.triggerHitFlash();
        s.lastPlayerHp = gameState.playerHp;

        updateZoneBanner(s.banner, dt);
        if (
          gameState.zoneBanner.visible !== s.banner.visible ||
          Math.abs(gameState.zoneBanner.opacity - s.banner.opacity) > 0.01
        ) {
          gameState.zoneBanner.visible = s.banner.visible;
          gameState.zoneBanner.opacity = s.banner.opacity;
          notifyStateChanged();
        }

        // Player + enemy tick
        const playerPos = ctx.world.get(s.playerId, Position);
        const px = playerPos?.x ?? s.bounds.width / 2;
        const py = playerPos?.y ?? s.bounds.height - 90;
        updatePlayer(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.shipQuery,
          bounds: s.bounds,
          onShoot: () => {
            audioRef?.current?.pool.play('shoot');
          },
        });
        updateEnemyAI(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.enemyQuery,
          playerX: px,
          playerY: py,
          bounds: s.bounds,
        });
        updateMiniboss(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.minibossQuery,
          playerX: px,
          playerY: py,
          bounds: s.bounds,
          onPhaseChange: () => {
            if (gameState.settings.screenShake) ctx.camera.shake(4, 0.18);
          },
          onFormChange: (form) => {
            if (!s) return;
            gameEvents.emit('miniboss-form-change', s.zone.id, form);
          },
          onDefeated: () => {
            if (!s) return;
            s.minibossId = -1;
            s.minibossDefeated = true;
            gameState.runStats.kills.miniboss += 1;
            if (gameState.settings.screenShake) ctx.camera.shake(10, 0.45);
            gameState.minibossActive = false;
            gameEvents.emit('miniboss-defeated', s.zone.id);
            notifyStateChanged();
          },
          onExplosion: (x: number, y: number) => {
            burstExplosion(ctx.world, atlas, x, y, 12, ((s?.elapsed ?? 0) * 1000) | 1);
            audioRef?.current?.pool.play('explode');
          },
        });
        updateBoss(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.bossQuery,
          playerX: px,
          playerY: py,
          bounds: s.bounds,
          onPhaseChange: (phase) => {
            if (gameState.settings.screenShake) ctx.camera.shake(8, 0.3);
            postfx.triggerHitFlash();
            if (s) gameEvents.emit('boss-phase-change', s.zone.id, phase);
          },
          onSpawnShieldMinion: (x, y) => {
            if (!s) return;
            spawnEnemy(s.spawnCtx, 'topielec', x, y, (x * 53 + y * 11) | 1);
          },
          countShieldMinions: () => {
            if (!s) return 0;
            return countTopielecMinions(ctx.world, s.enemyQuery);
          },
          onShieldBroken: () => {
            if (!s) return;
            postfx.triggerHitFlash();
            gameEvents.emit('boss-shield-broken', s.zone.id);
          },
          onSpawnSummon: (x, y) => {
            if (!s) return;
            spawnEnemy(s.spawnCtx, 'bies', x, y, ((x * 41 + y * 19) | 1) >>> 0);
            gameEvents.emit('boss-summon', s.zone.id, 'bies');
          },
          onDefeated: () => {
            if (!s) return;
            s.bossId = -1;
            gameState.runStats.kills.boss += 1;
            if (gameState.settings.screenShake) ctx.camera.shake(14, 0.6);
            gameState.bossActive = false;
            gameEvents.emit('zone-complete', s.zone.id, gameState.score);
            const next = s.zone.nextZone;
            if (next) {
              gameState.currentZone = next;
              notifyStateChanged();
              startZone(next, false);
            } else {
              gameState.victory = true;
              notifyStateChanged();
              void save.commitRun(gameState.score, true);
              void ctx.scenes.go('victory');
            }
          },
          onExplosion: (x: number, y: number) => {
            burstExplosion(ctx.world, atlas, x, y, 14, ((s?.elapsed ?? 0) * 1000) | 1);
            audioRef?.current?.pool.play('explode');
          },
        });
        integrate(ctx.world, dt, s.posQuery);

        // Spawning — halt regular spawns while miniboss or boss is on screen.
        s.spawnEvents.length = 0;
        const gateOpen = !s.bossSpawned && !gameState.minibossActive;
        if (gateOpen) tickSpawner(s.spawner, s.schedule, dt, s.spawnEvents);
        for (const ev of s.spawnEvents) {
          // Topielec emerges from the bottom of the arena, not the top.
          const y = ev.pattern === 'topielec' ? s.bounds.height + 40 : ev.y;
          spawnEnemy(s.spawnCtx, ev.pattern, ev.x, y, ev.seed);
        }
        if (
          !s.minibossSpawned &&
          s.zone.minibossPattern !== null &&
          s.elapsed >= s.zone.minibossT
        ) {
          s.minibossSpawned = true;
          s.minibossId = spawnMiniboss(
            s.spawnCtx,
            s.zone.minibossPattern,
            s.bounds.width / 2,
            -40,
            s.zone.minibossHp,
          );
          gameState.minibossActive = true;
          gameState.minibossHpMax = s.zone.minibossHp;
          gameState.minibossHp = s.zone.minibossHp;
          notifyStateChanged();
        }
        if (!s.bossSpawned && s.minibossDefeated && s.elapsed >= s.zone.bossT) {
          s.bossSpawned = true;
          s.bossId = spawnBoss(
            s.spawnCtx,
            s.zone.bossPattern,
            s.bounds.width / 2,
            -40,
            s.zone.bossHp,
          );
          gameState.bossActive = true;
          gameState.bossHpMax = s.zone.bossHp;
          gameState.bossHp = s.zone.bossHp;
          notifyStateChanged();
        }

        // Bomb
        processBomb(ctx.world, dt, {
          coll: s.coll,
          enemyQuery: s.enemyQuery,
          bossQuery: s.bossQuery,
          minibossQuery: s.minibossQuery,
          flash: s.flash,
          onFired: () => {
            audioRef?.current?.pool.play('bomb');
          },
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
            audioRef?.current?.pool.play('explode');
            // Dziwożona splits on death — spawn DZIWOZONA_SKRZAT_SPAWN Skrzats.
            if (pattern === 'dziwozona' && s) {
              const halfCount = (DZIWOZONA_SKRZAT_SPAWN - 1) / 2;
              for (let i = 0; i < DZIWOZONA_SKRZAT_SPAWN; i++) {
                const offset = (i - halfCount) * 28;
                spawnEnemy(
                  s.spawnCtx,
                  'skrzat',
                  x + offset,
                  y,
                  ((x * 13 + y * 7 + i * 101) | 0) >>> 0 || 1,
                );
              }
            }
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
        // Publish Wodnik shield state for HUD + collision gating.
        let shieldActive = false;
        for (const bid of s.bossQuery) {
          const b = ctx.world.get(bid, Boss);
          if (b) {
            shieldActive = b.shieldActive;
            break;
          }
        }
        if (gameState.bossShieldActive !== shieldActive) {
          gameState.bossShieldActive = shieldActive;
          notifyStateChanged();
        }
        const mbStatus = computeMinibossStatus(ctx.world, s.minibossQuery);
        gameState.minibossActive = mbStatus.alive;
        gameState.minibossHp = mbStatus.hp;
        gameState.minibossHpMax = mbStatus.hpMax;
      },

      onExit() {
        if (!s) return;
        clearWorld(s);
        clearBossFsms();
        clearMinibossFsms();
        gameState.bossShieldActive = false;
        if (deps.renderHooks) {
          deps.renderHooks.background = null;
          deps.renderHooks.postfx = null;
        }
        audioRef?.current?.pool.stopAll();
      },
    };
  };
}
