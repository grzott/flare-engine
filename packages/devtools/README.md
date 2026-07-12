# @flare-engine/devtools

In-game devtools — entity inspector, time scrub, pause / step. `<DevtoolsPanel>` is a web-only floating panel; `<DevtoolsHUD>` is a native-only compact overlay. Tree-shaken in production via `__DEV__` guards. The snapshot ring buffer pre-allocates frames at construction and reuses them in place — no per-frame allocation.

## Install

```sh
bun add @flare-engine/devtools
```

Peer deps: `react`, `react-native`.

## Usage

```tsx
import { DevtoolsProvider, DevtoolsPanel, DevtoolsHUD, useEntityInspector } from '@flare-engine/devtools';
import type { World } from '@flare-engine/ecs';
import type { GameLoop } from '@flare-engine/core';
import type { ReactNode } from 'react';

declare const world: World;
declare const loop: GameLoop;
declare const __DEV__: boolean;

function App({ children }: { children?: ReactNode }) {
  if (!__DEV__) return <>{children}</>;
  return (
    <DevtoolsProvider
      world={world}
      loop={loop}
      snapshot={() => ({})}
      config={{ ringSize: 120 }}
    >
      {children}
      <DevtoolsPanel />
      <DevtoolsHUD />
    </DevtoolsProvider>
  );
}

function CustomInspector() {
  const { selected, entities } = useEntityInspector();
  // ...
}
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginedevtools--8kb-gzip-tree-shaken-in-prod).

## License

Apache-2.0
