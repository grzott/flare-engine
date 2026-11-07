# @flare-engine/testing

Deterministic test helpers for ECS games. A dev-time package by default — it is not bundled into apps unless an app opts in for the one runtime use described under [Bench harnesses](#bench-harnesses). `createFakeClock` is a deterministic `requestFrame` / `cancelFrame` replacement; `createTestWorld` wires a `World` + `GameLoop` + fake clock together; `createHeadlessContext` builds on it to stand in for the React `GameContextValue` (camera, input, assets, sheet) without React Native or Skia; `MockInputManager` extends the real `InputManager` with scriptable pointer sequences; `serializeScene` / `snapshotsEqual` enable regression-style snapshot tests.

## Install

```sh
bun add -d @flare-engine/testing
```

## Usage

```ts
import { createTestWorld, MockInputManager, serializeScene } from '@flare-engine/testing';
import { Position, Velocity } from '@flare-engine/ecs';

const { world, step, stepFrames } = createTestWorld({ fixedDt: 1 / 60 });
const e = world.spawn();
world.add(e, Position, { x: 0, y: 0 });
world.add(e, Velocity, { x: 1, y: 0 });

stepFrames(60, 1 / 60);

const snap = serializeScene(world, [Position]);
// components values are typed unknown; cast to the component shape to read fields
const posX = (snap.entities[0]?.components['Position'] as { x: number } | undefined)?.x;
const passed: boolean = posX === 60;
```

## Headless context

`createHeadlessContext` returns the `createTestWorld` members plus a real `Camera2D`, a `MockInputManager`, an `AssetManager` with a resolve-`null` loader, a permissive `SpriteSheet` and a caller-supplied `scenes` slot. `loop.onLateUpdate` runs `camera.update(dt)` then `input.update()` each frame, the same wiring `GameView` installs.

```ts
import { getFrame } from '@flare-engine/assets';
import { createHeadlessContext } from '@flare-engine/testing';

const ctx = createHeadlessContext({ viewportWidth: 320, viewportHeight: 180 });
ctx.camera.shake(8, 0.5);
ctx.input.tap(10, 10);
ctx.stepFrames(10);

// camera.update(dt) and input.update() ran on every stepped frame
const shaking: boolean = ctx.camera.effectiveX !== ctx.camera.x;
const tapCleared: boolean = ctx.input.pointer.justPressed === false;
// the permissive sheet resolves every frame name to its single 8x8 frame
const frame = getFrame(ctx.sheet, 'any-name');
```

## Bench harnesses

`createBenchSession` is a test-runner primitive, not an app-side one. It replaces `Math.random` with a seeded RNG for the life of the session (until `end()` restores it), and its `whenDone` latch is a Promise for a test to `await` — not a synchronous flag a render loop can poll each frame. It is meant to wrap one deterministic scenario inside a test runner.

In-app bench harnesses — a scenario runner that ships in app code, its done-latch (a synchronous `isBenchDone()` or similar), its flags and its reporting — are **consumer-owned**. The engine does not ship one, and no runtime package re-exports `createBenchSession`. Write the harness in the app; share with it only what it actually needs from the engine (for example a `SeededRNG` from `@flare-engine/math`).

An app that does want the seeded session at runtime may list `@flare-engine/testing` as a regular `dependency` instead of a `devDependency`. Its own dependencies are the `@flare-engine/*` runtime packages `assets`, `core`, `ecs`, `input`, `math` and `render` only, with no peer dependencies, so nothing outside the engine enters the bundle.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginetesting--4kb-raw).

## License

Apache-2.0
