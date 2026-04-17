---
name: flare-ecs
description: Deep knowledge of the @flare-engine/ecs package — World, defineComponent, Query, defineSystem, definePrefab, FSM. Use when implementing entities, components, systems, state machines, or prefab instantiation in Flare.
---

# @flare-engine/ecs

Archetype-based Entity-Component-System for Flare. Layer 1 — depends only on `@flare-engine/events`.

## Exports

```ts
import {
  World,
  defineComponent,
  Query,
  QueryBuilder,
  defineSystem,
  definePrefab,
  FSM,
  // Built-in component types
  Position,
  Velocity,
  Rotation,
  Scale,
  Parent,
} from "@flare-engine/ecs";
```

---

## defineComponent

Declares a typed component schema.

```ts
const Health = defineComponent({ current: 0, max: 100 });
const Sprite = defineComponent({ textureId: "", frame: 0, visible: true });
const Tag = defineComponent({}); // zero-data tag component
```

- Returns a `ComponentDef<T>` — use as a key with `World` methods.
- Schema values are **default values** (used when spawning).

---

## World

Central registry for entities and components.

```ts
const world = new World();

// Create / destroy entities
const entity = world.spawn();
world.despawn(entity);
world.isAlive(entity); // boolean

// Add / remove components
world.add(entity, Health, { current: 50, max: 100 });
world.add(entity, Tag); // tag (no data needed)
world.remove(entity, Health);
world.has(entity, Health); // boolean

// Read / write component data
const hp = world.get(entity, Health);
hp.current -= 10; // mutation is fine — plain object

// Batch operations (preferred for spawning many entities)
const e = world.spawn();
world.add(e, Position, { x: 0, y: 0 });
world.add(e, Velocity, { x: 1, y: 0 });
```

---

## Query

Iterates all entities that match a component filter.

```ts
// Define once outside the loop (cached, zero-alloc iteration)
const movables = new Query([Position, Velocity]);

// Register with world (required for change tracking)
world.registerQuery(movables);

// Run each frame
for (const entity of movables.entities(world)) {
  const pos = world.get(entity, Position);
  const vel = world.get(entity, Velocity);
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
}
```

**Filter options:**

```ts
// Only entities WITH all listed components
new Query([Position, Velocity]);

// Exclude entities that have a component
new Query([Position], { exclude: [Tag] });
```

---

## defineSystem

Wraps a query + update function into a reusable system.

```ts
const moveSystem = defineSystem(
  [Position, Velocity], // required components
  (world, entities, dt) => {
    for (const e of entities) {
      const pos = world.get(e, Position);
      const vel = world.get(e, Velocity);
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
    }
  },
);

// Run each frame
moveSystem.update(world, dt);
```

---

## definePrefab

Defines a reusable entity template.

```ts
const EnemyPrefab = definePrefab([
  [Health, { current: 30, max: 30 }],
  [Position, { x: 0, y: 0 }],
  [Velocity, { x: 0, y: 0 }],
  [Sprite, { textureId: "enemy", frame: 0, visible: true }],
]);

// Spawn an instance (overrides specific component fields)
const enemy = EnemyPrefab.spawn(world, {
  [Position]: { x: 200, y: 100 },
});
```

---

## FSM

Finite state machine with enter/exit/update hooks.

```ts
type EnemyState = "idle" | "chase" | "attack" | "dead";

const fsm = new FSM<EnemyState>("idle", {
  idle: {
    enter: () => {
      playAnim("idle");
    },
    update: (dt) => {
      if (playerNear()) fsm.transition("chase");
    },
  },
  chase: {
    enter: () => {
      playAnim("run");
    },
    update: (dt) => {
      moveToward(player, dt);
      if (inRange()) fsm.transition("attack");
    },
  },
  attack: {
    enter: () => {
      playAnim("attack");
      startAttackTimer();
    },
    update: (dt) => {
      /* handled by animation callback */
    },
  },
  dead: {
    enter: () => {
      world.despawn(entity);
    },
  },
});

// Each frame
fsm.update(dt);

fsm.state; // current state name
fsm.transition("chase"); // trigger state change
```

---

## Built-in Components

```ts
import { Position, Velocity, Rotation, Scale, Parent } from "@flare-engine/ecs";

// Position: { x: number, y: number }
// Velocity: { x: number, y: number }
// Rotation: { angle: number }         — radians
// Scale:    { x: number, y: number }
// Parent:   { entity: number }        — entity hierarchy
```
