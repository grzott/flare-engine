import type { CollisionWorld, Query, World } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';

export function syncColliders(world: World, coll: CollisionWorld, query: Query): void {
  for (const id of query) {
    const pos = world.get(id, Position);
    if (!pos) continue;
    coll.setPosition(id, pos.x, pos.y);
  }
}
