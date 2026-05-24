/**
 * boss-lucyper-z8 scenario — Tier-B gate for 5-postfx-pass stress.
 *
 * Spawns Lucyper Księżycowy (3-phase boss, Zone 8) and drives it through
 * all three phases over ~30 s.  HP is clamped to >=1 so the FSM never exits
 * to dying/defeated.
 *
 * When deps.spawnBoss is provided (on-device via play.ts wiring) the boss is
 * spawned through the full render pipeline (Sprite + atlas frame).  When it is
 * absent (headless tests) _spawnBossEntity is used instead — no Sprite, no
 * atlas dependency, self-contained.
 *
 * Phase schedule:
 *   0–10 s  → entering → phase1 (snapped to targetY on init)
 *   10–20 s → phase2   (HP forced below THREE_PHASE_P2_RATIO at t=10)
 *   20–30 s → phase3   (HP forced below PHASE3_HP_RATIO at t=20)
 *
 * Sections:
 *   "boss-update" — updateBoss tick
 *   "integrate"   — position integration step
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Boss, Hp } from '../../components';
import { LUCYPER_HP_MAX, PHASE3_HP_RATIO, THREE_PHASE_P2_RATIO } from '../../config/gameplay';
import { clearBossFsms, updateBoss } from '../../systems/boss';
import { BOSS_HP_CLAMP_MIN, SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

const PHASE2_FORCE_T = 10;
const PHASE3_FORCE_T = 20;

/** @internal Spawn Lucyper entity directly (no Sprite / atlas dependency). */
function _spawnBossEntity(deps: ScenarioDeps, hp: number): number {
  const { world, bounds } = deps;
  const id = world.spawn();
  world.add(id, Position, { x: bounds.width / 2, y: 100 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'lucyper-ksiezycowy',
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

export function createBossLucyperZ8Scenario(deps: ScenarioDeps): ScenarioHandle {
  const { recorder, world, spawnCtx, bounds } = deps;
  let bossId = -1;
  let bossQuery = deps.enemyQuery;

  return {
    init() {
      recorder.reset();
      clearBossFsms();
      bossId = deps.spawnBoss
        ? deps.spawnBoss('lucyper-ksiezycowy', bounds.width / 2, 100, LUCYPER_HP_MAX)
        : _spawnBossEntity(deps, LUCYPER_HP_MAX);
      bossQuery = world.query(Boss);
    },

    tick(dt: number, elapsed: number): boolean {
      const hp = world.get(bossId, Hp);
      const b = world.get(bossId, Boss);

      if (hp && b) {
        if (elapsed >= PHASE2_FORCE_T && b.phase === 'phase1') {
          hp.current = Math.floor(hp.max * THREE_PHASE_P2_RATIO * 0.9);
        }
        if (elapsed >= PHASE3_FORCE_T && b.phase === 'phase2') {
          hp.current = Math.floor(hp.max * PHASE3_HP_RATIO * 0.9);
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
        bossPhase:
          b?.phase === 'phase1' ? 1 : b?.phase === 'phase2' ? 2 : b?.phase === 'phase3' ? 3 : 0,
      });

      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      clearBossFsms();
    },
  };
}
