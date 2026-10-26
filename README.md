# Flare Engine

> Modular 2D engine for React Native + Web — animation, gamification, interactive UI, and games — built on Skia

[![CI](https://github.com/grzott/flare-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/grzott/flare-engine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@flare-engine/engine)](https://www.npmjs.com/package/@flare-engine/engine)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](./tsconfig.base.json)

**Flare** is a modular 2D engine that runs the same TypeScript on iOS, Android, and the browser — for high-performance animation, gamification, interactive UI, and games. Zero-alloc hot paths, an archetype-bitmask ECS, GPU sprite batching, and a device-verified end-to-end loop, all under the `@flare-engine/*` npm scope. It lives inside your React Native and web apps — not a Unity/Godot/Unreal competitor.

---

## Status

**Open source since October 2026.** Every `@flare-engine/*` package is public on npm, and releases from `0.4.5` on are published from CI with npm provenance.

- 42 scoped `@flare-engine/*` packages, scaffolder included, versioned in **lockstep** — one shared version across the whole scope, cut together with Changesets
- Real consumers, not just a workspace: the three games and five animations on [flareengine.dev](https://flareengine.dev) run on the published packages in the browser, and Pan Tvardowski — a private, unreleased game in alpha — consumes the engine from npm on a real Android device
- Not affiliated with [FLARE (flarerpg.org)](https://flarerpg.org), a separate action-RPG game engine — this project is the `@flare-engine/*` TypeScript packages for React Native + Web
- Full roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md)

---

## How this is built

Flare is built with an **AI-directed agent workflow**: the implementation is written by coding
agents, and the architecture, decisions, gates and review are the author's. Scoped builder agents
work from a written queue and cannot commit — that is enforced in the harness, not by convention —
and a gate is only accepted once it has been proven able to fail.

This is stated because it changes how to read the repository: the commit history is dense, and the
docs are unusually explicit about their own past errors. Both are artifacts of the method. It is not
code generated from a prompt and shipped unread; the engineering is in the decisions, the contracts
and the verification. See [CONTRIBUTING.md](CONTRIBUTING.md#how-this-is-built) for what that means
for a contributor.

---

## Architecture

42 scoped `@flare-engine/*` packages, strict downward-only dependencies — a package may depend only on an equal-or-lower tier, never a higher one (see AGENTS.md).

Every package shares one lockstep version, is tree-shakeable, and builds to dual CJS+ESM with `.d.ts`. Full layer diagram, and the enforced tier for every package: [docs/design/architecture.md](docs/design/architecture.md#layer-diagram) — the single source of truth for the tier map (this file no longer restates it; see `scripts/check-deps-tiers.mjs` for the enforced version).

---

## Packages

| Package                      | Status                   | Description                                                                    |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `@flare-engine/math`         | shipping                 | Vec2, Rect, Transform, Mat3, Color, Penner easings, seeded RNG, intersections      |
| `@flare-engine/events`       | shipping                 | Type-safe `EventEmitter` and `Signal`                                          |
| `@flare-engine/core`         | shipping                 | `GameLoop`, `Clock`, `AppLifecycle`, `ScreenManager`, coroutines, pool         |
| `@flare-engine/ecs`          | shipping                 | Archetype-bitmask ECS — `World`, `Query`, systems, prefabs, FSM (32-type cap) |
| `@flare-engine/render`       | shipping                 | Skia Atlas `SpriteBatch`, `Camera2D`, sprite effects, BMFont text              |
| `@flare-engine/input`        | shipping                 | `InputManager`, pointer/touch, gestures, joystick/button state                 |
| `@flare-engine/physics`      | shipping                 | AABB `CollisionWorld`, spatial index, raycasting                               |
| `@flare-engine/audio`        | shipping                 | `AudioManager`, `SFXPool`, music crossfade, channels                           |
| `@flare-engine/assets`       | shipping                 | `AssetManager`, TexturePacker/Aseprite parser, procedural atlas                |
| `@flare-engine/shapes`       | shipping                 | Procedural 2D shape primitives + SVG path escape hatch — prototype without art |
| `@flare-engine/simulation`   | shipping                 | N-body gravity, Verlet/leapfrog integrators, wave-packet ripple pool           |
| `@flare-engine/progression`  | shipping                 | Upgrade tracks, pity-aware drop tables, unlock DAG, tier + collectible registry |
| `@flare-engine/dynamics`     | shipping                 | 2D rigid bodies — OBB contact manifolds, sequential-impulse solver, friction   |
| `@flare-engine/storage`      | shipping                 | Typed KV persistence — MMKV / IndexedDB / memory adapters                      |
| `@flare-engine/errors`       | shipping                 | Error boundary + structured crash payload + pluggable transport                |
| `@flare-engine/testing`      | shipping                 | Deterministic fake clock, test world, mock input, scene snapshots              |
| `@flare-engine/localization` | shipping                 | String tables, ICU plurals, locale resolution                                  |
| `@flare-engine/deep-links`   | shipping                 | URL → scene router, history API, `Linking` integration                         |
| `@flare-engine/share`        | shipping                 | `captureScreenshot()` + Web Share API + `expo-sharing` fallback                |
| `@flare-engine/a11y`         | shipping (light)         | Reduced-motion + contrast tokens (screen-reader deferred)             |
| `@flare-engine/scene`        | shipping                 | `SceneManager`, lifecycle, fade/slide transitions                              |
| `@flare-engine/animation`    | shipping                 | Sprite animator, tweens (Penner easings), springs, timelines                       |
| `@flare-engine/particles`    | shipping                 | Pooled emitters, immediate-mode Skia rendering                                 |
| `@flare-engine/tilemap`      | shipping                 | Tiled `.tmj` + LDtk parsers, culled renderer, collider extraction              |
| `@flare-engine/debug`        | shipping                 | FPS widget, stats, time controls, overlay                                      |
| `@flare-engine/pathfinding`  | beta — no production consumer | A\* grid + JPS + convex-polygon navmesh (no flow fields). A\* and JPS differ on corner cutting; JPS delegates to A\* on weighted grids — see the package README |
| `@flare-engine/dialogue`     | shipping                 | Branching dialogue graph, runtime evaluator                                    |
| `@flare-engine/ui`           | shipping                 | Skia-free UI kit: Panel / Button / Label / List / Modal / HUDBar + focus nav   |
| `@flare-engine/postfx`       | shipping                 | Skia RuntimeEffect stack: CRT, bloom, vignette, grayscale-flash                |
| `@flare-engine/react`        | shipping                 | `<GameView>`, hooks, `<VirtualJoystick>`, `<VirtualButton>`, `<LoadingScreen>` |
| `@flare-engine/render-web`   | shipping                 | Web analog of `react` — composes `render` + `postfx` via CanvasKit-WASM        |
| `@flare-engine/engine`       | shipping                 | `createGame()` convenience + umbrella re-exports                               |
| `@flare-engine/cli`          | shipping                 | `flare pack-atlas`, `flare tiled-to-flare`, `flare new`                        |
| `@flare-engine/devtools`     | shipping                 | Entity inspector + time scrub + pause/step (broader profiling post-launch)     |
| `@flare-engine/create`       | shipping                 | `npm create @flare-engine` — blank / topdown / shmup templates                 |
| `@flare-engine/leaderboards` | shipping                 | Interface + no-op + in-memory provider (`createMemoryLeaderboards`); platform adapters post-launch |
| `@flare-engine/achievements` | shipping                 | Interface + no-op + in-memory / storage-backed providers; platform adapters post-launch |
| `@flare-engine/iap`          | shipping                 | Interface + no-op provider + `ProductCatalog` + `EntitlementStore` + content gates |
| `@flare-engine/analytics`    | shipping                 | Interface + no-op + in-memory + console providers; vendor adapters post-launch |
| `@flare-engine/iap-revenuecat` | shipping                 | Concrete RevenueCat `IAPProvider` adapter (lazy `react-native-purchases`)      |
| `@flare-engine/ui-shop`      | shipping                 | `ShopScreen` + `PaywallModal` + `RestorePurchasesButton` consuming `IAPContext` |
| `@flare-engine/haptics`      | shipping                 | `HapticsProvider` interface + Noop / Expo / Web-Vibration providers + context  |

Full API contracts live in [docs/design/api-specs.md](docs/design/api-specs.md).

**One constraint to know before adopting `@flare-engine/ecs`:** it supports a maximum of **32 component types**, and the component-id bitmask is **module-global — shared across every `World` in the process**, not per-`World`. Two worlds in one process draw on the same 32-slot budget. Seven slots are spent by the built-ins (`Position`, `Velocity`, `Rotation`, `Scale`, `Parent`, `Lifetime`, `Follower`), leaving 25. Defining a 33rd throws at definition time and names the offending component — it never corrupts silently. For scale, Pan Tvardowski, the largest consumer, uses 16, so it sits at 23 of 32.

---

## Getting Started

```bash
bun install
bun run build
bun run test
```

A fresh project scaffolds via:

```bash
npm create @flare-engine my-game
# bun: bunx @flare-engine/create my-game
```

Pick `blank`, `topdown` or `shmup` with `-- --template <name>`. `npm create flare-app` is a
different, unrelated package — the scaffolder is `@flare-engine/create`. From a clone of this
repo, `bun packages/create/src/bin.ts my-game` runs the same scaffolder from source.

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
| Versioning         | [Changesets](https://github.com/changesets/changesets) (lockstep — one shared version across every `@flare-engine/*` package) |
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
