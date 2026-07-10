# @flare-engine/engine

Convenience integration layer — `createGame(config)` is a pure factory that constructs `World` + `Camera2D` + `Renderer` + `SpriteBatch` + `InputManager` + `AudioManager` + `AssetManager` + `SceneManager` + `GameLoop` and returns them with `start()` / `stop()`. Does **not** own the render loop or Skia canvas lifecycle — those belong to `@flare-engine/react`.

The package also re-exports all 15 lower `@flare-engine/*` packages as a convenience umbrella. This is the one place tree-shaking is deliberately sacrificed for DX.

`createTier2Wiring` glues optional `AchievementsProvider` / `LeaderboardsProvider` / `AnalyticsProvider` instances to a Tier-2 event source via declarative rules.

## Install

```sh
bun add @flare-engine/engine
```

## Usage

```ts
import { createGame } from '@flare-engine/engine';

const game = createGame({
  designResolution: { width: 1080, height: 1920 },
  fixedDt: 1 / 60,
});
game.start();
```

See [API spec](../../docs/design/api-specs.md#flare-engineengine--2kb-gzip).

## React Native New Architecture

Flare's engine packages are architecture-agnostic pure TypeScript — they run on both the legacy and the New Architecture, so the engine itself imposes no New-Architecture requirement. The `react-native >= 0.79` peer floor still admits old-architecture apps (RN 0.79–0.81 ship the legacy renderer by default).

The requirement comes from your app's *other* native dependencies, not from Flare. Notably, `react-native-reanimated` v4 is New-Architecture-only — if you pin Reanimated 4 (or any other New-Arch-only native module), enable the New Architecture. The Flare engine works either way.

## License

MIT
