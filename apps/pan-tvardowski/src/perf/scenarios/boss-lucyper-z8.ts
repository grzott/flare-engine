/**
 * boss-lucyper-z8 scenario — Tier-B gate for 5-postfx-pass stress.
 *
 * Spawns Lucyper Księżycowy (3-phase boss, Zone 8) and drives through all
 * three phases over ~30 s by force-transitioning at t=10 and t=20. The
 * normal game loop's updateBoss runs the FSM and postfx.update drives the
 * Z8 CRT + bloom + rim + shadow chain (5 concurrent passes in phase 3).
 *
 * play.ts brackets the frame work in the perf recorder — scenario does
 * only state manipulation.
 *
 * Phase schedule:
 *   0–10 s  → entering → phase1
 *   10–20 s → phase2 (HP forced below THREE_PHASE_P2_RATIO at t=10)
 *   20–30 s → phase3 (HP forced below PHASE3_HP_RATIO at t=20)
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Boss, Hp } from '../../components';
import { LUCYPER_HP_MAX, PHASE3_HP_RATIO, THREE_PHASE_P2_RATIO } from '../../config/gameplay';
import { clearBossFsms } from '../../systems/boss';
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
    fireCooldown: 999,
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
  const { world, bounds } = deps;
  let bossId = -1;

  return {
    init() {
      clearBossFsms();
      bossId = deps.spawnBoss
        ? deps.spawnBoss('lucyper-ksiezycowy', bounds.width / 2, 100, LUCYPER_HP_MAX)
        : _spawnBossEntity(deps, LUCYPER_HP_MAX);
    },

    tick(_dt: number, elapsed: number): boolean {
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
        b.fireCooldown = 999;
      }
      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      clearBossFsms();
    },
  };
}
