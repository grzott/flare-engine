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

## Coroutines

`yield` a number to wait that many scaled seconds, `undefined` to wait one frame, or a Promise to
wait for it. A coroutine ends exactly one of three ways — completed, `cancelled`, or `failed` — and
`handle.done` is true for all three. `cancel()` and `clear()` both close the generator (a scene
teardown is a cancel from the coroutine's point of view), so a `finally` block is the place for
cleanup — it runs on completion, on cancel, on teardown and on failure alike. A rejected Promise is
thrown into the generator; catch it to keep going, or let it end the coroutine with `failed` set:

```ts
import { CoroutineManager } from '@flare-engine/core';

const coroutines = new CoroutineManager();
let bannerVisible = false;

const handle = coroutines.start(
  (function* () {
    try {
      bannerVisible = true;
      yield 2; // seconds, scaled time
      yield fetch('/api/score'); // a rejection is thrown into the generator
      yield undefined; // one frame
    } finally {
      bannerVisible = false; // runs on completion, cancel(), clear() and failure
    }
  })(),
);

// each frame
coroutines.update(1 / 60);

if (handle.failed) {
  console.warn('score fetch failed', handle.error);
} else if (handle.cancelled) {
  // ended early — cancel(), or the scene's clear() tore it down
}
handle.cancel(); // no-op once done; otherwise the finally block runs now
```

Failures are never re-raised as unhandled rejections — the handle is the only channel, so keep it
if you need to know. Test `handle.failed` rather than `handle.error`: a bare `reject()` rejects
with `undefined`.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginecore--3kb-gzip).

## License

Apache-2.0
