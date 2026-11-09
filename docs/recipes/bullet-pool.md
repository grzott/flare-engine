# Bullet pool

How to fire and recycle bullets in a `GameView` scene without allocating during the frame, the way the `shmup` template from `@flare-engine/create` does in `src/logic.ts`.

---

## The rules

The engine's hot-path rules (AGENTS.md, "Performance (hot paths)") apply to game code the same way:

- **Zero-alloc in `update()` / `render()`** — no `new`, no object literals, no arrays created inside the frame.
- **Pre-allocate and reuse buffers** — a free-list of `Position` objects for bullets, grow-only scratch arrays for this frame's hits.
- **Pre-create queries outside the loop.** `world.query(...)` registers the query on the world permanently: every later `add`, `remove` and `destroy` re-checks it, and nothing drops it until `world.removeQuery(q)`. A `query()` call inside `onUpdate` adds one more such query every frame. Create it once in `onReady`.
- **`Float32Array` for bulk numeric data** — not needed here; a few dozen `{ x, y }` objects are the bulk.

Two ECS facts shape the code below. Component data is stored by reference, so a pooled `Position` handed to `world.add` is the object the movement system mutates, and the same reference can go back to the pool when the bullet dies. And `query.entities` is the live id array: walk it by index (a `for...of` allocates an iterator, and on Hermes a result object per entity) and never destroy while walking — destroying swaps another id into the slot under you. Collect first, act after.

---

## Pre-allocate the pool and the query

```ts
import { defineComponent, Position, type Query, type World } from '@flare-engine/ecs';
import type { SpriteData } from '@flare-engine/render';

/** Tag component — no data, just membership in the bullet query. */
export const Bullet = defineComponent('Bullet');

/** Hard cap on live bullets: the pool never holds more than this. */
export const MAX_BULLETS = 64;
export const BULLET_SPEED = 420;

export interface BulletState {
  /** Free Position objects. Every bullet's Position is either here or on a live entity. */
  readonly pool: Array<{ x: number; y: number }>;
  /** One Velocity object shared by every bullet entity. */
  readonly velocity: { x: number; y: number };
  /** One SpriteData shared by every bullet entity. */
  readonly sprite: SpriteData;
  /** Registered once here, walked every frame. */
  readonly query: Query;
}

export function createBulletState(world: World, sprite: SpriteData): BulletState {
  const pool: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < MAX_BULLETS; i++) pool.push({ x: 0, y: 0 });
  return {
    pool,
    velocity: { x: 0, y: -BULLET_SPEED },
    sprite,
    query: world.query(Position, Bullet),
  };
}
```

`Velocity` and `Sprite` are shared references on purpose: every bullet moves the same way and looks the same, so one object each is enough and nothing is copied per shot. Mutating either would change every live bullet.

---

## Fire from the pool

```ts
import { type ComponentDef, Position, Velocity, type World } from '@flare-engine/ecs';
import { Sprite, type SpriteData } from '@flare-engine/render';

// From the previous section.
declare const Bullet: ComponentDef<undefined>;
declare const state: {
  pool: Array<{ x: number; y: number }>;
  velocity: { x: number; y: number };
  sprite: SpriteData;
};

export function fireBullet(world: World, x: number, y: number): void {
  const pos = state.pool.pop();
  if (pos === undefined) return; // pool exhausted — the shot is dropped

  pos.x = x;
  pos.y = y;
  const id = world.spawn();
  world.add(id, Position, pos);
  world.add(id, Velocity, state.velocity); // shared reference
  world.add(id, Sprite, state.sprite); // shared reference
  world.add(id, Bullet);
}
```

When the pool is empty, `pop()` returns `undefined` and `fireBullet` returns before `world.spawn()`: no entity, no throw, no allocation — the shot simply does not happen. `MAX_BULLETS` is therefore the hard cap on live bullets, and the pool is the only thing that enforces it. The `shmup` template's `fireBullet` and `spawnEnemy` both behave this way.

---

## Return positions before destroying

A bullet leaves in two ways: off screen, or on a hit. Both paths must push its `Position` back to the pool *before* `world.destroy(id)`, because `destroy` drops the component data and the reference with it.

The off-screen path is the engine's bounds-cull system. It never destroys on its own — `onCull` is your destroy-or-pool policy, called after the read loop. Pass the bullet query as its fourth argument so it scans bullets only and registers no query of its own.

```ts
import {
  type ComponentDef,
  createBoundsCullSystem,
  createMovementSystem,
  Position,
  type Query,
  type World,
} from '@flare-engine/ecs';

// From the previous sections.
declare const Bullet: ComponentDef<undefined>;
declare const state: { pool: Array<{ x: number; y: number }>; query: Query };
declare const world: World;

/** Mutable on purpose — read live each frame, so resize it after layout. */
export const bounds = { minX: -32, minY: -64, maxX: 432, maxY: 900 };

world.addSystem(createMovementSystem(world).worldFn, 0); // integrate Position by Velocity first
world.addSystem(
  createBoundsCullSystem(
    world,
    bounds,
    (id, w) => {
      const pos = w.get(id, Position);
      if (pos !== undefined) state.pool.push(pos);
      w.destroy(id);
    },
    state.query,
  ).worldFn,
  2, // cull after movement
);
```

The `shmup` template culls bullets and enemies with one system over all `Position` holders and branches on `w.has(id, Bullet)` / `w.has(id, Enemy)` to pick the pool; the shape is the same.

---

## Walk the query, then destroy

The hit path walks the bullet query by index, collects the ids to remove into a scratch array, and only then returns their positions and destroys them.

```ts
import { Position, type Query, type World } from '@flare-engine/ecs';

// From the previous sections.
declare const world: World;
declare const state: { pool: Array<{ x: number; y: number }>; query: Query };
declare function hitsEnemy(x: number, y: number): boolean;

// Grow-only scratch: reset with `.length = 0`, never reallocated once at peak size.
const hit: number[] = [];

export function stepBullets(): void {
  hit.length = 0;

  const ids = state.query.entities;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const pos = world.get(id, Position);
    if (pos !== undefined && hitsEnemy(pos.x, pos.y)) hit.push(id);
  }

  for (let i = 0; i < hit.length; i++) {
    const id = hit[i]!;
    if (!world.exists(id)) continue;
    const pos = world.get(id, Position);
    if (pos !== undefined) state.pool.push(pos);
    world.destroy(id);
  }
}
```

`pool.push` here never grows the array past its initial length: every `Position` is either in the pool or on exactly one live entity, so the pool can only refill to `MAX_BULLETS`.

---

## Wire it into GameView

`GameView` does not step the world for you. In `onReady`, register the systems and create the state once, then in `onUpdate` call `world.step(dt)` (movement, then cull) before your own logic fires and resolves hits.

```ts
import type { GameContextValue } from '@flare-engine/react';
import type { World } from '@flare-engine/ecs';

// From the previous sections.
declare const ctx: GameContextValue;
declare const bounds: { minX: number; minY: number; maxX: number; maxY: number };
declare const player: { x: number; y: number };
declare function fireBullet(world: World, x: number, y: number): void;
declare function stepBullets(): void;

const FIRE_INTERVAL = 0.12;
let fireTimer = 0;

ctx.loop.onUpdate.add((dt) => {
  // The viewport reads 0 until layout is measured; fall back to the portrait defaults until then,
  // or the first frames would cull every bullet past x = 32. Pure number writes each frame.
  const vw = ctx.camera.viewportWidth > 0 ? ctx.camera.viewportWidth : 400;
  const vh = ctx.camera.viewportHeight > 0 ? ctx.camera.viewportHeight : 750;
  bounds.maxX = vw + 32;
  bounds.maxY = vh + 64;

  ctx.world.step(dt); // movement at priority 0, cull at priority 2

  fireTimer += dt;
  while (fireTimer >= FIRE_INTERVAL) {
    fireTimer -= FIRE_INTERVAL;
    fireBullet(ctx.world, player.x, player.y - 16);
  }

  stepBullets();
});
```

Real-world reference: the `shmup` template (`npm create @flare-engine my-game -- --template shmup`) keeps all of this in `src/logic.ts` with no React or Skia import, so `tests/logic.test.ts` runs it under `bun test` without mocks; `src/App.tsx` is the thin shell that builds the atlas, spawns the player and wires `onUpdate`.
