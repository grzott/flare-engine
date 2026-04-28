# @flare-engine/testing

Deterministic test helpers for ECS games. Pure dev-time package — never bundled into apps. `createFakeClock` is a deterministic `requestFrame` / `cancelFrame` replacement; `createTestWorld` wires a `World` + `GameLoop` + fake clock together; `MockInputManager` extends the real `InputManager` with scriptable pointer sequences; `serializeScene` / `snapshotsEqual` enable regression-style snapshot tests.

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
expect(snap.entities[0].components.Position.x).toBe(60);
```

See [API spec](../../docs/design/api-specs.md#flare-enginetesting--4kb-raw) and [skill reference](../../.github/skills/flare-testing/SKILL.md).

## License

MIT
