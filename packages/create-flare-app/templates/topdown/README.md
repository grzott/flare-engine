# {{APP_NAME}}

A Flare engine app scaffolded from the `{{TEMPLATE_ID}}` template.

## Develop

```bash
bun install
bun run start
```

Press `a` for Android or `i` for iOS once the Metro bundler is ready.

## What this template demonstrates

A top-down starter that wires the full tilemap pipeline:

- `src/map.ts` — edit `MAP_ART` (ASCII art: `#` wall, `.` grass, `~` water, `,` sand) to reshape the map.
- Collision: `@flare-engine/physics` `buildSolidGrid` + `moveAndSlideInto` over wall and water tiles; axis-separated slide so diagonal inputs slide along walls instead of stopping.
- Camera: `camera.follow` tracks the player; zoom is set to 2×.
- A `VirtualJoystick` drives analog movement — all 8 directions and diagonals work.

## Layout

- `src/App.tsx` — root component; mounts `<GameView>` and configures the Flare game loop.
- `src/map.ts` — ASCII-art map, Tiled JSON builder, and `loadMap()`.
- `index.ts` — Expo entry that registers `App` as the root component.
- `app.json` — Expo configuration.

## Tests

```bash
bun test
```

Runs `tests/tilemap.test.ts` — validates the map parse, collider extraction, solid-grid query, and slide-on-wall behavior.

## Docs

- [Flare engine](https://github.com/grzott/flare-engine)
