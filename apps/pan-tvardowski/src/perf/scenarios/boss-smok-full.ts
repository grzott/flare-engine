/**
 * boss-smok-full scenario — Tier-A gate for rim-light/shadow cost.
 *
 * Spawns Smok Krzemionkowski and drives it through phase 1 → phase 2 over
 * ~30 s by clamping HP and force-transitioning at t=10. The normal game
 * loop's updateBoss runs the FSM, postfx.update drives the rim+shadow chain,
 * and the player auto-fires at the boss. play.ts brackets frame work in
 * the perf recorder — this scenario only manipulates game state.
 *
 * When deps.spawnBoss is provided (on-device via play.ts wiring) the boss
 * goes through the full render pipeline (Sprite + atlas frame). When it is
 * absent (headless tests) _spawnBossEntity is used — no Sprite, no atlas.
 *
 * Phase schedule:
 *   0–10 s  → entering → phase1 (boss snapped to targetY on init)
 *   10–30 s → phase2   (HP forced below PHASE2_HP_RATIO at t=10)
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Boss, Hp } from '../../components';
import { SMOK_HP_MAX } from '../../config/gameplay';
import { clearBossFsms } from '../../systems/boss';
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

export function createBossSmokFullScenario(deps: ScenarioDeps): ScenarioHandle {
  const { world, bounds } = deps;
  let bossId = -1;

  return {
    init() {
      clearBossFsms();
      bossId = deps.spawnBoss
        ? deps.spawnBoss('smok-krzemionkowski', bounds.width / 2, 100, SMOK_HP_MAX)
        : _spawnBossEntity(deps, SMOK_HP_MAX);
    },

    tick(_dt: number, elapsed: number): boolean {
      // Clamp HP + force phase 2 at t=10. Normal updateBoss (called from
      // play.ts loop) reads this HP and transitions the FSM organically.
      const hp = world.get(bossId, Hp);
      const b = world.get(bossId, Boss);
      if (hp && b) {
        if (elapsed >= PHASE2_FORCE_T && b.phase === 'phase1') {
          hp.current = Math.floor(hp.max * PHASE2_HP_RATIO * 0.9);
        }
        if (hp.current < BOSS_HP_CLAMP_MIN) hp.current = BOSS_HP_CLAMP_MIN;
        // Suppress boss fire path — bullets aren't relevant to the rim/shadow
        // measurement and the spawnBullet atlas lookup adds noise.
        b.fireCooldown = 999;
      }
      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      clearBossFsms();
    },
  };
}
