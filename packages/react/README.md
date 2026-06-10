# @flare-engine/react

React Native integration — `<GameView>` (Skia Canvas + game loop + input), `<VirtualJoystick>` / `<VirtualButton>` / `<LoadingScreen>` overlays, `useGame` / `useEntity` / `useGameLoop` hooks. `createSkiaFrameRenderer` adapts a `@flare-engine/render` `Renderer` to Skia's frame callback.

## Install

```sh
bun add @flare-engine/react @shopify/react-native-skia
```

Peer deps: `react`, `react-native`.

## Usage

```tsx
import { GameView, VirtualJoystick, useGameLoop } from '@flare-engine/react';

function HUD() {
  useGameLoop((dt) => { /* ...frame logic... */ });
  return null;
}

<GameView
  config={{ designResolution: { width: 1080, height: 1920 }, fixedDt: 1 / 60 }}
  onReady={(ctx) => bootstrap(ctx)}
>
  <HUD />
  <VirtualJoystick onChange={(v) => /* ... */} />
</GameView>
```

See [API spec](../../docs/design/api-specs.md#flare-enginereact--10kb-gzip).

## License

MIT
