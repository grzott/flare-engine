import { periodicTween, tween } from '@flare-engine/animation';
import type { GameContextValue } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';
import { easeInCubic, easeOutBack, easeOutCubic, easeOutExpo } from '@flare-engine/math';
import { CollisionWorld } from '@flare-engine/physics';
import { playSfx } from '../../audio/init';
import {
  Boss,
  Bullet,
  Enemy,
  Exhaust,
  ExplosionFire,
  Lifetime,
  Miniboss,
  MirrorTwin,
  Ship,
  SpiralCollapse,
} from '../../components';
import { PLAYER_HP_MAX } from '../../config/gameplay';
import { ZONES } from '../../config/zones';
import type { ZoneId } from '../../events';
import { createZoneBannerState } from '../../hud/zone-banner';
import type { AtlasHandle } from '../../spawn';
import { createBombFlashState } from '../../systems/bomb';
import { resolveCollision } from '../../systems/collision';
import { createSpawnerState } from '../../systems/spawner';
import type { AudioRef } from '../play';
import type { PlaySceneDeps } from '../play';
import type { PlayState } from './types';

export function initState(
  zoneId: ZoneId,
  ctx: GameContextValue,
  atlas: AtlasHandle,
  deps: PlaySceneDeps,
  audioRef: AudioRef | undefined,
): PlayState {
  const zone = ZONES[zoneId];
  const coll = new CollisionWorld();
  const state: PlayState = {
    zone,
    coll,
    spawnCtx: { world: ctx.world, coll, atlas, kenney: deps.kenney ?? null },
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
    exhaustQuery: ctx.world.query(Exhaust),
    explosionFireQuery: ctx.world.query(ExplosionFire),
    bounds: { width: 360, height: 640 },
    pendingShake: false,
    viewportReady: false,
    zoneBg: null,
    lastPlayerHp: PLAYER_HP_MAX,
    disposed: false,
    autoSaveAccum: 0,
    bossBarTween: { ...tween(0, 1, 0.6, easeOutExpo), done: true },
    gameOverTween: { ...tween(0, 1, 1.2, easeInCubic), done: true },
    comboPulseTween: { ...tween(1, 1.18, 0.12, easeOutBack), done: true },
    sigilTween: periodicTween(0.4, 1.0, 2.4),
    slowDownTween: { ...tween(1.0, 0.3, 0.8, easeInCubic), done: true },
    recoveryTween: { ...tween(0.3, 1.0, 0.4, easeOutCubic), done: true },
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
