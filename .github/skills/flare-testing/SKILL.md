---
name: flare-testing
description: Deep knowledge of the @flare-engine/testing package — createFakeClock, createTestWorld, MockInputManager, serializeScene, snapshotsEqual. Use when writing deterministic ECS/game tests, scripting pointer sequences, or asserting on scene snapshots in Flare.
---

# `@flare-engine/testing`

Layer 2.5. Dev-only — never bundled into apps. Replaces real clocks and native input bridges with deterministic fakes.

## Exports

```ts
import {
  createFakeClock,
  type FakeClock,
  createTestWorld,
  type TestWorld,
  type CreateTestWorldOptions,
  MockInputManager,
  createMockInputManager,
  serializeScene,
  snapshotsEqual,
  type SceneSnapshot,
  type SceneSnapshotEntity,
} from "@flare-engine/testing";
```

## Usage sketch

```ts
const { world, step, stepFrames } = createTestWorld({ fixedDt: 1 / 60 });
world.addSystem(mySystem);
stepFrames(30, 1 / 60);

const input = createMockInputManager();
input.press(0, 100, 200);
input.move(0, 110, 200);
input.release(0);

const before = serializeScene(world, [Position, Health]);
// …run game logic…
const after = serializeScene(world, [Position, Health]);
expect(snapshotsEqual(before, after)).toBe(false);
```

## Rules

- Call `step` / `stepFrames` in tests — do not call `loop.start()`, which uses the real frame clock.
- `serializeScene` uses stable key order — safe for diffing / JSON snapshots.
- `@flare-engine/core` is allowed to import this package as a dev-only dependency (the graph stays acyclic because testing → core at runtime is the only direction).

Spec: [docs/design/api-specs.md § @flare-engine/testing](../../../docs/design/api-specs.md).
