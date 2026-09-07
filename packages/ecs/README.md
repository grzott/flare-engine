# @flare-engine/ecs

Archetype-bitmask ECS — `World` (spawn/destroy, `query` + `queryBuilder` + `removeQuery`, `forEachEntity`, `entityCount`), `Query` with a zero-alloc `entities` walk and `onEntityAdded` / `onEntityRemoved` signals, `defineComponent`, `defineSystem`, `definePrefab`, `FSM`. Built-in components: `Position`, `Velocity`, `Rotation`, `Scale`, `Parent`, `Lifetime`, `Follower`. Five system factories: `createMovementSystem`, `createLifetimeSystem`, `createBoundsCullSystem`, `createFollowerSystem`, `createOrphanCullSystem`. Max 32 component types total — the component-id bitmask is module-global, shared across all `World` instances.

## Install

```sh
bun add @flare-engine/ecs
```

## Usage

```ts
import { World, defineComponent, Position, Velocity } from '@flare-engine/ecs';

const Health = defineComponent<{ hp: number }>('Health', () => ({ hp: 100 }));

const world = new World();
const e = world.spawn();
world.add(e, Position, { x: 0, y: 0 });
world.add(e, Velocity, { x: 1, y: 0 });
world.add(e, Health);

const movers = world.query(Position, Velocity);
const ids = movers.entities;
for (let i = 0; i < ids.length; i++) {
  const id = ids[i]!;
  /* ... */
}
```

## Walking a query

`query.entities` is the live `readonly number[]` of matching ids — walk it by index, as above, and nothing is allocated. `for (const id of query)` also works and is fine outside the frame, but it creates an iterator per loop and, on Hermes (React Native), one result object per entity, so keep it out of systems and render code. The array is live: destroying an entity or changing its components mid-walk moves another entity into the slot under you — collect first, act after.

## Prefab data

`definePrefab` plain-object data is stored by reference and shared by every spawn; pass `() => T` for per-entity mutable state:

```ts
import { definePrefab, Position, Velocity } from '@flare-engine/ecs';

// Every bullet gets its own Position and Velocity object.
const Bullet = definePrefab(
  'Bullet',
  [Position, () => ({ x: 0, y: 0 })],
  [Velocity, () => ({ x: 0, y: -300 })],
);
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineecs--8kb-gzip).

## License

Apache-2.0
