# Flare Engine

> Modular 2D engine for React Native + Web — animation, gamification, interactive UI, and games — built on Skia

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](./tsconfig.base.json)

**Flare** is a modular 2D engine that runs the same TypeScript on iOS, Android, and the browser — for high-performance animation, gamification, interactive UI, and games. Zero-alloc hot paths, an archetype-bitmask ECS, GPU sprite batching, and a device-verified end-to-end loop, all under the `@flare-engine/*` npm scope. It lives inside your React Native and web apps — not a Unity/Godot/Unreal competitor.

---

## Status

**Public OSS launch: October 2026.** The `@flare-engine/*` scope cuts a `0.4.0` lockstep release and flips from restricted to public npm access during the launch window.

- 41 scoped `@flare-engine/*` packages + `create-flare-app`, versioned in **lockstep** — one shared version across the whole scope, cut together with Changesets
- [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) — the canonical showcase game (Polish-folklore vertical shmup, 8 zones, PL+EN). Lives in its own repo since 2026-06-10 and consumes the engine from npm — proof it works as a real dependency, not just a workspace
- Not affiliated with [FLARE (flarerpg.org)](https://flarerpg.org), a separate action-RPG game engine — this project is the `@flare-engine/*` TypeScript packages for React Native + Web
- Full roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md)

---

## Architecture

42 package dirs (41 scoped `@flare-engine/*` + `create-flare-app`), strict downward-only dependencies — every arrow points down, none point up or sideways across unrelated branches.

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
│  2        │  Systems       │  render  ·  input  ·  physics  ·  dynamics  ·  audio │
│           │                │  assets  ·  shapes  ·  simulation  ·  progression    │
│  1        │  Runtime       │  core  ·  ecs                                        │
│  0        │  Foundation    │  math  ·  events                                     │
├───────────┼────────────────┼──────────────────────────────────────────────────────┤
│  ─        │  Haptics       │  haptics                                             │
│  ─        │  Tooling       │  cli  ·  devtools  ·  create-flare-app               │
│  ─        │  Tier-2        │  leaderboards  ·  achievements  ·  iap  ·  analytics │
│  ─        │  Adapters      │  iap-revenuecat                                      │
└───────────┴────────────────┴──────────────────────────────────────────────────────┘
```

Every package shares one lockstep version, is tree-shakeable, and builds to dual CJS+ESM with `.d.ts`. Full diagram and rationale in [docs/design/architecture.md](docs/design/architecture.md).

---

## Packages

| Package                      | Layer | Status                   | Description                                                                    |
| ---------------------------- | ----- | ------------------------ | ------------------------------------------------------------------------------ |
| `@flare-engine/math`         | 0     | shipping                 | Vec2, Rect, Transform, Mat3, Color, 42 easings, seeded RNG, intersections      |
| `@flare-engine/events`       | 0     | shipping                 | Type-safe `EventEmitter` and `Signal`                                          |
| `@flare-engine/core`         | 1     | shipping                 | `GameLoop`, `Clock`, `AppLifecycle`, `ScreenManager`, coroutines, pool         |
| `@flare-engine/ecs`          | 1     | shipping                 | Archetype-bitmask ECS — `World`, `Query`, systems, prefabs, FSM (32-type cap) |
| `@flare-engine/render`       | 2     | shipping                 | Skia Atlas `SpriteBatch`, `Camera2D`, sprite effects, BMFont text              |
| `@flare-engine/input`        | 2     | shipping                 | `InputManager`, pointer/touch, gestures, joystick/button state                 |
| `@flare-engine/physics`      | 2     | shipping                 | AABB `CollisionWorld`, spatial index, raycasting                               |
| `@flare-engine/audio`        | 2     | shipping                 | `AudioManager`, `SFXPool`, music crossfade, channels                           |
| `@flare-engine/assets`       | 2     | shipping                 | `AssetManager`, TexturePacker/Aseprite parser, procedural atlas                |
| `@flare-engine/shapes`       | 2     | shipping                 | Procedural 2D shape primitives + SVG path escape hatch — prototype without art |
| `@flare-engine/simulation`   | 2     | shipping                 | N-body gravity, Verlet/leapfrog integrators, wave-packet ripple pool           |
| `@flare-engine/progression`  | 2     | shipping                 | Upgrade tracks, pity-aware drop tables, unlock DAG, tier + collectible registry |
| `@flare-engine/dynamics`     | 2     | shipping                 | 2D rigid bodies — OBB contact manifolds, sequential-impulse solver, friction   |
| `@flare-engine/storage`      | 2.5   | shipping                 | Typed KV persistence — MMKV / IndexedDB / memory adapters                      |
| `@flare-engine/errors`       | 2.5   | shipping                 | Error boundary + structured crash payload + pluggable transport                |
| `@flare-engine/testing`      | 2.5   | shipping                 | Deterministic fake clock, test world, mock input, scene snapshots              |
| `@flare-engine/localization` | 2.5   | shipping                 | String tables, ICU plurals, locale resolution                                  |
| `@flare-engine/deep-links`   | 2.5   | shipping                 | URL → scene router, history API, `Linking` integration                         |
| `@flare-engine/share`        | 2.5   | shipping                 | `captureScreenshot()` + Web Share API + `expo-sharing` fallback                |
| `@flare-engine/a11y`         | 2.5   | shipping (light)         | Reduced-motion + contrast tokens (screen-reader deferred)             |
| `@flare-engine/scene`        | 3     | shipping                 | `SceneManager`, lifecycle, fade/slide transitions                              |
| `@flare-engine/animation`    | 3     | shipping                 | Sprite animator, tweens (42 easings), springs, timelines                       |
| `@flare-engine/particles`    | 3     | shipping                 | Pooled emitters, immediate-mode Skia rendering                                 |
| `@flare-engine/tilemap`      | 3     | shipping                 | Tiled `.tmj` + LDtk parsers, culled renderer, collider extraction              |
| `@flare-engine/debug`        | 3     | shipping                 | FPS widget, stats, time controls, overlay                                      |
| `@flare-engine/pathfinding`  | 3     | beta — no production consumer | A\* grid + JPS, flow fields. A\* and JPS differ on corner cutting — see the package README |
| `@flare-engine/dialogue`     | 3     | shipping                 | Branching dialogue graph, runtime evaluator                                    |
| `@flare-engine/ui`           | 3.5   | shipping                 | Skia-free UI kit: Panel / Button / Label / List / Modal / HUDBar + focus nav   |
| `@flare-engine/postfx`       | 3.5   | shipping                 | Skia RuntimeEffect stack: CRT, bloom, vignette, grayscale-flash                |
| `@flare-engine/react`        | 4     | shipping                 | `<GameView>`, hooks, `<VirtualJoystick>`, `<VirtualButton>`, `<LoadingScreen>` |
| `@flare-engine/render-web`   | 4     | shipping                 | Web analog of `react` — composes `render` + `postfx` via CanvasKit-WASM        |
| `@flare-engine/engine`       | 4     | shipping                 | `createGame()` convenience + umbrella re-exports                               |
| `@flare-engine/cli`          | —     | shipping                 | `flare pack-atlas`, `flare tiled-to-flare`, `flare new`                        |
| `@flare-engine/devtools`     | —     | shipping                 | Entity inspector + time scrub + pause/step (broader profiling post-0.1.0)      |
| `create-flare-app`           | —     | pre-launch (unpublished) | `npm create flare-app@latest` — blank / topdown / shmup templates; publishes at the October 2026 flip |
| `@flare-engine/leaderboards` | —     | shipping                 | Interface + no-op + in-memory provider (`createMemoryLeaderboards`); platform adapters post-launch |
| `@flare-engine/achievements` | —     | shipping                 | Interface + no-op + in-memory / storage-backed providers; platform adapters post-launch |
| `@flare-engine/iap`          | —     | shipping                 | Interface + no-op provider + `ProductCatalog` + `EntitlementStore` + content gates |
| `@flare-engine/analytics`    | —     | shipping                 | Interface + no-op + in-memory + console providers; vendor adapters post-launch |
| `@flare-engine/iap-revenuecat` | —   | shipping                 | Concrete RevenueCat `IAPProvider` adapter (lazy `react-native-purchases`)      |
| `@flare-engine/ui-shop`      | 3.5   | shipping                 | `ShopScreen` + `PaywallModal` + `RestorePurchasesButton` consuming `IAPContext` |
| `@flare-engine/haptics`      | —     | shipping                 | `HapticsProvider` interface + Noop / Expo / Web-Vibration providers + context  |

Full API contracts live in [docs/design/api-specs.md](docs/design/api-specs.md).

**One constraint to know before adopting `@flare-engine/ecs`:** it supports a maximum of **32 component types**, and the component-id bitmask is **module-global — shared across every `World` in the process**, not per-`World`. Two worlds in one process draw on the same 32-slot budget. Seven slots are spent by the built-ins (`Position`, `Velocity`, `Rotation`, `Scale`, `Parent`, `Lifetime`, `Follower`), leaving 25. Defining a 33rd throws at definition time and names the offending component — it never corrupts silently. For scale, the canonical showcase game uses 16, so it sits at 23 of 32.

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

From the October 2026 public launch, a fresh project scaffolds via:

```bash
npm create flare-app@latest my-game
```

The scaffolder is not on npm yet — it is `private` until the flip, so that command does not resolve
today. Until then, clone the repo and run `bun packages/create-flare-app/src/bin.ts my-game`.

---

## Tech Stack

| Area               | Choice                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Runtime            | [Bun](https://bun.sh)                                                                              |
| Monorepo           | [Turborepo](https://turbo.build)                                                                   |
| Lint + Format      | [Biome](https://biomejs.dev)                                                                       |
| Build              | [tsdown](https://tsdown.dev) (dual CJS/ESM + `.d.ts`)                                              |
| Test               | Bun test                                                                                           |
| Commits            | Conventional Commits (commitlint + Husky)                                                          |
| Versioning         | [Changesets](https://github.com/changesets/changesets) (lockstep — one shared version across `@flare-engine/*` + `create-flare-app`) |
| Rendering (native) | [`@shopify/react-native-skia`](https://shopify.github.io/react-native-skia/)                       |
| Rendering (web)    | CanvasKit WASM                                                                                     |
| Audio              | [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api) / Web Audio |

Tooling rationale: see the Tooling section of [docs/design/architecture.md](docs/design/architecture.md).

---

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — what changed, per lockstep release
- [AGENTS.md](AGENTS.md) — conventions, commands, architecture summary
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [docs/README.md](docs/README.md) — full documentation index
- [docs/design/](docs/design/) — architecture, API specs, dependencies, ecosystem
- [docs/plans/roadmap.md](docs/plans/roadmap.md) — roadmap
- [docs/references/](docs/references/) — benchmarks, CanvasKit parity, CLI tooling

---

## Support

Flare is built and maintained by one person. Support is **best-effort, and there is no SLA**:

- **Issues** are triaged on a roughly weekly cadence. Reports with a minimal reproduction get looked at first.
- **Pull requests** are welcome, and review may be slow. For anything larger than a bug fix, open an issue first so the design can be agreed before you write the code.
- **Security** reports follow [SECURITY.md](SECURITY.md) — please don't open a public issue for a vulnerability.

This is stated up front so expectations are set: quiet stretches are normal for a project this size and are not a sign it has been abandoned.

---

## License

[Apache-2.0](./LICENSE)

Published versions `0.1.0`–`0.2.1` were released under MIT and remain MIT on npm; `0.3.0` and later are Apache-2.0.
