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

if (__DEV__) {
  <DevtoolsProvider world={world} loop={loop} config={{ ringSize: 120 }}>
    <DevtoolsPanel />
    <DevtoolsHUD />
  </DevtoolsProvider>
}

function CustomInspector() {
  const { selected, components } = useEntityInspector();
  // ...
}
```

See [API spec](../../docs/design/api-specs.md#flare-enginedevtools--8kb-gzip-tree-shaken-in-prod).

## License

MIT
