import { resetTween } from '@flare-engine/animation';
import type { GameContextValue } from '@flare-engine/engine';
import { Position, fadeTransition } from '@flare-engine/engine';
import { canAccessContent } from '@flare-engine/iap';
import { easeInCubic, easeOutCubic } from '@flare-engine/math';
import { Sprite } from '@flare-engine/render';
import { applyShake, shouldAllowSlowMo } from '../../a11y/reduced-motion';
import { playSfx } from '../../audio/init';
import { Bullet, Ship } from '../../components';
import { BAZYLISZEK_GAZE_SPEED_MUL, DZIWOZONA_SKRZAT_SPAWN } from '../../config/gameplay';
import { ZONES } from '../../config/zones';
import { createVictoryGraph } from '../../dialogue';
import { gameEvents } from '../../events';
import {
  checkFpsWatchdog,
  consumeSubShapeDrawCount,
  recordBudget,
  recordFrameTime,
  recordSubShapeDraws,
} from '../../fx/budget';
import { bulletPulseAlpha } from '../../fx/bullet-pulse';
import { triggerExplosion, triggerSpiralCollapse } from '../../fx/explosions';
import type { PanPostFxController } from '../../fx/postfx';
import { updateZoneBanner } from '../../hud/zone-banner';
import { Layer } from '../../layers';
import { burstExplosion } from '../../particles';
import type { AtlasHandle } from '../../spawn';
import { spawnBoss, spawnEnemy, spawnMiniboss } from '../../spawn';
import {
  bombButtonState,
  gameState,
  joystickState,
  notifyStateChanged,
  resetBombButtonFrame,
} from '../../state';
import { countHounds, spawnPuddle } from '../../systems/bazyliszek';
import { processBomb } from '../../systems/bomb';
import { updateBoss } from '../../systems/boss';
import { cleanup } from '../../systems/cleanup';
import { updateEnemyAI } from '../../systems/enemy-ai';
import { updateExhaust } from '../../systems/exhaust';
import { updateExplosionFire } from '../../systems/explosion-fire';
import { integrate } from '../../systems/integrate';
import {
  despawnMirrorTwin,
  spawnFirepit,
  spawnMirrorTwin,
  spawnSpikeLane,
  updateMirrorTwin,
} from '../../systems/mefistofeles';
import { updateMiniboss } from '../../systems/miniboss';
import { syncColliders } from '../../systems/physics-sync';
import { updatePlayer } from '../../systems/player';
import { tickSpawner } from '../../systems/spawner';
import { countTopielecMinions } from '../../systems/wodnik';
import type { AudioRef, PlaySceneDeps } from '../play';
import type { BenchRef } from './benchmark';
import { finalizeBench, recordBenchFrame } from './benchmark';
import { syncHudState } from './hud-sync';
import { applyBossPostFxChain } from './postfx-coordinator';
import { refreshBounds, startZone } from './setup';
import { SHIP_SUB_SHAPES } from './types';
import type { PlayState } from './types';

// Bullet pulse accumulator — module-level continuous time counter (seconds).
// Drives the smooth alpha-pulse sine wave applied to all bullets each frame.
// Not reset on zone start: a mid-phase offset is imperceptible.
let bulletFlickerAccum = 0;

// Exhaust flame accumulator — parallel to bulletFlickerAccum.
// Drives the fire00..19 flipbook index and the sine alpha pulse for all flame entities.
let exhaustFlickerAccum = 0;

export function playOnUpdate(
  s: PlayState,
  benchRef: BenchRef,
  ctx: GameContextValue,
  atlas: AtlasHandle,
  deps: PlaySceneDeps,
  audioRef: AudioRef | undefined,
  getBottomInset: () => number,
  postfx: PanPostFxController,
  sBox: { s: PlayState | null },
  dt: number,
): void {
  // Bench mode: scenarios are setup MODIFIERS on the normal game loop,
  // not replacements. Each tick manipulates game state (spawn boss,
  // clamp HP, refill particles, etc.) BEFORE the normal loop runs.
  // Performance is measured around the actual loop work below, matching
  // the createFrameBudget instrumentation pattern in fx/budget.ts.
  let _benchTerminating = false;
  if (benchRef.scenario !== null) {
    _benchTerminating = benchRef.scenario.tick(dt, benchRef.elapsed);
    benchRef.elapsed += dt;
  }

  // Pause gates suppressed in bench mode — gameOver / victory / paused /
  // dialogue must NOT halt the 30 s measurement window.
  const _inBench = benchRef.scenario !== null;
  if (!_inBench) {
    if (gameState.gameOver || gameState.victory) {
      resetBombButtonFrame();
      return;
    }
    if (gameState.dialogue !== null) {
      refreshBounds(s, ctx, getBottomInset);
      postfx.update(dt);
      resetBombButtonFrame();
      return;
    }
    if (gameState.paused) {
      refreshBounds(s, ctx, getBottomInset);
      postfx.update(dt);
      resetBombButtonFrame();
      return;
    }
  }

  // Frame measurement bracket — captures the entire JS frame work
  // including postfx chain, player + enemy + boss updates, collisions,
  // particles, and HUD. Released-build compatible (perf-recorder uses
  // performance.now() via the Web Performance API).
  if (benchRef.recorder !== null) benchRef.recorder.beginSection('frame');

  refreshBounds(s, ctx, getBottomInset);
  s.elapsed += dt;
  gameState.runStats.durationSec += dt;

  s.autoSaveAccum += dt;
  if (s.autoSaveAccum >= 30 && !gameState.gameOver && !gameState.victory && !s.disposed) {
    s.autoSaveAccum = 0;
    void deps.save.persist();
  }

  if (benchRef.recorder !== null) benchRef.recorder.beginSection('postfx');
  postfx.update(dt);
  if (benchRef.recorder !== null) benchRef.recorder.endSection('postfx');

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
      gameEvents.emit('miniboss-form-change', s.zone.id, form);
    },
    onSpawnHound: (x, y) => {
      spawnEnemy(s.spawnCtx, 'hound', x, y, ((x * 37 + y * 13) | 1) >>> 0);
    },
    countHounds: () => {
      return countHounds(ctx.world, s.enemyQuery);
    },
    onSpawnSpikeLane: (laneX) => {
      spawnSpikeLane(s.spawnCtx, laneX, -20);
    },
    onDefeated: () => {
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
        s.zone.id,
        undefined,
        deps.kenney ?? null,
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
      const bossPos = ctx.world.get(s.bossId, Position);
      triggerExplosion(
        ctx.world,
        atlas,
        ctx.camera,
        postfx,
        gameState.settings.screenShake,
        bossPos?.x ?? 180,
        bossPos?.y ?? 100,
        'detonation',
        s.zone.id,
        () => {
          gameState.redFlash = true;
          notifyStateChanged();
        },
        deps.kenney ?? null,
      );
      postfx.triggerChromaticAb(200);
      gameEvents.emit('boss-phase-change', s.zone.id, phase);
    },
    onSpawnShieldMinion: (x, y) => {
      spawnEnemy(s.spawnCtx, 'topielec', x, y, (x * 53 + y * 11) | 1);
    },
    countShieldMinions: () => {
      return countTopielecMinions(ctx.world, s.enemyQuery);
    },
    onShieldBroken: () => {
      postfx.triggerHitFlash();
      gameEvents.emit('boss-shield-broken', s.zone.id);
    },
    onSpawnSummon: (x, y) => {
      spawnEnemy(s.spawnCtx, 'bies', x, y, ((x * 41 + y * 19) | 1) >>> 0);
      gameEvents.emit('boss-summon', s.zone.id, 'bies');
    },
    onGazeChange: (active) => {
      gameState.bossGazeActive = active;
      gameEvents.emit('boss-gaze-changed', s.zone.id, active);
      notifyStateChanged();
    },
    onSpawnPuddle: (x, y) => {
      spawnPuddle(s.spawnCtx, x, y);
    },
    onSpawnFirepit: (x, y) => {
      spawnFirepit(s.spawnCtx, x, y);
    },
    onSpawnMirrorTwin: (x, y) => {
      return spawnMirrorTwin(s.spawnCtx, x, y);
    },
    onDespawnMirrorTwin: (id) => {
      despawnMirrorTwin(ctx.world, id);
    },
    onDefeated: () => {
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
        () => {
          gameState.redFlash = true;
          notifyStateChanged();
        },
        deps.kenney ?? null,
      );
      if (shouldAllowSlowMo(gameState.settings.reducedMotion)) {
        resetTween(s.slowDownTween);
        resetTween(s.recoveryTween);
      }
      postfx.triggerHitFlash(0.833);
      gameState.bossActive = false;
      gameState.bossGazeActive = false;
      gameEvents.emit('zone-complete', s.zone.id, gameState.score);
      void deps.save.recordZoneOutcome(s.zone.id, {
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
            startZone(next, false, sBox, ctx, atlas, deps, audioRef, getBottomInset, postfx);
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
        void deps.save.commitRun(gameState.score, false, next);
        gameState.currentZone = next;
        notifyStateChanged();
        startZone(next, false, sBox, ctx, atlas, deps, audioRef, getBottomInset, postfx);
      } else {
        gameState.victory = true;
        notifyStateChanged();
        void deps.save.commitRun(gameState.score, true);
        // Ending cutscene: queue the victory dialogue before handing off
        // to the victory summary scene. If no dialogue controller is
        // wired (tests, headless), transition immediately.
        const goVictory = () => {
          ctx.scenes.setTransition(fadeTransition(0.32, easeOutCubic));
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
      burstExplosion(
        ctx.world,
        atlas,
        x,
        y,
        14,
        (s.elapsed * 1000) | 1,
        deps.kenney ?? null,
        s.zone.id,
      );
      playSfx(audioRef?.current, 'explode');
    },
    onPaletteShift: (_phase, accent) => {
      const r = ((accent >>> 16) & 0xff) / 255;
      const g = ((accent >>> 8) & 0xff) / 255;
      const b = (accent & 0xff) / 255;
      postfx.setVignetteColor(r, g, b);
    },
    onPhasePostFx: (kind) => {
      applyBossPostFxChain(postfx, kind);
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
  if (!s.minibossSpawned && s.zone.minibossPattern !== null && s.elapsed >= s.zone.minibossT) {
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
    s.bossId = spawnBoss(s.spawnCtx, s.zone.bossPattern, s.bounds.width / 2, -40, s.zone.bossHp);
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
    exhaustQuery: s.exhaustQuery,
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
      burstExplosion(
        ctx.world,
        atlas,
        x,
        y,
        8,
        (x * 31 + y * 17) | 0 || 1,
        deps.kenney ?? null,
        s.zone.id,
      );
      playSfx(audioRef?.current, 'explode');
      // Dziwożona splits on death — spawn DZIWOZONA_SKRZAT_SPAWN Skrzats.
      if (pattern === 'dziwozona') {
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
        resetTween(s.gameOverTween);
      }
      notifyStateChanged();
      applyShake(ctx.camera, 16, 0.7);
      void deps.save.commitRun(gameState.score, false, s.zone.id);
      void deps.save.recordZoneOutcome(s.zone.id, {
        cleared: false,
        died: true,
        timeMs: null,
        noHit: false,
      });
      ctx.scenes.setTransition(fadeTransition(1.2, easeInCubic));
      void ctx.scenes.go('game-over');
    },
  });

  // Bullet alpha pulse — smooth sine wave; alpha-only so colliders are unaffected.
  // Pulse scalars are computed once per frame from the module-level accumulator.
  bulletFlickerAccum += dt;
  const _reducedMotion = gameState.settings.reducedMotion;
  const _playerPulse = bulletPulseAlpha(bulletFlickerAccum, true, _reducedMotion);
  const _enemyPulse = bulletPulseAlpha(bulletFlickerAccum, false, _reducedMotion);
  for (const bid of s.bulletQuery) {
    const bd = ctx.world.get(bid, Bullet);
    if (!bd) continue;
    const sp = ctx.world.get(bid, Sprite);
    if (sp) sp.alpha = bd.ownerLayer === Layer.player ? _playerPulse : _enemyPulse;
  }

  // Exhaust flame flipbook + alpha pulse.
  exhaustFlickerAccum += dt;
  updateExhaust(ctx.world, {
    exhaustQuery: s.exhaustQuery,
    kenney: deps.kenney ?? null,
    accum: exhaustFlickerAccum,
    playerVisible: joystickState.active,
    reducedMotion: _reducedMotion,
  });

  // KG7: advance explosion-fire flipbook entities (fire00..19 animation).
  updateExplosionFire(ctx.world, {
    explosionFireQuery: s.explosionFireQuery,
    kenney: deps.kenney ?? null,
    dt,
  });

  s.zoneBg?.tick(dt);

  if (s.pendingShake) {
    s.pendingShake = false;
    applyShake(ctx.camera, 6, 0.2);
  }

  syncHudState(s, ctx, dt);

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

  // Close the frame measurement bracket + record the frame counters.
  // Done AFTER the existing instrumentation hooks above so the perf
  // recorder captures the entire real workload, mirroring the
  // createFrameBudget pattern.
  recordBenchFrame(benchRef);

  // Scenario termination: AFTER the final frame has been recorded.
  // Setting the report here ensures the BENCH_DONE Text content
  // contains the report when React's next paint fires.
  finalizeBench(benchRef, _benchTerminating);
}
