# @flare-engine/engine

Convenience integration layer — `createGame(config)` is a pure factory that constructs `World` + `Camera2D` + `Renderer` + `SpriteBatch` + `InputManager` + `AudioManager` + `AssetManager` + `SceneManager` + `GameLoop` and returns them with `start()` / `stop()`. Does **not** own the render loop or Skia canvas lifecycle — those belong to `@flare-engine/react`.

The package ships two entry points:

- **`.` (default)** — full curated barrel: the 14 headless packages + `@flare-engine/dynamics` + `@flare-engine/postfx` + curated `@flare-engine/react` exports. Pulls in React Native at module scope. `CompiledShader` and `SkImageLike` from postfx are aliased as `PostFxCompiledShader` and `PostFxSkImageLike` to avoid clashing with the render/assets versions. Dynamics' `World` and `Body` are aliased as `DynamicsWorld` and `DynamicsBody` so the ECS `World` keeps the name. React's `GameConfig` is re-exported as `GameViewConfig` to avoid clashing with `createGame`'s own `GameConfig`.
- **`./headless`** — RN-free subset: the 14 headless packages (math, events, core, ecs, render, input, physics, audio, assets, scene, animation, particles, tilemap, debug) plus `createGame` and tier2-wiring. No `@flare-engine/react`, no `@flare-engine/postfx`, no `@flare-engine/dynamics`. Safe for web-only and Node consumers.

`createTier2Wiring` glues optional `AchievementsProvider` / `LeaderboardsProvider` / `AnalyticsProvider` instances to a Tier-2 event source via declarative rules.

## Install

```sh
bun add @flare-engine/engine
```

## Usage — full stack (React Native + Web)

```ts
import { createGame } from '@flare-engine/engine';

const game = createGame({ fixedDt: 1 / 60 });
game.start();
```

## Usage — headless (web-only / Node / tests)

```ts
import { createGame, World, GameLoop } from '@flare-engine/engine/headless';

const game = createGame({ fixedDt: 1 / 60 });
game.start();
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineengine--2kb-gzip).

## React Native New Architecture

Flare's engine packages are architecture-agnostic pure TypeScript — they run on both the legacy and the New Architecture, so the engine itself imposes no New-Architecture requirement. The `react-native >= 0.79` peer floor still admits old-architecture apps: the New Architecture has been the default since RN 0.76, but 0.79-0.81 still allow an explicit `newArchEnabled: false` opt-out, and Flare runs either way.

The requirement comes from your app's *other* native dependencies, not from Flare. Notably, `react-native-reanimated` v4 is New-Architecture-only — if you pin Reanimated 4 (or any other New-Arch-only native module), enable the New Architecture. The Flare engine works either way.

## License

Apache-2.0
