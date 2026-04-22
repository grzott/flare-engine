import type { Query, World } from '@flare-engine/ecs';
import { Enemy } from '../components';

/**
 * Count the number of live Topielec enemies (Wodnik's shield minions).
 * Takes a pre-created enemy query to avoid per-frame allocations.
 */
export function countTopielecMinions(world: World, enemyQuery: Query): number {
  let count = 0;
  for (const id of enemyQuery) {
    const e = world.get(id, Enemy);
    if (e && e.pattern === 'topielec') count += 1;
  }
  return count;
}
