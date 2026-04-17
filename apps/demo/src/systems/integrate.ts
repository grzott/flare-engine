import type { Query, World } from '@flare-engine/engine';
import { Position, Velocity } from '@flare-engine/engine';

export function integrate(world: World, dt: number, query: Query): void {
  for (const id of query) {
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    if (!pos || !vel) continue;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
  }
}
