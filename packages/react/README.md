# @flare-engine/react

React Native integration — `<GameView>` (Skia Canvas + game loop + input), `<VirtualJoystick>` / `<VirtualButton>` / `<LoadingScreen>` overlays, `useGame` / `useEntity` / `useGameLoop` hooks. `createSkiaFrameRenderer` adapts a `@flare-engine/render` `Renderer` to Skia's frame callback.

## Install

```sh
bun add @flare-engine/react @shopify/react-native-skia react-native-safe-area-context
```

Peer deps: `react` (>=19), `react-native` (>=0.79), `@shopify/react-native-skia` (>=2), `react-native-safe-area-context` (>=4). The last one is a value import in `<GameView>` (`useSafeAreaInsets`), not type-only — a project without it fails to resolve at runtime.

## Usage

```tsx
import React from 'react';
import {
  GameView,
  VirtualJoystick,
  useGameLoop,
  type GameContextValue,
} from '@flare-engine/react';

function HUD() {
  useGameLoop((_dt) => {
    // per-frame logic here
  });
  return null;
}

function bootstrap(_ctx: GameContextValue): void {
  // initialise scenes, load assets, etc.
}

export function App() {
  return (
    <GameView
      config={{ fixedDt: 1 / 60 }}
      onReady={(ctx) => bootstrap(ctx)}
    >
      <HUD />
      <VirtualJoystick onStateChange={(_state) => {}} />
    </GameView>
  );
}
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginereact--10kb-gzip).

## License

Apache-2.0
