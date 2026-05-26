/**
 * particle-storm scenario — saturates the 480-particle cap.
 *
 * Spawns Lifetime-tagged entities each tick to keep the count at PARTICLE_CAP.
 * The normal game loop's lifetime cleanup system drains and destroys expired
 * entities each frame — this scenario only refills. play.ts brackets frame
 * work in the perf recorder so the recorded `frame` p95 reflects the cost of
 * ticking 480 live entities every frame for 30 s.
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Lifetime } from '../../components';
import { BUDGET_LIMITS } from '../../fx/budget';
import { SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

const PARTICLE_LIFETIME_SEC = 0.5;
const PARTICLE_CAP = BUDGET_LIMITS.particles;

export function createParticleStormScenario(deps: ScenarioDeps): ScenarioHandle {
  const { world, bounds, lifetimeQuery } = deps;

  return {
    init() {
      _fillParticles(world, bounds, PARTICLE_CAP);
    },

    tick(_dt: number, elapsed: number): boolean {
      // Refill to cap. Normal game loop's cleanup system drains expired
      // lifetimes — we only top up so every measured frame has 480 entities.
      const toSpawn = PARTICLE_CAP - lifetimeQuery.count;
      if (toSpawn > 0) {
        _fillParticles(world, bounds, toSpawn);
      }
      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      // Tear down any scenario-spawned particles still alive.
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
