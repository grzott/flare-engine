/**
 * boss-smok-full scenario — Tier-A gate for rim-light/shadow cost.
 *
 * Spawns Smok Krzemionkowski and drives it through both phases over ~30 s.
 * Boss HP is clamped to >=1 so the FSM never exits to the dying/defeated
 * states — the scenario stays in combat at each phase for the configured
 * phase dwell.
 *
 * When deps.spawnBoss is provided (on-device via play.ts wiring) the boss is
 * spawned through the full render pipeline (Sprite + atlas frame).  When it is
 * absent (headless tests) _spawnBossEntity is used instead — no Sprite, no
 * atlas dependency, self-contained.
 *
 * Sections:
 *   "boss-update" — updateBoss tick
 *   "integrate"   — position integration step
 *
 * Phase schedule:
 *   0–10 s  → entering → phase1 (boss snapped to targetY on init)
 *   10–30 s → phase2   (HP forced below PHASE2_HP_RATIO at t=10)
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Boss, Hp } from '../../components';
import { SMOK_HP_MAX } from '../../config/gameplay';
import { clearBossFsms, updateBoss } from '../../systems/boss';
import { PHASE2_HP_RATIO } from '../../systems/boss/shared';
import { BOSS_HP_CLAMP_MIN, SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

const PHASE2_FORCE_T = 10;

/** @internal Spawn boss entity directly (no Sprite / atlas dependency). */
function _spawnBossEntity(deps: ScenarioDeps, hp: number): number {
  const { world, bounds } = deps;
  const id = world.spawn();
  world.add(id, Position, { x: bounds.width / 2, y: 100 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'smok-krzemionkowski',
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 999, // prevent fire paths — scenario times, not fire rates
    dyingExplosions: 0,
    targetY: 100,
    shieldActive: false,
    minionsAlive: 0,
    shieldDownFor: 0,
    summonsSpawned: 0,
    teleportT: 0,
    twinId: -1,
    firepitCooldown: 0,
    shatterIdx: 0,
    shatterT: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

export function createBossSmokFullScenario(deps: ScenarioDeps): ScenarioHandle {
  const { recorder, world, spawnCtx, bounds } = deps;
  let bossId = -1;
  let bossQuery = deps.enemyQuery;

  return {
    init() {
      recorder.reset();
      clearBossFsms();
      bossId = deps.spawnBoss
        ? deps.spawnBoss('smok-krzemionkowski', bounds.width / 2, 100, SMOK_HP_MAX)
        : _spawnBossEntity(deps, SMOK_HP_MAX);
      bossQuery = world.query(Boss);
    },

    tick(dt: number, elapsed: number): boolean {
      const hp = world.get(bossId, Hp);
      const b = world.get(bossId, Boss);

      if (hp && b) {
        if (elapsed >= PHASE2_FORCE_T && b.phase === 'phase1') {
          hp.current = Math.floor(hp.max * PHASE2_HP_RATIO * 0.9);
        }
        if (hp.current < BOSS_HP_CLAMP_MIN) hp.current = BOSS_HP_CLAMP_MIN;
      }

      recorder.beginSection('boss-update');
      updateBoss(world, dt, {
        spawnCtx,
        query: bossQuery,
        playerX: bounds.width / 2,
        playerY: bounds.height - 90,
        bounds,
      });
      recorder.endSection('boss-update');

      // Keep fireCooldown high so the FSM's fire paths never reach the atlas.
      // On-device the atlas is real; in headless tests spawnBullet would fail.
      const bAfter = world.get(bossId, Boss);
      if (bAfter) bAfter.fireCooldown = 999;

      recorder.beginSection('integrate');
      const pos = world.get(bossId, Position);
      const vel = world.get(bossId, Velocity);
      if (pos && vel) {
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
      }
      recorder.endSection('integrate');

      recorder.recordFrame({
        elapsed: elapsed * 1000,
        bossPhase: b?.phase === 'phase1' ? 1 : b?.phase === 'phase2' ? 2 : 0,
      });

      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      clearBossFsms();
    },
  };
}
