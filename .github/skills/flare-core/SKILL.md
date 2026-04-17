---
name: flare-core
description: Deep knowledge of the @flare/core package — GameLoop, Clock, Coroutines, Pool, ScreenManager, AppLifecycle. Use this skill when writing or debugging game loop logic, coroutine-based sequencing, object pooling, or screen/viewport configuration.
---

# @flare/core

Low-level runtime primitives for the Flare game engine. Layer 1 — depends only on `@flare/math` and `@flare/events`.

## Exports

```ts
import {
  GameLoop, // Fixed-timestep loop
  Clock, // Wall time + delta tracking
  AppLifecycle, // Background/foreground events
  ScreenManager, // Logical resolution, safe area
  CoroutineManager, // Generator-based sequencing
  Pool, // Object pool (zero-alloc reuse)
} from "@flare/core";
```

---

## GameLoop

Fixed-timestep update loop with variable rendering.

```ts
const loop = new GameLoop({
  fixedHz: 60, // physics / logic tick rate
  maxStepsPerFrame: 5, // guard against spiral of death
});

loop.onFixedUpdate = (dt) => {
  /* game logic, dt = 1/60 */
};
loop.onUpdate = (dt) => {
  /* frame update */
};
loop.onRender = (alpha) => {
  /* interpolation factor 0–1 */
};

loop.start();
loop.stop();
loop.isRunning; // boolean
```

**Key invariant:** `onFixedUpdate` is always called at exactly `fixedHz`. `onRender` receives `alpha = accumulated / fixedStep` for sub-frame interpolation.

---

## Clock

Tracks wall time and per-frame delta.

```ts
const clock = new Clock();

clock.tick(); // call once per frame before logic
clock.delta; // seconds since last tick (capped)
clock.elapsed; // total seconds since first tick
clock.frameCount; // total frames
clock.fps; // exponential moving average
clock.scale; // time scale multiplier (default 1)
clock.reset();
```

**Time scale:** setting `clock.scale = 0.5` runs game logic at half speed without affecting wall time. Useful for slow-motion.

---

## AppLifecycle

Observes React Native `AppState` changes.

```ts
const lifecycle = new AppLifecycle();

lifecycle.onForeground = () => {
  loop.start();
};
lifecycle.onBackground = () => {
  loop.stop();
};

lifecycle.subscribe(); // attach AppState listener
lifecycle.dispose(); // detach listener
```

---

## ScreenManager

Logical resolution → physical resolution mapping.

```ts
const screen = new ScreenManager({
  width: 390,
  height: 844,
  scaleMode: "fit", // "fit" | "fill" | "stretch" | "none"
  safeArea: { top: 44, bottom: 34, left: 0, right: 0 },
});

screen.update(physicalW, physicalH);

screen.scale; // uniform scale factor
screen.offsetX; // letterbox / pillarbox offset
screen.offsetY;
screen.safeTop; // safe area in logical coords
```

---

## CoroutineManager

Async-style sequencing via generators.

```ts
const coroutines = new CoroutineManager();

function* spawnEffect(): CoroutineGenerator {
  yield { type: "seconds", value: 0.5 }; // wait 0.5s
  yield { type: "frames", value: 10 }; // wait 10 frames
  yield { type: "until", fn: () => player.grounded }; // wait condition
  doNextThing();
}

const handle: CoroutineHandle = coroutines.start(spawnEffect());
coroutines.update(dt); // call each frame
coroutines.stop(handle);
coroutines.stopAll();
```

**Yield types:** `{ type: "frames", value: n }`, `{ type: "seconds", value: s }`, `{ type: "until", fn: () => bool }`

---

## Pool

Generic zero-alloc object pool.

```ts
const bulletPool = new Pool<Bullet>(
  () => new Bullet(), // factory
  (b) => b.reset(), // reset on return
  32, // initial capacity
);

const bullet = bulletPool.acquire();
// ... use bullet ...
bulletPool.release(bullet);

bulletPool.size; // total objects in pool
bulletPool.available; // objects ready to acquire
```

**Hot path rule:** never call `new` inside a game loop. Acquire from pool, release when done.
