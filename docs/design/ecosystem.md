# RN Game Engine — Ecosystem Landscape

> Last updated: 2026-04-20

---

## Why This Engine, Why Now

| Fact                                                                                                       | Source            |
| ---------------------------------------------------------------------------------------------------------- | ----------------- |
| `react-native-game-engine` — dead 6+ years, JS-only, renders via RN Views (not GPU)                        | npm, GitHub       |
| `@shopify/react-native-skia` — **708K DL/week**, 8.3K stars, has `<Atlas>` API for batch sprite rendering  | npm, Apr 2026     |
| Zero published libraries for: sprite sheets, tilemaps, particle systems, game audio, ECS integration in RN | npm search        |
| One confirmed Skia game shipped: "Patterns" (Unity→RN Skia port) on both stores                            | App Store, GitHub |
| `react-native-wgpu` — active, but low-level (needs engine layer), requires RN 0.81+ New Arch               | npm, Apr 2026     |
| `react-native-audio-api` (Software Mansion) — **37K DL/week**, actively maintained Web Audio API for RN    | npm, Apr 2026     |

**Bottom line:** All infrastructure pieces exist. Flare assembles them into one cross-platform 2D engine — for animation, gamification, interactive UI, and games — running the same code on React Native and the web.

---

## RN Graphics & Gaming Libraries

| Library                      | npm DL/week | Stars | Status                                                    |
| ---------------------------- | ----------- | ----- | --------------------------------------------------------- |
| `@shopify/react-native-skia` | 708K        | 8.3K+ | Active (Shopify-backed) — v2.6.2, Skia m147               |
| `react-native-game-engine`   | 2.2K        | 3.1K  | Dead (6+ years)                                           |
| `react-native-wgpu`          | 2.8K        | 1.1K  | Active (wcandillon) — v0.5.11, requires RN 0.81+ New Arch |
| `react-native-audio-api`     | 37K         | —     | Active (Software Mansion) — v0.11.7, Web Audio API for RN |
| `lottie-react-native`        | 796K        | —     | Active (Airbnb) — animation, not games                    |

---

## Web TS Game Engines (Competitors on web, not on RN)

| Engine       | DL/week | TS-first? | Key trait                                                        | RN support |
| ------------ | ------- | --------- | ---------------------------------------------------------------- | ---------- |
| Phaser 4     | 134K    | Partial   | v4.0.0 Apr 2026 — SpriteGPULayer, GPU tilemap, 28 AI skill files | No         |
| Excalibur.js | 5.4K    | Yes       | Best TS-first 2D engine, v0.32.0, still pre-1.0                  | No         |
| KAPLAY       | 3.3K    | Partial   | Flat functional API, succeeded Kaboom.js, slowing momentum       | No         |
| PixiJS       | 521K    | v8+       | WebGL + WebGPU dual renderer, v8.18.1                            | No         |

None of these run on React Native. All are web-only.

---

## What's Missing in RN Gaming (Flare fills these)

| Gap                 | Before Flare                             | Flare module              |
| ------------------- | ---------------------------------------- | ------------------------- |
| Sprite sheets/atlas | Nothing for RN                           | `@flare-engine/assets`    |
| Tilemaps            | Nothing for RN                           | `@flare-engine/tilemap`   |
| Game loop           | DIY via requestAnimationFrame            | `@flare-engine/core`      |
| Physics             | planck.js works but no integration       | `@flare-engine/physics`   |
| Particles           | Nothing for RN                           | `@flare-engine/particles` |
| Audio sync          | Fragmented (expo-av, react-native-sound) | `@flare-engine/audio`     |
| ECS for RN          | bitECS/miniplex exist but no integration | `@flare-engine/ecs`       |
| Input for games     | gesture-handler not game-oriented        | `@flare-engine/input`     |
| Scene management    | Nothing                                  | `@flare-engine/scene`     |
| Camera system       | Nothing                                  | `@flare-engine/render`    |

---

## Shipped RN Games (Case Studies)

| Game                   | Tech                        | Platform      | Notes                                          |
| ---------------------- | --------------------------- | ------------- | ---------------------------------------------- |
| Patterns — Puzzle Game | Expo + RN Skia + Reanimated | iOS + Android | Ported from Unity. Skia maintainer approved.   |
| Cannon Ball Sea        | react-native-game-engine    | iOS           | Physics-based puzzle. Uses RNGE entity-system. |
| Studious Bear          | react-native-game-engine    | iOS           | Polished puzzle game.                          |

---

## Competitive Moat

| Feature                 | Flare             | Phaser 4     | Excalibur    | KAPLAY       | RNGE     |
| ----------------------- | ----------------- | ------------ | ------------ | ------------ | -------- |
| React Native            | **Yes**           | No           | No           | No           | Dead     |
| TypeScript-first        | **Yes**           | Partial      | Yes          | Partial      | No       |
| GPU rendering (Skia)    | **Yes**           | Canvas/WebGL | Canvas/WebGL | Canvas/WebGL | RN Views |
| C++ hot loops (Nitro)   | Phase 7           | No           | No           | No           | No       |
| Zero-copy shared memory | Phase 7           | N/A          | N/A          | N/A          | N/A      |
| Mobile-native input     | **Yes**           | No           | No           | No           | Partial  |
| App lifecycle handling  | **Yes**           | No           | No           | No           | No       |
| iOS + Android           | **Yes**           | Web only     | Web only     | Web only     | Dead     |
| AI agent harness        | `.claude/` (skills + agents + hooks) | No | No        | No           | No       |

---

## Skia Rendering Capabilities

### Two Rendering Modes

| Mode                | Best for                         | Mechanism                                                     |
| ------------------- | -------------------------------- | ------------------------------------------------------------- |
| Retained (Atlas)    | Known sprites, fixed counts      | `<Atlas>` + `useRSXformBuffer` worklet — single GPU draw call |
| Immediate (Picture) | Particles, debug, dynamic counts | `PictureRecorder` — issue draw commands per frame             |

### Atlas API (Primary game rendering path)

- Renders N sprites in **single GPU draw call** regardless of count
- `useRSXformBuffer` — transforms computed on UI thread as worklet (no JS thread). **Flare does not
  use this API.** This section documents what Skia offers, not what the engine adopted; Flare computes
  transforms on the JS thread and batches through `drawAtlas`. See [architecture.md](architecture.md)
  § Rendering Pipeline. (Noted 2026-09-08.)
- Official example: 150 sprites with gesture-driven animation
- Realistic estimate: **500-2000 sprites at 60fps** on modern phones

### Skia Graphite (Watch — pre-release as of Apr 2026)

- v2.6.3-next.1 contains the **first Skia Graphite pre-release**
- Graphite is Skia's next-gen GPU backend (replaces Ganesh) — designed for Metal, Vulkan, Dawn
- Expected to improve Atlas rendering throughput once stable
- Flare's `SpriteBatch` should benefit transparently when the upgrade ships

### Threading Model

| Thread         | Runs                                        | Budget                      |
| -------------- | ------------------------------------------- | --------------------------- |
| JS (Hermes)    | Game logic, React, state                    | Not on critical render path |
| UI             | Reanimated worklets, Skia animation buffers | 16ms (critical path)        |
| Skia Rendering | Draw operations, GPU submission             | Managed by Skia             |

### Hermes GC

- Generational incremental GC — young gen pauses < 1ms
- JS thread GC pauses don't block UI thread rendering (if using Reanimated)
- Mitigation: typed arrays, object pooling, minimize allocations in hot loops
