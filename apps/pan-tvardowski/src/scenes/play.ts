import type { A11yBridge } from '@flare-engine/a11y';
import { type Tween, resetTween, tween, updateTween } from '@flare-engine/animation';
import type { SpriteFrame } from '@flare-engine/assets';
import { getFrame } from '@flare-engine/assets';
import type { GameContextValue, Scene } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';
import type { EntitlementStore } from '@flare-engine/iap';
import { canAccessContent } from '@flare-engine/iap';
import { easeInCubic, easeOutBack, easeOutExpo } from '@flare-engine/math';
import { CollisionWorld } from '@flare-engine/physics';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';
import { Sprite } from '@flare-engine/render';
import { applyShake } from '../a11y/reduced-motion';
import type { AudioHandles } from '../audio/init';
import { playSfx, setZoneMusic } from '../audio/init';
import { type Zone3BgController, createZone3Bg } from '../bg/zone3-bg';
import {
  Boss,
  Bullet,
  Enemy,
  Lifetime,
  Miniboss,
  MirrorTwin,
  Ship,
  SpiralCollapse,
} from '../components';
import {
  BAZYLISZEK_GAZE_SPEED_MUL,
  DZIWOZONA_SKRZAT_SPAWN,
  PLAYER_HP_MAX,
  START_BOMBS,
} from '../config/gameplay';
import type { ZoneConfig } from '../config/zones';
import { ZONES } from '../config/zones';
import type { DialogueController } from '../dialogue';
import {
  createOpeningGraph,
  createVictoryGraph,
  createZone7EntryGraph,
  createZone8IntroGraph,
} from '../dialogue';
import type { ZoneId } from '../events';
import { gameEvents } from '../events';
import type { AmbienceState } from '../fx/ambience';
import { createAmbienceState, tickAmbience } from '../fx/ambience';
import {
  checkFpsWatchdog,
  consumeSubShapeDrawCount,
  recordBudget,
  recordFrameTime,
  recordSubShapeDraws,
  resetFpsRing,
} from '../fx/budget';
import { resetCataclysmGate, triggerExplosion, triggerSpiralCollapse } from '../fx/explosions';
import { type PanPostFxController, createPanTvardowskiPostFx } from '../fx/postfx';
import {
  type ZoneBannerState,
  createZoneBannerState,
  showZoneBanner,
  updateZoneBanner,
} from '../hud/zone-banner';
import type { EntitlementFallbackHandler } from '../iap/fallback';
import { Layer } from '../layers';
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
import { countHounds, spawnPuddle } from '../systems/bazyliszek';
import { type BombFlashState, createBombFlashState, processBomb } from '../systems/bomb';
import { clearBossFsms, computeBossStatus, updateBoss } from '../systems/boss';
import { cleanup } from '../systems/cleanup';
import { resolveCollision } from '../systems/collision';
import { updateEnemyAI } from '../systems/enemy-ai';
import { destroyEntity } from '../systems/entity-ops';
import { integrate } from '../systems/integrate';
import {
  despawnMirrorTwin,
  spawnFirepit,
  spawnMirrorTwin,
  spawnSpikeLane,
  updateMirrorTwin,
} from '../systems/mefistofeles';
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
import { ZONE_PALETTES } from '../visual-spec/zones-palette';
import { shellDefaults } from './scene-shell';

// Pre-computed sub-shape counts per atlas frame: hull(1) + weapons.length + engine(1).
// Derived from SHAPE_CATALOGUE entries. Update if new ship entries are added.
const SHIP_SUB_SHAPES: Record<string, number> = {
  // enemies
  skrzat: 3,
  latawiec: 4,
  czart: 4,
  bies: 4,
  licho: 3,
  strzyga: 4,
  topielec: 4,
  mamuna: 4,
  nocnica: 3,
  poludnica: 4,
  wapierz: 4,
  hound: 4,
  dziwozona: 4,
  'moon-wraith': 3,
  // minibosses
  rokita: 4,
  leszy: 5,
  'nocny-lowca': 5,
  madej: 4,
  // bosses
  'smok-krzemionkowski': 4,
  'borowy-krol': 5,
  'wodnik-wislanny': 4,
  boruta: 6,
  'baba-jaga': 4,
  'bazyliszek-warszawski': 6,
  mefistofeles: 5,
  'lucyper-ksiezycowy': 6,
  // player ships
  'kogut-zloty': 4,
  alembik: 4,
  zwierciadlo: 4,
};

// Bullet flicker cadence state — module-level to survive scene re-entry.
// Phase alternates at 8 Hz (125 ms period). Reset is intentionally not done
// on zone start: a mid-sequence phase is imperceptible to the player.
let bulletFlickerAccum = 0;
let bulletFlickerPhase = 0;

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
  /** Optional a11y bridge — attaches camera + postfx so reduced-motion scales
   *  screen-shake and postfx intensity globally. */
  a11y?: A11yBridge;
  /** Dialogue controller — pauses gameplay while a graph is running. */
  dialogue?: DialogueController;
  /** Entitlement store — guards zone transitions for premium zones. */
  entitlementStore?: EntitlementStore;
  /** Fallback handler — allows stale-access when entitlement check fails. */
  entitlementFallback?: EntitlementFallbackHandler;
  /** Returns the current safe-area bottom inset in logical pixels. Called on
   *  every refreshBounds so orientation changes are reflected automatically.
   *  Subtracted from the play-area height used for player clamp, spawn position,
   *  and entity cull. The canvas stays full-bleed — only gameplay logic is
   *  reduced. Defaults to () => 0 when absent. */
  getBottomInset?: () => number;
}

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
  mirrorTwinQuery: ReturnType<GameContextValue['world']['query']>;
  spiralCollapseQuery: ReturnType<GameContextValue['world']['query']>;
  bounds: { width: number; height: number };
  pendingShake: boolean;
  viewportReady: boolean;
  /** Zone 3 only — water + fog shader background entities. */
  zone3Bg: Zone3BgController | null;
  /** Previous-frame playerHp — used to detect damage and flash postfx. */
  lastPlayerHp: number;
  /** Set in onExit — deferred / signal-driven callbacks bail out when true
   *  so a zone-transition or scene.go() mid-frame can't touch a stale world. */
  disposed: boolean;
  /** Accumulated seconds since last auto-save. Resets on each persist call. */
  autoSaveAccum: number;
  /** Parallax-particle ambience state for the current zone. Null while not in play. */
  ambience: AmbienceState | null;
  /** Folio XIV M2: boss-bar fade-in tween (easeOutExpo 600 ms). */
  bossBarTween: Tween;
  /** Folio XIV M2: game-over overlay fade-in tween (easeInCubic 1200 ms). */
  gameOverTween: Tween;
  /** Folio XIV M1 item 5: combo-pulse tween (easeOutBack 120 ms). */
  comboPulseTween: Tween;
  /** Session #151: pre-looked-up enemy-bullet sprite frames for zero-alloc flicker swap. */
  bulletFrameA: SpriteFrame;
  bulletFrameB: SpriteFrame;
}

export function createPlayScene(deps: PlaySceneDeps): () => Scene {
  const { ctx, atlas, save } = deps;
  const getBottomInset = deps.getBottomInset ?? (() => 0);
  const audioRef = deps.audio;
  const postfx: PanPostFxController = createPanTvardowskiPostFx(deps.skia ?? null);
  // Attach the a11y bridge once — reduced-motion then drives camera.motionScale
  // and postfx.setMotionScale automatically through the manager's onChange.
  if (deps.a11y) {
    deps.a11y.attachCamera(ctx.camera);
    deps.a11y.attachPostfx(postfx);
  }

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
        mirrorTwinQuery: ctx.world.query(MirrorTwin),
        spiralCollapseQuery: ctx.world.query(SpiralCollapse),
        bounds: { width: 360, height: 640 },
        pendingShake: false,
        viewportReady: false,
        zone3Bg: null,
        lastPlayerHp: PLAYER_HP_MAX,
        disposed: false,
        autoSaveAccum: 0,
        ambience: null,
        bossBarTween: { ...tween(0, 1, 0.6, easeOutExpo), done: true },
        gameOverTween: { ...tween(0, 1, 1.2, easeInCubic), done: true },
        comboPulseTween: { ...tween(1, 1.18, 0.12, easeOutBack), done: true },
        bulletFrameA: (() => {
          const f = getFrame(atlas.sheet, 'enemy-bullet-a');
          if (!f) throw new Error('pan-tvardowski: missing sprite frame "enemy-bullet-a"');
          return f;
        })(),
        bulletFrameB: (() => {
          const f = getFrame(atlas.sheet, 'enemy-bullet-b');
          if (!f) throw new Error('pan-tvardowski: missing sprite frame "enemy-bullet-b"');
          return f;
        })(),
      };

      const handlePair = (pair: { entityA: number; entityB: number }): void => {
        if (state.disposed) return;
        resolveCollision(ctx.world, state.coll, pair.entityA, pair.entityB, {
          requestShake: () => {
            state.pendingShake = true;
            playSfx(audioRef?.current, 'hit');
          },
        });
      };
      coll.onTriggerEnter.add(handlePair);
      coll.onCollisionStart.add(handlePair);

      return state;
    }

    function clearWorld(state: PlayState): void {
      if (state.zone3Bg) {
        state.zone3Bg.destroy();
        state.zone3Bg = null;
      }
      const ids: number[] = [];
      for (const id of state.posQuery) ids.push(id);
      for (const id of ids) destroyEntity(ctx.world, state.coll, id);
      state.coll = new CollisionWorld();
      state.spawnCtx.coll = state.coll;
      state.ambience = null;
    }

    function refreshBounds(state: PlayState): void {
      const vw = ctx.camera.viewportWidth;
      const vh = ctx.camera.viewportHeight;
      const hasViewport = vw > 0 && vh > 0;
      const prevW = state.bounds.width;
      state.bounds.width = hasViewport ? vw : 360;
      // Subtract the safe-area bottom inset so gameplay logic (player clamp,
      // spawn Y, entity cull) never uses the occluded region. The canvas and
      // camera remain full-bleed — only the logical play-area is reduced.
      state.bounds.height = (hasViewport ? vh : 640) - getBottomInset();
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
      resetCataclysmGate(zoneId);
      if (s) {
        clearWorld(s);
      }
      clearBossFsms();
      clearMinibossFsms();
      s = initState(zoneId);
      s.ambience = createAmbienceState(ctx.world, atlas);

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
      gameState.comboCount = 0;
      gameState.comboHit = false;
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
        s.zone3Bg = createZone3Bg({
          world: ctx.world,
          atlas,
          viewportWidth: s.bounds.width,
          viewportHeight: s.bounds.height,
        });
      }

      postfx.setCrtEnabled(zoneId === 'z8');
      setZoneMusic(audioRef?.current?.music ?? null, s.zone.music);
      gameEvents.emit('zone-start', zoneId);

      // M7: play the zone-entry dialogue (if any) before the first wave spawns.
      // The dialogue controller sets gameState.dialogue; the main update loop
      // treats that as a hard pause gate.
      const dlg = deps.dialogue;
      if (dlg && zoneId === 'z1' && !save.introSeen()) {
        dlg.play(createOpeningGraph(), () => {
          void save.markIntroSeen();
        });
      } else if (dlg && zoneId === 'z7') {
        dlg.play(createZone7EntryGraph());
      } else if (dlg && zoneId === 'z8') {
        dlg.play(createZone8IntroGraph());
      }

      void save.persist();
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
        resetFpsRing();
        startZone(gameState.currentZone, true);
      },

      onUpdate(dt: number) {
        if (!s || s.disposed) return;
        if (gameState.gameOver || gameState.victory) {
          resetBombButtonFrame();
          return;
        }
        // Pause gameplay while a dialogue graph is on screen. Camera + postfx
        // keep ticking so the banner can fade; sim systems are gated below.
        if (gameState.dialogue !== null) {
          refreshBounds(s);
          postfx.update(dt);
          resetBombButtonFrame();
          return;
        }

        refreshBounds(s);
        s.elapsed += dt;
        gameState.runStats.durationSec += dt;

        s.autoSaveAccum += dt;
        if (s.autoSaveAccum >= 30 && !gameState.gameOver && !gameState.victory && !s.disposed) {
          s.autoSaveAccum = 0;
          void save.persist();
        }

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
            playSfx(audioRef?.current, 'shoot');
          },
          speedMul: gameState.bossGazeActive ? BAZYLISZEK_GAZE_SPEED_MUL : 1,
        });
        // Publish player weapon cooldown fraction to HUD state. Zero-alloc —
        // iterates the pre-created shipQuery, stops on player entity.
        for (const sid of s.shipQuery) {
          const ship = ctx.world.get(sid, Ship);
          if (ship && ship.fireRate > 0) {
            gameState.weaponCooldownPct = 1 - ship.cooldown / ship.fireRate;
          }
          break;
        }
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
            applyShake(ctx.camera, 4, 0.18);
          },
          onFormChange: (form) => {
            if (!s) return;
            gameEvents.emit('miniboss-form-change', s.zone.id, form);
          },
          onSpawnHound: (x, y) => {
            if (!s) return;
            spawnEnemy(s.spawnCtx, 'hound', x, y, ((x * 37 + y * 13) | 1) >>> 0);
          },
          countHounds: () => {
            if (!s) return 0;
            return countHounds(ctx.world, s.enemyQuery);
          },
          onSpawnSpikeLane: (laneX) => {
            if (!s) return;
            spawnSpikeLane(s.spawnCtx, laneX, -20);
          },
          onDefeated: () => {
            if (!s) return;
            s.minibossId = -1;
            s.minibossDefeated = true;
            gameState.runStats.kills.miniboss += 1;
            applyShake(ctx.camera, 10, 0.45);
            postfx.triggerChromaticAb(200);
            gameState.minibossActive = false;
            gameEvents.emit('miniboss-defeated', s.zone.id);
            notifyStateChanged();
          },
          onExplosion: (x: number, y: number) => {
            triggerExplosion(
              ctx.world,
              atlas,
              ctx.camera,
              postfx,
              gameState.settings.screenShake,
              x,
              y,
              'burst',
              s?.zone.id ?? '',
            );
            playSfx(audioRef?.current, 'explode');
          },
        });
        updateBoss(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.bossQuery,
          playerX: px,
          playerY: py,
          bounds: s.bounds,
          onPhaseChange: (phase) => {
            const bossPos = s ? ctx.world.get(s.bossId, Position) : null;
            triggerExplosion(
              ctx.world,
              atlas,
              ctx.camera,
              postfx,
              gameState.settings.screenShake,
              bossPos?.x ?? 180,
              bossPos?.y ?? 100,
              'detonation',
              s?.zone.id ?? '',
            );
            postfx.triggerChromaticAb(200);
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
          onGazeChange: (active) => {
            if (!s) return;
            gameState.bossGazeActive = active;
            gameEvents.emit('boss-gaze-changed', s.zone.id, active);
            notifyStateChanged();
          },
          onSpawnPuddle: (x, y) => {
            if (!s) return;
            spawnPuddle(s.spawnCtx, x, y);
          },
          onSpawnFirepit: (x, y) => {
            if (!s) return;
            spawnFirepit(s.spawnCtx, x, y);
          },
          onSpawnMirrorTwin: (x, y) => {
            if (!s) return -1;
            return spawnMirrorTwin(s.spawnCtx, x, y);
          },
          onDespawnMirrorTwin: (id) => {
            if (!s) return;
            despawnMirrorTwin(ctx.world, id);
          },
          onDefeated: () => {
            if (!s) return;
            s.bossId = -1;
            gameState.runStats.kills.boss += 1;
            const bossPos = ctx.world.get(s.bossId, Position);
            triggerExplosion(
              ctx.world,
              atlas,
              ctx.camera,
              postfx,
              gameState.settings.screenShake,
              bossPos?.x ?? 180,
              bossPos?.y ?? 100,
              'cataclysm',
              s.zone.id,
            );
            postfx.triggerHitFlash(0.833);
            gameState.bossActive = false;
            gameState.bossGazeActive = false;
            gameEvents.emit('zone-complete', s.zone.id, gameState.score);
            void save.recordZoneOutcome(s.zone.id, {
              cleared: true,
              died: false,
              timeMs: Math.round(s.elapsed * 1000),
              noHit: gameState.runStats.damageTaken === 0,
            });
            const next = s.zone.nextZone;
            if (next) {
              const nextConfig = ZONES[next];
              if (
                deps.entitlementStore !== undefined &&
                !canAccessContent(nextConfig, deps.entitlementStore)
              ) {
                if (deps.entitlementFallback?.shouldAllowStaleAccess(next, deps.save)) {
                  gameState.currentZone = next;
                  notifyStateChanged();
                  startZone(next, false);
                } else {
                  gameEvents.emit('zone-gated', next, nextConfig.requiresEntitlement ?? '');
                  if (s.zone.id === 'z3') {
                    gameEvents.emit('paywall-trigger', 'zone-3-defeat');
                  }
                  gameState.shopGateVisible = true;
                  notifyStateChanged();
                  void ctx.scenes.go('shop');
                }
                return;
              }
              void save.commitRun(gameState.score, false, next);
              gameState.currentZone = next;
              notifyStateChanged();
              startZone(next, false);
            } else {
              gameState.victory = true;
              notifyStateChanged();
              void save.commitRun(gameState.score, true);
              // Ending cutscene: queue the victory dialogue before handing off
              // to the victory summary scene. If no dialogue controller is
              // wired (tests, headless), transition immediately.
              const goVictory = () => {
                void ctx.scenes.go('victory');
              };
              if (deps.dialogue) {
                deps.dialogue.play(createVictoryGraph(), goVictory);
              } else {
                goVictory();
              }
            }
          },
          onExplosion: (x: number, y: number) => {
            burstExplosion(ctx.world, atlas, x, y, 14, ((s?.elapsed ?? 0) * 1000) | 1);
            playSfx(audioRef?.current, 'explode');
          },
        });
        integrate(ctx.world, dt, s.posQuery);

        // Mirror-twin (Mefistofeles phase 3): mirrors player.x and fires down.
        updateMirrorTwin(ctx.world, dt, {
          spawnCtx: s.spawnCtx,
          query: s.mirrorTwinQuery,
          playerX: px,
          playerY: py,
          bounds: s.bounds,
        });

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
          if (gameState.settings.reducedMotion) {
            gameState.bossBarOpacity = 1;
          } else {
            gameState.bossBarOpacity = 0;
            resetTween(s.bossBarTween);
          }
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
            playSfx(audioRef?.current, 'bomb');
            postfx.triggerHitFlash(5);
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
          spiralCollapseQuery: s.spiralCollapseQuery,
          bounds: s.bounds,
          onEliteDeath: (entityId, x, y) => {
            return triggerSpiralCollapse(
              ctx.world,
              entityId,
              x,
              y,
              gameState.settings.reducedMotion,
              postfx,
            );
          },
          onEnemyKilled: (score, x, y, pattern) => {
            gameState.score += score;
            gameState.runStats.score = gameState.score;
            gameState.runStats.kills[pattern] += 1;
            gameState.comboCount += 1;
            gameState.comboHit = true;
            if (s) {
              if (gameState.settings.reducedMotion) {
                gameState.comboPulseScale = 1;
              } else {
                gameState.comboPulseScale = 1;
                resetTween(s.comboPulseTween);
                s.comboPulseTween.onComplete = () => {
                  gameState.comboPulseScale = 1;
                  notifyStateChanged();
                };
              }
            }
            burstExplosion(ctx.world, atlas, x, y, 8, (x * 31 + y * 17) | 0 || 1);
            playSfx(audioRef?.current, 'explode');
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
            gameState.comboCount = 0;
            gameState.comboHit = false;
            gameState.gameOver = true;
            if (gameState.settings.reducedMotion) {
              gameState.gameOverOpacity = 1;
            } else {
              gameState.gameOverOpacity = 0;
              if (s) resetTween(s.gameOverTween);
            }
            notifyStateChanged();
            applyShake(ctx.camera, 16, 0.7);
            void save.commitRun(gameState.score, false, s?.zone.id);
            if (s) {
              void save.recordZoneOutcome(s.zone.id, {
                cleared: false,
                died: true,
                timeMs: null,
                noHit: false,
              });
            }
            void ctx.scenes.go('game-over');
          },
        });

        // Bullet flicker — 8 Hz phase alternation (§5 hazard-edge recipe).
        // Advance accumulator unconditionally; swap enemy-bullet sprite frames.
        bulletFlickerAccum += dt;
        if (bulletFlickerAccum >= 0.125) {
          bulletFlickerAccum -= 0.125;
          bulletFlickerPhase ^= 1;
        }
        const targetFrame = gameState.settings.reducedMotion
          ? s.bulletFrameA
          : bulletFlickerPhase === 0
            ? s.bulletFrameA
            : s.bulletFrameB;
        for (const bid of s.bulletQuery) {
          const bd = ctx.world.get(bid, Bullet);
          if (!bd || bd.ownerLayer === Layer.player) continue;
          const sp = ctx.world.get(bid, Sprite);
          if (sp) sp.frame = targetFrame;
        }

        if (s.ambience) {
          const zp =
            ZONE_PALETTES[Number.parseInt(s.zone.id.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8];
          tickAmbience(
            s.ambience,
            dt,
            zp,
            s.bounds,
            gameState.settings.reducedMotion,
            gameState.bossActive,
          );
        }

        if (s.pendingShake) {
          s.pendingShake = false;
          applyShake(ctx.camera, 6, 0.2);
        }

        // Advance HUD opacity/scale tweens and publish changes.
        if (!s.bossBarTween.done) {
          const nextOpacity = updateTween(s.bossBarTween, dt);
          if (Math.abs(gameState.bossBarOpacity - nextOpacity) > 0.01) {
            gameState.bossBarOpacity = nextOpacity;
            notifyStateChanged();
          }
        }
        if (!s.gameOverTween.done) {
          const nextGameOver = updateTween(s.gameOverTween, dt);
          if (Math.abs(gameState.gameOverOpacity - nextGameOver) > 0.01) {
            gameState.gameOverOpacity = nextGameOver;
            notifyStateChanged();
          }
        }
        if (!s.comboPulseTween.done) {
          const nextScale = updateTween(s.comboPulseTween, dt);
          if (Math.abs(gameState.comboPulseScale - nextScale) > 0.01) {
            gameState.comboPulseScale = nextScale;
            notifyStateChanged();
          }
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

        // Frame-budget snapshot — zero-alloc active-postfx count via for loop.
        let activePostfx = 0;
        const allEffects = postfx.chain.all();
        for (let i = 0; i < allEffects.length; i++) {
          if (allEffects[i]?.enabled) activePostfx += 1;
        }
        // Sub-shape logical draw count: sum hull+weapons+engine per live ship entity.
        for (const sid of s.shipQuery) {
          const sp = ctx.world.get(sid, Sprite);
          if (sp) recordSubShapeDraws(SHIP_SUB_SHAPES[sp.frame.name] ?? 3);
        }
        recordBudget({
          draws: s.posQuery.count,
          particles: s.lifetimeQuery.count,
          postfx: activePostfx,
          subShapeDraws: consumeSubShapeDrawCount(),
        });
        recordFrameTime(dt);
        checkFpsWatchdog(postfx);
      },

      onExit() {
        if (!s) return;
        s.disposed = true;
        clearWorld(s);
        clearBossFsms();
        clearMinibossFsms();
        gameState.bossShieldActive = false;
        if (deps.renderHooks) {
          deps.renderHooks.background = null;
          deps.renderHooks.postfx = null;
        }
        const a = audioRef?.current;
        if (a) {
          a.pool.stopAll();
          a.music.stop();
        }
      },
    };
  };
}
