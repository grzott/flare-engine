import type { CollisionWorld, World } from '@flare/engine';

export function destroyEntity(world: World, coll: CollisionWorld, id: number): void {
  coll.remove(id);
  world.destroy(id);
}
