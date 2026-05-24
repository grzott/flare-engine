/**
 * particle-storm scenario — saturates the 480-particle cap.
 *
 * Spawns Lifetime-tagged entities on each tick up to PARTICLE_CAP, then
 * lets them expire naturally and respawns to keep the cap full.  Measures
 * the cost of ticking 480 live Lifetime components without running the full
 * cleanup system (no collision, no physics, no boss).
 *
 * Section: "lifetime-tick" — manual drain of Lifetime.remaining across all
 *           entities (mirrors what cleanup.ts does in production).
 *
 * Duration: ~30 s.
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Lifetime } from '../../components';
import { BUDGET_LIMITS } from '../../fx/budget';
import { SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

const PARTICLE_LIFETIME_SEC = 0.5;
const PARTICLE_CAP = BUDGET_LIMITS.particles;

export function createParticleStormScenario(deps: ScenarioDeps): ScenarioHandle {
  const { recorder, world, bounds, lifetimeQuery } = deps;

  return {
    init() {
      recorder.reset();
      _fillParticles(world, bounds, PARTICLE_CAP);
    },

    tick(dt: number, elapsed: number): boolean {
      recorder.beginSection('lifetime-tick');

      // Drain remaining and collect expired ids.
      const expired: number[] = [];
      for (const id of lifetimeQuery) {
        const lt = world.get(id, Lifetime);
        if (!lt) continue;
        lt.remaining -= dt;
        if (lt.remaining <= 0) expired.push(id);
      }

      // Destroy expired particles (no collision body — simple remove).
      for (const id of expired) {
        world.destroy(id);
      }

      recorder.endSection('lifetime-tick');

      // Refill to cap so every tick exercises the maximum particle budget.
      const live = lifetimeQuery.count;
      const toSpawn = PARTICLE_CAP - live;
      if (toSpawn > 0) {
        _fillParticles(world, bounds, toSpawn);
      }

      recorder.recordFrame({
        elapsed: elapsed * 1000,
        particleCount: lifetimeQuery.count,
      });

      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      // Clean up any remaining particle entities.
      const ids: number[] = [];
      for (const id of lifetimeQuery) ids.push(id);
      for (const id of ids) world.destroy(id);
    },
  };
}

function _fillParticles(
  world: ScenarioDeps['world'],
  bounds: { width: number; height: number },
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const id = world.spawn();
    world.add(id, Position, {
      x: Math.random() * bounds.width,
      y: Math.random() * bounds.height,
    });
    world.add(id, Velocity, { x: 0, y: -30 });
    world.add(id, Lifetime, { remaining: PARTICLE_LIFETIME_SEC });
  }
}
