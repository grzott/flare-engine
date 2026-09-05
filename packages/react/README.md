# @flare-engine/react

React Native integration — `<GameView>` (Skia Canvas + game loop + input), `<VirtualJoystick>` / `<VirtualButton>` / `<LoadingScreen>` overlays, `useGame` / `useEntity` / `useGameLoop` hooks. `createSkiaFrameRenderer` adapts a `@flare-engine/render` `Renderer` to Skia's frame callback.

## Install

```sh
bun add @flare-engine/react @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-safe-area-context
```

Peer deps: `react` (>=19), `react-native` (>=0.79), `@shopify/react-native-skia` (>=2), `react-native-reanimated` (>=4), `react-native-worklets` (>=0.7), `react-native-safe-area-context` (>=4). `react-native-reanimated`, `react-native-worklets` and `react-native-safe-area-context` are all value imports in `<GameView>` — a project without any of them fails to resolve at runtime.

> **The New Architecture is required.** Reanimated 4 is New-Architecture-only, so an app using
> `<GameView>` must run with `newArchEnabled=true`. This costs nothing in practice — it has been
> RN's default since 0.76, and every `create-flare-app` template pins Expo 57 / RN 0.86, which
> force it on. Old-architecture support was dropped deliberately in
> [ADR-0002](https://github.com/grzott/flare-engine/blob/main/docs/design/adr-0002-worklets-migration-and-new-arch-floor.md):
> the previous `>=3.19.1` floor promised something no scaffolder template could produce, so it was
> never verifiable.

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
