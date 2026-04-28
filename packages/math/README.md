# @flare-engine/math

2D math primitives for the Flare engine — `Vec2`, `Rect`, `Circle`, `Transform2D`, `Mat3`, `Color`, 32 easing functions, seeded RNG, and intersection tests. Plain-object types with static method namespaces; zero-alloc forms take an `out` parameter to avoid GC pressure in game loops.

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
const t = easeOutQuad(rng.float());
```

See [API spec](../../docs/design/api-specs.md#flare-enginemath--5kb-gzip) and [skill reference](../../.github/skills/flare-math/SKILL.md).

## License

MIT
