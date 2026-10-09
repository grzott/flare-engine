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

Flare's headless packages are architecture-agnostic pure TypeScript. **`@flare-engine/react` requires the New Architecture.** It peers `react-native-reanimated >= 4.0.0` and `react-native-worklets >= 0.7.0`, and Reanimated 4 is New-Architecture-only — so an app using `<GameView>` must run with `newArchEnabled=true`.

In practice this costs nothing: the New Architecture has been RN's default since 0.76, and every `@flare-engine/create` template pins Expo 57 / RN 0.86, which force it on.

> **Old-architecture support was dropped deliberately, in [ADR-0002](https://github.com/grzott/flare-engine/blob/main/docs/design/adr-0002-worklets-migration-and-new-arch-floor.md).** The earlier `>= 3.19.1` floor was chosen to keep Reanimated 3 — and therefore old-architecture apps — viable, but the claim was never verifiable: no scaffolder template can produce such an app, because `expo prebuild` overrides an `app.json` opt-out. Rather than keep shipping a promise we could not test, the engine now depends on `react-native-worklets` directly, which also removes a per-frame allocation on the native render path.

## License

Apache-2.0
