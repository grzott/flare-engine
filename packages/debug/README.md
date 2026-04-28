# @flare-engine/debug

Dev-only stats + overlays. `StatsTracker` records frame timings; `DebugStats` is a snapshot; `createFpsWidget` formats a one-line `"60 FPS | 16.7ms | e:42 d:8"` summary plus a multi-line breakdown — rendering-agnostic so hosts can draw via Skia or RN `<Text>`. `TimeControl` exposes pause / step-frame / slow-motion via `timeScale`.

## Install

```sh
bun add @flare-engine/debug
```

## Usage

```ts
import { StatsTracker, createFpsWidget, TimeControl } from '@flare-engine/debug';

const stats = new StatsTracker();
const fpsWidget = createFpsWidget();
const time = new TimeControl();

// per frame:
stats.beginFrame();
// ...sim...
stats.endFrame(drawCalls, entityCount);
const line = fpsWidget.formatLine(stats.snapshot());
```

Tree-shaken in production via `__DEV__` guard at the call site.

See [API spec](../../docs/design/api-specs.md#flare-enginedebug--3kb-gzip-tree-shaken-in-prod) and [skill reference](../../.github/skills/flare-debug/SKILL.md).

## License

MIT
