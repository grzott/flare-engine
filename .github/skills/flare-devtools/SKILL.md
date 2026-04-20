---
name: flare-devtools
description: Deep knowledge of the @flare-engine/devtools package — DevtoolsProvider, DevtoolsPanel, DevtoolsHUD, useEntityInspector, useTimeScrub hooks, entity inspector, time-scrub ring buffer, pause/step. Use when wiring the in-game devtools overlay or inspecting ECS state at runtime.
---

# `@flare-engine/devtools`

Tooling package. 0.1.0 ships the partial slice (inspector + time scrub + pause/step); the full panel lands in 0.2.0.

## Exports

```ts
import {
  DevtoolsProvider,
  type DevtoolsProviderProps,
  useDevtools,
  useEntityInspector,
  useTimeScrub,
  type EntityInspectorView,
  type TimeScrubView,
  DevtoolsPanel,
  DevtoolsHUD,
} from "@flare-engine/devtools";
```

## Usage sketch

```tsx
<DevtoolsProvider game={game} historySize={120}>
  <GameView config={config} />
  {__DEV__ && <DevtoolsHUD />}
  {__DEV__ && Platform.OS === "web" && <DevtoolsPanel />}
</DevtoolsProvider>
```

## Rules

- Time scrub works by snapshotting world state into a ring buffer — `historySize` frames of memory. Default 60; scale by entity count.
- Web gets the full `DevtoolsPanel` (mouse + keyboard); native gets `DevtoolsHUD` only.
- Wrap in `__DEV__` so tsup strips the tree in production builds.

Spec: [docs/design/api-specs.md § @flare-engine/devtools](../../../docs/design/api-specs.md).
