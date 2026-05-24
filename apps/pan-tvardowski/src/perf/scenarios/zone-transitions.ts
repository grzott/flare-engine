/**
 * zone-transitions scenario — Tier-C gate for JS-thread GC spikes.
 *
 * Fills the world with ENTITY_COUNT enemies, then wipes every entity every
 * WIPE_INTERVAL_SEC seconds to trigger a GC pressure event that mirrors a
 * zone transition's bulk-despawn + respawn cycle.
 *
 * All entities carry Position + Velocity + Enemy-like tags but are spawned
 * as raw ECS entities (no collision bodies, no atlas frames) so the scenario
 * is self-contained and does not require a real atlas.
 *
 * Section: "wipe" — entity bulk-despawn + refill cycle.
 *
 * Duration: ~30 s (6 wipe cycles at 5-second intervals).
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Lifetime } from '../../components';
import { SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

const ENTITY_COUNT = 200;
const WIPE_INTERVAL_SEC = 5;

export function createZoneTransitionsScenario(deps: ScenarioDeps): ScenarioHandle {
  const { recorder, world, bounds, lifetimeQuery } = deps;
  let nextWipeT = WIPE_INTERVAL_SEC;

  return {
    init() {
      recorder.reset();
      nextWipeT = WIPE_INTERVAL_SEC;
      _spawnEntities(world, bounds, ENTITY_COUNT);
    },

    tick(_dt: number, elapsed: number): boolean {
      if (elapsed >= nextWipeT) {
        recorder.beginSection('wipe');

        // Collect all live entity ids via the lifetime query (all scenario
        // entities carry a Lifetime component) and despawn them.
        const ids: number[] = [];
        for (const id of lifetimeQuery) ids.push(id);
        for (const id of ids) world.destroy(id);

        // Immediately refill to the same entity count.
        _spawnEntities(world, bounds, ENTITY_COUNT);

        recorder.endSection('wipe');
        nextWipeT += WIPE_INTERVAL_SEC;
      }

      recorder.recordFrame({
        elapsed: elapsed * 1000,
        entityCount: lifetimeQuery.count,
      });

      return elapsed >= SCENARIO_DURATION_SEC;
    },

    finish() {
      const ids: number[] = [];
      for (const id of lifetimeQuery) ids.push(id);
      for (const id of ids) world.destroy(id);
    },
  };
}

function _spawnEntities(
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
    world.add(id, Velocity, { x: 0, y: 60 });
    world.add(id, Lifetime, { remaining: WIPE_INTERVAL_SEC + 1 });
  }
}
