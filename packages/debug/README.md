# @flare-engine/debug

Dev-only stats + overlays. `StatsTracker` collects per-frame timings via `updateFromClock` / `setEntityCount` / `setDrawCalls`; `createFpsWidget` formats a one-line `"60 FPS | 16.7ms | e:42 d:8"` summary plus a multi-line breakdown — rendering-agnostic so hosts can draw via Skia or RN `<Text>`. `TimeControl` exposes pause / step-frame / slow-motion via `Clock.timescale`.

## Install

```sh
bun add @flare-engine/debug
```

## Usage

```ts
import { StatsTracker, createFpsWidget, TimeControl } from '@flare-engine/debug';
import type { Clock } from '@flare-engine/core';

const tracker = new StatsTracker();
const widget = createFpsWidget();

declare const clock: Clock;
const time = new TimeControl(clock);

// per frame (fps/rawDt/dt/frame come from your Clock tick):
declare const fps: number, rawDt: number, dt: number, frame: number;
tracker.updateFromClock(fps, rawDt, dt, frame);
tracker.setEntityCount(42);
tracker.setDrawCalls(8);

widget.update(tracker.stats);
const line = widget.line; // "60 FPS | 16.7ms | e:42 d:8"

// pause / step / slow-motion:
time.pause();
time.step();
time.setTimescale(0.5);
```

Tree-shaken in production via `__DEV__` guard at the call site.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginedebug--3kb-gzip-tree-shaken-in-prod).

## License

Apache-2.0
