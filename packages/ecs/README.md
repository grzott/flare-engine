# @flare-engine/ecs

Archetype-bitmask ECS — `World`, `Query` with `onEntityAdded` / `onEntityRemoved` signals, `defineComponent`, `defineSystem`, `definePrefab`, `FSM`. Built-in components: `Position`, `Velocity`, `Rotation`, `Scale`, `Parent`, `Lifetime`, `Follower`. Five system factories: `createMovementSystem`, `createLifetimeSystem`, `createBoundsCullSystem`, `createFollowerSystem`, `createOrphanCullSystem`. Max 32 component types per world.

## Install

```sh
bun add @flare-engine/ecs
```

## Usage

```ts
import { World, defineComponent, Position, Velocity } from '@flare-engine/ecs';

const Health = defineComponent<{ hp: number }>('Health', { hp: 100 });

const world = new World();
const e = world.spawn();
world.add(e, Position, { x: 0, y: 0 });
world.add(e, Velocity, { x: 1, y: 0 });
world.add(e, Health);

const movers = world.query(Position, Velocity);
for (const id of movers) { /* ... */ }
```

See [API spec](../../docs/design/api-specs.md#flare-engineecs--8kb-gzip).

## License

MIT
