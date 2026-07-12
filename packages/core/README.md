# @flare-engine/core

Core runtime — `GameLoop` (fixed-timestep with onUpdate / onFixedUpdate / onLateUpdate signals), `Clock` (delta + scaled time), `AppLifecycle` (background/foreground hooks), `ScreenManager` (FIT / FILL / STRETCH + safe-area), `CoroutineManager` (generator-based sequencing), `Pool<T>` (zero-alloc reuse).

## Install

```sh
bun add @flare-engine/core
```

## Usage

```ts
import { GameLoop, Pool } from '@flare-engine/core';

function updateGame(dt: number): void {
  // advance game state by dt seconds
}

const loop = new GameLoop({ fixedDt: 1 / 60 });
loop.onUpdate.add((dt) => updateGame(dt));
loop.start();

const bullets = new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
const b = bullets.acquire();
bullets.release(b);
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginecore--3kb-gzip).

## License

Apache-2.0
