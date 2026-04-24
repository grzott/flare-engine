# Flare Engine

> Modular 2D game engine for React Native + Web, built on Skia

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](./tsconfig.base.json)

**Flare** is the first full-stack 2D game engine built for React Native. Ship the same codebase to iOS, Android, and the browser. Zero-alloc hot paths, archetype ECS, GPU sprite batching, and a device-verified end-to-end loop — all under the `@flare-engine/*` npm scope.

---

## Status

**Pre-release — 0.1.0 coming October 2026.**

- 34 packages implemented and tested (~1100+ tests, 0 failures)
- [`apps/pan-tvardowski`](apps/pan-tvardowski) — the canonical end-to-end reference + integration smoke test. Polish-folklore shmup, 8 zones playable, PL+EN; free zones 1–3 replace the retired `apps/demo` as the reference game. Design locked in [docs/plans/pan-tvardowski-build-plan.md](docs/plans/pan-tvardowski-build-plan.md)
- Phase 11 (OSS launch prep) is in progress — remaining work: landing-page MP4 + store-page links, Docusaurus site, device FPS capture, API snapshot lock, governance files, EUIPO trademark filing, RC publish
- `@flare-engine` npm scope reserved 2026-04-17; packages flip `"private": false` at RC cut
- Full roadmap: [docs/plans/build-plan.md](docs/plans/build-plan.md)

---

## Architecture

34 packages, strict downward-only dependencies — every arrow points down, none point up or sideways across unrelated branches.

```
┌───────────┬────────────────┬──────────────────────────────────────────────────────┐
│  Layer    │  Tier          │  Packages                                            │
├───────────┼────────────────┼──────────────────────────────────────────────────────┤
│  4        │  Integration   │  react  ·  engine                                    │
│  3.5      │  UI            │  ui  ·  postfx                                       │
│  3        │  Features      │  scene  ·  animation  ·  particles  ·  tilemap       │
│           │                │  debug  ·  pathfinding  ·  dialogue                  │
│  2.5      │  Persistence   │  storage  ·  errors  ·  testing  ·  a11y             │
│           │                │  localization  ·  deep-links  ·  share               │
│  2        │  Systems       │  render  ·  input  ·  physics  ·  audio  ·  assets   │
│  1        │  Runtime       │  core  ·  ecs                                        │
│  0        │  Foundation    │  math  ·  events                                     │
├───────────┼────────────────┼──────────────────────────────────────────────────────┤
│  ─        │  Tooling       │  cli  ·  devtools  ·  create-flare-app               │
│  ─        │  Tier-2 stubs  │  leaderboards  ·  achievements  ·  iap  ·  analytics │
└───────────┴────────────────┴──────────────────────────────────────────────────────┘
```

Each package is independently versioned, tree-shakeable, and builds to dual CJS+ESM with `.d.ts`. Full diagram and rationale in [docs/design/architecture.md](docs/design/architecture.md).

---

## Packages

| Package                      | Layer | Status                   | Description                                                                    |
| ---------------------------- | ----- | ------------------------ | ------------------------------------------------------------------------------ |
| `@flare-engine/math`         | 0     | shipping                 | Vec2, Rect, Transform, Mat3, Color, 42 easings, seeded RNG, intersections      |
| `@flare-engine/events`       | 0     | shipping                 | Type-safe `EventEmitter` and `Signal`                                          |
| `@flare-engine/core`         | 1     | shipping                 | `GameLoop`, `Clock`, `AppLifecycle`, `ScreenManager`, coroutines, pool         |
| `@flare-engine/ecs`          | 1     | shipping                 | Archetype ECS — `World`, `Query`, systems, prefabs, FSM                        |
| `@flare-engine/render`       | 2     | shipping                 | Skia Atlas `SpriteBatch`, `Camera2D`, sprite effects, BMFont text              |
| `@flare-engine/input`        | 2     | shipping                 | `InputManager`, pointer/touch, gestures, joystick/button state                 |
| `@flare-engine/physics`      | 2     | shipping                 | AABB `CollisionWorld`, spatial index, raycasting                               |
| `@flare-engine/audio`        | 2     | shipping                 | `AudioManager`, `SFXPool`, music crossfade, channels                           |
| `@flare-engine/assets`       | 2     | shipping                 | `AssetManager`, TexturePacker/Aseprite parser, procedural atlas                |
| `@flare-engine/storage`      | 2.5   | shipping                 | Typed KV persistence — MMKV / IndexedDB / memory adapters                      |
| `@flare-engine/errors`       | 2.5   | shipping                 | Error boundary + structured crash payload + pluggable transport                |
| `@flare-engine/testing`      | 2.5   | shipping                 | Deterministic fake clock, test world, mock input, scene snapshots              |
| `@flare-engine/localization` | 2.5   | shipping                 | String tables, ICU plurals, locale resolution                                  |
| `@flare-engine/deep-links`   | 2.5   | shipping                 | URL → scene router, history API, `Linking` integration                         |
| `@flare-engine/share`        | 2.5   | shipping                 | `captureScreenshot()` + Web Share API + `expo-sharing` fallback                |
| `@flare-engine/a11y`         | 2.5   | shipping (light)         | Reduced-motion + contrast tokens (screen-reader deferred to 0.3.0)             |
| `@flare-engine/scene`        | 3     | shipping                 | `SceneManager`, lifecycle, fade/slide transitions                              |
| `@flare-engine/animation`    | 3     | shipping                 | Sprite animator, tweens (42 easings), springs, timelines                       |
| `@flare-engine/particles`    | 3     | shipping                 | Pooled emitters, immediate-mode Skia rendering                                 |
| `@flare-engine/tilemap`      | 3     | shipping                 | Tiled `.tmj` + LDtk parsers, culled renderer, collider extraction              |
| `@flare-engine/debug`        | 3     | shipping                 | FPS widget, stats, time controls, overlay                                      |
| `@flare-engine/pathfinding`  | 3     | shipping                 | A\* grid + JPS, flow fields                                                    |
| `@flare-engine/dialogue`     | 3     | shipping                 | Branching dialogue graph, runtime evaluator                                    |
| `@flare-engine/ui`           | 3.5   | shipping                 | Skia-free UI kit: Panel / Button / Label / List / Modal / HUDBar + focus nav   |
| `@flare-engine/postfx`       | 3.5   | shipping                 | Skia RuntimeEffect stack: CRT, bloom, vignette, grayscale-flash                |
| `@flare-engine/react`        | 4     | shipping                 | `<GameView>`, hooks, `<VirtualJoystick>`, `<VirtualButton>`, `<LoadingScreen>` |
| `@flare-engine/engine`       | 4     | shipping                 | `createGame()` convenience + umbrella re-exports                               |
| `@flare-engine/cli`          | —     | shipping                 | `flare pack-atlas`, `flare tiled-to-flare`, `flare new`                        |
| `@flare-engine/devtools`     | —     | shipping (partial 0.1.0) | Entity inspector + time scrub + pause/step                                     |
| `create-flare-app`           | —     | shipping                 | `npm create flare-app@latest` — blank / topdown / shmup templates              |
| `@flare-engine/leaderboards` | —     | stub (0.1.0)             | Interface + no-op provider; concrete adapters in 0.2.0                         |
| `@flare-engine/achievements` | —     | stub (0.1.0)             | Interface + no-op provider; concrete adapters in 0.2.0                         |
| `@flare-engine/iap`          | —     | stub (0.1.0)             | Interface + no-op provider; concrete adapters in 0.2.0                         |
| `@flare-engine/analytics`    | —     | stub (0.1.0)             | Interface + no-op provider; concrete adapters in 0.2.0                         |

Full API contracts live in [docs/design/api-specs.md](docs/design/api-specs.md).

---

## Getting Started

```bash
bun install
bun run build
bun run test
```

The reference game runs via Expo:

```bash
cd apps/pan-tvardowski
bun run start
```

Once 0.1.0 publishes, a fresh project will scaffold via:

```bash
npm create flare-app@latest my-game
```

---

## Tech Stack

| Area               | Choice                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Runtime            | [Bun](https://bun.sh)                                                                              |
| Monorepo           | [Turborepo](https://turbo.build)                                                                   |
| Lint + Format      | [Biome](https://biomejs.dev)                                                                       |
| Build              | [tsup](https://tsup.egoist.dev) (dual CJS/ESM + `.d.ts`)                                           |
| Test               | Bun test                                                                                           |
| Commits            | Conventional Commits (commitlint + Husky)                                                          |
| Versioning         | [Changesets](https://github.com/changesets/changesets) (independent SemVer per package)            |
| Rendering (native) | [`@shopify/react-native-skia`](https://shopify.github.io/react-native-skia/)                       |
| Rendering (web)    | CanvasKit WASM                                                                                     |
| Audio              | [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api) / Web Audio |

Tooling rationale: see the Tooling section of [docs/design/architecture.md](docs/design/architecture.md).

---

## Documentation

- [AGENTS.md](AGENTS.md) — conventions, commands, architecture summary
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [docs/README.md](docs/README.md) — full documentation index
- [docs/design/](docs/design/) — architecture, API specs, dependencies, ecosystem
- [docs/plans/build-plan.md](docs/plans/build-plan.md) — roadmap
- [docs/references/](docs/references/) — benchmarks, CanvasKit parity, CLI tooling

---

## License

[MIT](./LICENSE)
