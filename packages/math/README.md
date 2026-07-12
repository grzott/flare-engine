# @flare-engine/math

2D math primitives for the Flare engine — `Vec2`, `Rect`, `Circle`, `Transform2D`, `Mat3`, `Color`, 35 easing functions, seeded RNG, intersection tests, angle/steering helpers (`angleDelta`, `rotateTowards`, `Vec2.turnVelocityToward`), weighted random picks (`weightedIndex`, `weightedIndexBy`, `weightedPick`), deterministic hash utils (`hashU32`, `seededIndex`), and timed-window reward math (`cappedBonus`, `advanceWindowedStreak`, `windowExpired`, `remainingInWindow`). Plain-object types with static method namespaces; zero-alloc forms take an `out` parameter to avoid GC pressure in game loops.

## Install

```sh
bun add @flare-engine/math
```

## Usage

```ts
import { vec2, Vec2, Rect, easeOutQuad, SeededRNG } from '@flare-engine/math';

const a = vec2(0, 0);
const b = vec2(10, 0);
const out = vec2(0, 0);
Vec2.lerp(a, b, 0.5, out);

const rng = new SeededRNG(42);
const t = easeOutQuad(rng.float(0, 1));
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginemath--5kb-gzip).

## License

MIT
