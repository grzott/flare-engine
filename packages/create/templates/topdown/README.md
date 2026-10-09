# {{APP_NAME}}

A Flare engine app scaffolded from the `{{TEMPLATE_ID}}` template.

## Develop

```bash
bun install
bun run android   # or: bun run ios
```

`@shopify/react-native-skia` is a **native** module, so this template needs a
dev build — it cannot run in Expo Go. `bun run start` then pressing `a`/`i`
opens Expo Go and red-screens with a missing-native-module error. `bun run
android` builds and installs a dev client instead; after that first build,
`bun run start` attaches to it normally.

The first Android build takes a few minutes and needs the Android SDK plus a
JDK. Two things that will otherwise cost you an afternoon:

- **Build from a short path.** Skia's CMake step generates paths ~120
  characters longer than your project directory, and Windows still fails at 260
  (`CreateProcess error=2`). `C:\src\my-app` is fine; a deep temp path is not.
- **Do not remove `trustedDependencies` from `package.json`.** Bun blocks
  install scripts it does not trust, and Skia's `postinstall` is what unpacks
  its prebuilt binaries. Without it the install still succeeds and the Android
  build fails minutes later with `Could not find libskia.a`.

## Run in a browser

```bash
bun run web
```

The `web` script copies CanvasKit's wasm binary into `public/` before starting
Metro, because Skia on web is CanvasKit and it has to be served alongside the
bundle. Starting the dev server any other way — `bun run start` then pressing
`w` — skips that copy and the canvas stays blank.

The binary is ~8 MB and is `.gitignore`d: it is a copy of
`canvaskit-wasm/bin/full/canvaskit.wasm`, reproduced by the script on demand.
It must be the `full` build; the smaller default build is ABI-incompatible with
the loader.

## What this template demonstrates

A top-down starter built around one scene: a 4x8 house on an open field,
with rocks and an openable door.

- `src/map.ts` — edit `MAP_ART` (ASCII art: `#` wall, `.` grass, `R` rock, `D` door) to reshape the map.
- Collision: `@flare-engine/physics` `buildSolidGrid` + `moveAndSlideInto` over wall, rock, and closed-door tiles; axis-separated slide so diagonal inputs slide along walls instead of stopping.
- **The door**: walking into it while closed opens it — `map.ts`'s `openDoor` flips its cell in the `SolidGrid.solid` array and swaps its tile GID so the render picks up the open frame, both plain zero-alloc index writes into arrays the engine already owns. That is a tile whose solidity changes at runtime, not just its colour; `isBlockedAABB`/`moveAndSlideInto` treat the door exactly like a wall until it's opened.
- Camera: `camera.follow` tracks the player; zoom is set to 2×.
- A `VirtualJoystick` drives analog movement — all 8 directions and diagonals work.

## Layout

- `src/App.tsx` — root component; mounts `<GameView>` and configures the Flare game loop.
- `src/map.ts` — ASCII-art map, Tiled JSON builder, and `loadMap()`.
- `index.ts` — Expo entry that registers `App` as the root component (native).
- `index.web.ts` — web entry; awaits `LoadSkiaWeb()` **before** importing `App`.
  `package.json`'s `main` is extensionless so Metro resolves the right entry per
  platform. The split is required: RN-Skia's web module reads `global.CanvasKit`
  when it is first imported, so importing `App` any earlier leaves Skia hollow.
- `scripts/copy-canvaskit.mjs` — copies the CanvasKit wasm into `public/` for the
  web build.
- `app.json` — Expo configuration.

## Tests

```bash
bun test
```

Runs `tests/tilemap.test.ts` — validates the map parse, collider extraction, solid-grid query, and that the closed door blocks while the open door and wall/rock collision are unaffected by opening it.

## Docs

- [Flare engine](https://github.com/grzott/flare-engine)
