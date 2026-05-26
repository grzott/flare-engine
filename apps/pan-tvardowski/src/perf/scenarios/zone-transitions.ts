/**
 * zone-transitions scenario — Tier-C gate for JS-thread GC spikes.
 *
 * Fills the world with ENTITY_COUNT lifetime-tagged entities, then wipes
 * them all every WIPE_INTERVAL_SEC seconds to mirror a zone transition's
 * bulk-despawn + respawn pattern. The normal game loop runs throughout —
 * play.ts brackets frame work in the perf recorder, so the recorded `frame`
 * p95 captures the GC spikes around each wipe.
 */

import { Position, Velocity } from '@flare-engine/ecs';
import { Lifetime } from '../../components';
import { SCENARIO_DURATION_SEC } from './constants';
import type { ScenarioDeps, ScenarioHandle } from './types';

const ENTITY_COUNT = 200;
const WIPE_INTERVAL_SEC = 5;

export function createZoneTransitionsScenario(deps: ScenarioDeps): ScenarioHandle {
  const { world, bounds, lifetimeQuery } = deps;
  let nextWipeT = WIPE_INTERVAL_SEC;

  return {
    init() {
      nextWipeT = WIPE_INTERVAL_SEC;
      _spawnEntities(world, bounds, ENTITY_COUNT);
    },

    tick(_dt: number, elapsed: number): boolean {
      if (elapsed >= nextWipeT) {
        // Bulk despawn + refill. The temporary id array is the intentional
        // GC pressure source we want to measure on the JS thread.
        const ids: number[] = [];
        for (const id of lifetimeQuery) ids.push(id);
        for (const id of ids) world.destroy(id);
        _spawnEntities(world, bounds, ENTITY_COUNT);
        nextWipeT += WIPE_INTERVAL_SEC;
      }
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
