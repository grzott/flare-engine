# Flare Engine

> Modular 2D engine for React Native + Web — animation, gamification, interactive UI, and games — built on Skia

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](./tsconfig.base.json)

**Flare** is a modular 2D engine that runs the same TypeScript on iOS, Android, and the browser — for high-performance animation, gamification, interactive UI, and games. Zero-alloc hot paths, hybrid ECS, GPU sprite batching, and a device-verified end-to-end loop, all under the `@flare-engine/*` npm scope. It lives inside your React Native and web apps — not a Unity/Godot/Unreal competitor.

---

## Status

**0.2.0 lockstep cut (restricted) — public OSS launch coming October 2026.**

- 40 scoped packages live on npm as private/restricted `@flare-engine/*@0.2.0`; they flip public at the OSS launch
- [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) — the canonical showcase game (Polish-folklore vertical shmup, 8 zones, PL+EN). Lives in its own repo since 2026-06-10 and consumes the engine from npm — the proof the engine works as a real dependency, not just a workspace
- Pre-launch polish remains: landing-page MP4 + store-page links, docs site, API snapshot lock, governance files, EUIPO trademark filing
- Full roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md)

---

## Architecture

41 package dirs (40 scoped `@flare-engine/*` + `create-flare-app`), strict downward-only dependencies — every arrow points down, none point up or sideways across unrelated branches.

```
┌───────────┬────────────────┬──────────────────────────────────────────────────────┐
│  Layer    │  Tier          │  Packages                                            │
├───────────┼────────────────┼──────────────────────────────────────────────────────┤
│  4        │  Integration   │  react  ·  render-web  ·  engine                     │
│  3.5      │  UI            │  ui  ·  postfx  ·  ui-shop                           │
│  3        │  Features      │  scene  ·  animation  ·  particles  ·  tilemap       │
│           │                │  debug  ·  pathfinding  ·  dialogue                  │
│  2.5      │  Persistence   │  storage  ·  errors  ·  testing  ·  a11y             │
│           │                │  localization  ·  deep-links  ·  share               │
│  2        │  Systems       │  render  ·  input  ·  physics  ·  audio  ·  assets   │
│           │                │  shapes  ·  simulation  ·  progression               │
│  1        │  Runtime       │  core  ·  ecs                                        │
│  0        │  Foundation    │  math  ·  events                                     │
├───────────┼────────────────┼──────────────────────────────────────────────────────┤
│  ─        │  Interfaces    │  haptics                                             │
│  ─        │  Tooling       │  cli  ·  devtools  ·  create-flare-app               │
│  ─        │  Tier-2 stubs  │  leaderboards  ·  achievements  ·  iap  ·  analytics │
│  ─        │  Adapters      │  iap-revenuecat                                      │
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
| `@flare-engine/ecs`          | 1     | shipping                 | Hybrid ECS — `World`, `Query`, systems, prefabs, FSM                        |
| `@flare-engine/render`       | 2     | shipping                 | Skia Atlas `SpriteBatch`, `Camera2D`, sprite effects, BMFont text              |
| `@flare-engine/input`        | 2     | shipping                 | `InputManager`, pointer/touch, gestures, joystick/button state                 |
| `@flare-engine/physics`      | 2     | shipping                 | AABB `CollisionWorld`, spatial index, raycasting                               |
| `@flare-engine/audio`        | 2     | shipping                 | `AudioManager`, `SFXPool`, music crossfade, channels                           |
| `@flare-engine/assets`       | 2     | shipping                 | `AssetManager`, TexturePacker/Aseprite parser, procedural atlas                |
| `@flare-engine/shapes`       | 2     | shipping                 | Procedural 2D shape primitives + SVG path escape hatch — prototype without art |
| `@flare-engine/simulation`   | 2     | shipping                 | N-body gravity, Verlet/leapfrog integrators, wave-packet ripple pool           |
| `@flare-engine/progression`  | 2     | shipping                 | Upgrade tracks, pity-aware drop tables, unlock DAG, tier + collectible registry |
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
| `@flare-engine/render-web`   | 4     | shipping                 | Web analog of `react` — composes `render` + `postfx` via CanvasKit-WASM        |
| `@flare-engine/engine`       | 4     | shipping                 | `createGame()` convenience + umbrella re-exports                               |
| `@flare-engine/cli`          | —     | shipping                 | `flare pack-atlas`, `flare tiled-to-flare`, `flare new`                        |
| `@flare-engine/devtools`     | —     | shipping                 | Entity inspector + time scrub + pause/step (broader profiling post-0.1.0)      |
| `create-flare-app`           | —     | shipping                 | `npm create flare-app@latest` — blank / topdown / shmup templates              |
| `@flare-engine/leaderboards` | —     | stub                     | Interface + no-op provider; concrete adapters deferred past 0.2.0             |
| `@flare-engine/achievements` | —     | stub                     | Interface + no-op provider; concrete adapters deferred past 0.2.0             |
| `@flare-engine/iap`          | —     | shipping                 | Interface + no-op provider + `ProductCatalog` + `EntitlementStore` + content gates |
| `@flare-engine/analytics`    | —     | stub                     | Interface + no-op provider; concrete adapters deferred past 0.2.0             |
| `@flare-engine/iap-revenuecat` | —   | shipping                 | Concrete RevenueCat `IAPProvider` adapter (lazy `react-native-purchases`)      |
| `@flare-engine/ui-shop`      | 3.5   | shipping                 | `ShopScreen` + `PaywallModal` + `RestorePurchasesButton` consuming `IAPContext` |
| `@flare-engine/haptics`      | —     | shipping                 | `HapticsProvider` interface + `NoopHapticsProvider` + React context            |

Full API contracts live in [docs/design/api-specs.md](docs/design/api-specs.md).

---

## Getting Started

```bash
bun install
bun run build
bun run test
```

The showcase game lives in its own repo and consumes the published packages:

```bash
git clone https://github.com/grzott/Pan-Tvardowski
cd Pan-Tvardowski && bun install && bun run start
```

A fresh project scaffolds via (requires registry access until the public launch):

```bash
npm create flare-app@latest my-game
```

---

## Consuming from npm (restricted)

`@flare-engine/*` packages are published to the public npm registry with **restricted**
access until the October 2026 OSS launch. Consuming them needs a read-only granular npm
token for the `@flare-engine` scope (owner-generated; never committed). Point the scope
at the registry and reference the token via env var:

```ini
# .npmrc (committed) — token comes from the NPM_TOKEN env var or ~/.npmrc
@flare-engine:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Version policy for consumers:

- Depend with `^0.2.0`. Patch releases (0.2.x) are non-breaking and flow in-range.
- Future minor releases (0.3.0) may break; they require an explicit range bump on the
  consumer side — see the compat-guard caret-ceiling rule in [CONTRIBUTING.md](CONTRIBUTING.md).
- `leaderboards` / `achievements` / `analytics` remain interface-only stubs at 0.2.0
  (see the Status column above); concrete adapters are deferred past 0.2.0.

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
- [docs/plans/roadmap.md](docs/plans/roadmap.md) — roadmap
- [docs/references/](docs/references/) — benchmarks, CanvasKit parity, CLI tooling

---

## License

[MIT](./LICENSE)
