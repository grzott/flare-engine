# Benchmark coverage for a 2D Web + React Native engine

## Why this exists

The engine's benchmarks are honest and well-guarded: five-run folds with spread, a foreign-load guard,
a power-plan guard, a thermal guard, release-aligned recaptures, exact allocation counters gated in CI.
What they are not is **complete for the people who would evaluate the engine**:

- **Developers** ask "will it hold my frame rate on the devices I ship to?"
- **Marketing** needs a few figures a non-engineer can repeat without misquoting.
- **Maintainers of the libraries Flare builds on** (React Native Skia, Reanimated, CanvasKit) ask
  "what does Flare cost on top of my library, and does it use it well?"
- **Web developers** ask "what does it cost to download and start?"

This document lists what a professional 2D engine on Web and React Native should measure, marks what
Flare measures today, and turns each gap into an issue. It deliberately excludes comparisons with
other engines: the only baselines are Flare's own dependencies, which is both fair and the comparison
those maintainers can cite.

## Principles every new lane inherits

1. **Spread on every number** (median plus run-to-run band); never a single run.
2. **Provenance on every lane:** capture date, commit, runtime and version, machine or device, browser
   and GPU renderer string, refresh rate where frames are counted, thermal state on phones.
3. **Release-aligned:** captured inside the release tag, as 0.4.12 was; a lane measured before a source
   change says so.
4. **Quiet capture:** the existing foreign-load, power-plan and thermal guards apply; publishable
   captures are the owner's.
5. **"Does not measure" stated per lane,** as `benchmarks.md` already does.
6. **Fair baselines only:** a raw-library baseline must be a competent implementation (reused typed
   arrays, one draw per atlas run) and must produce the same pixels as the Flare path.
7. **Public data:** every lane reaches the public export (#437) with stable row ids.

## Capture hardware

Until Q1 2027 the capture hardware is **one Windows desktop (i9-13900KF, RTX 4070 Ti) and one Pixel 7**,
deliberately. Every issue below except #452 and the owner decisions runs on those two. The owner
plans to buy a Mac and an iPhone in Q1 2027; the Apple lanes (#452), the Apple Developer Program
decision (#453) and the device-tier question (#454) wait for that.

A device cloud was considered and declined for now. TestingBot's cheapest plan is
manual-only (automation starts at the next tier), its macOS sessions run on virtual machines (no
trustworthy GPU numbers), and cloud phones cannot run the thermal guard. Owned hardware keeps every
guard working. Publish the limits plainly in the meantime: one fast desktop flatters desktop figures,
the Pixel 7 is the only phone, and no Apple device is measured.

## Current coverage at `@flare-engine/core@0.4.12`

Platforms: **DW** desktop web, **AW** Android web, **IW** iOS web, **AN** Android native (React Native +
Skia), **IN** iOS native.

| Category | DW | AW | IW | AN | IN |
|---|---|---|---|---|---|
| Engine CPU cost (per system) | JSC only, desktop (Bun) | none | none | none | none |
| Render submission cost | CPU-raster + GPU (Chromium, RTX 4070 Ti) | Pixel 7 Chrome | none | none (#162) | none |
| Frame capacity / frame-time distribution | none | none | none | stale 2026-04-22 game capture | none |
| Startup and size | CanvasKit raw+gzip; cold start headless | none | none | none | none |
| Memory and GC | JSC heap proxy; exact alloc counters | none | none | none | none |
| Idle and background cost | none | none | none | none | none |
| Energy | n/a | none | none | none | none |

## The catalog

| # | Benchmark | Question it answers | Readers | Platforms | Today | Issue |
|---|---|---|---|---|---|---|
| 1 | Per-system CPU cost (ECS, physics, particles, animation, tilemap, pathfinding, math, render flush/sort, integration frame) | What does each system cost per frame? | devs, maintainers | all JS engines | **JSC only** | #440 (V8, Hermes) |
| 2 | Render submission cost, 18 scenarios | What does the CPU spend building and handing off a frame? | devs, CanvasKit, RN Skia | DW AW IW AN IN | DW (2 lanes), AW | #446 (Firefox, WebKit on Windows), #452 (Safari on Mac and iPhone, Q1 2027), #162 (native) |
| 3 | Frame capacity at the display refresh rate | How many sprites before frames drop on device X? | **marketing**, devs | DW AW IW AN | none | #438 |
| 4 | Frame-time distribution under a reference load (p50/p95/p99, % over budget, longest frame) | Is it smooth, not just fast on average? | devs, Reanimated | DW AW AN | none | #438, #442 |
| 5 | Sustained run, 10 minutes, with thermal state | Does it hold up once the phone is warm? | devs | AW AN | none | #447 |
| 6 | Overhead vs raw CanvasKit | What does Flare add over drawing with CanvasKit directly? | **CanvasKit**, web devs | DW AW | none | #439 |
| 7 | Overhead vs raw React Native Skia | What does Flare add over `drawAtlas` in RN Skia directly? | **RN Skia** | AN IN | none | #441 |
| 8 | JS-thread / UI-thread behaviour: handoff cost per frame, frames under injected JS stalls | What happens to frames when the JS thread is busy? | **Reanimated**, RN devs | AN IN | none | #442 |
| 9 | Download size: CanvasKit (raw, gzip, brotli), minimal production app, per package | What does it cost to ship? | web devs, marketing | DW | CanvasKit raw+gzip only | #443 |
| 10 | Cold start to first frame (plain, throttled; cold, warm), served compressed | How long until something is on screen? | web devs | DW AW IW | DW headless only, single captures; the throttled pair is mostly an uncompressed 8.24 MB download (`apps/bench-web/scripts/server.ts:34`) | #443 |
| 11 | Native app size delta | What does adding Flare add to an APK/IPA? | RN devs | AN IN | none | #443 |
| 12 | Allocation counters (exact) | Is the hot path really allocation-free? | maintainers | engine | **current, CI-gated** | - |
| 13 | GC pauses during a 60 s scene; WASM heap; device memory | Will garbage collection hitch my frames? | devs, Reanimated | DW AW AN | JSC heap proxy only | #444 |
| 14 | Idle and background cost (static scene, hidden tab, offscreen canvas, backgrounded app) | Does an embedded scene cost anything when nothing moves? | RN devs, Reanimated, web devs | DW AW AN | none | #445 |
| 15 | Energy above idle (Perfetto power rails on Pixel) | What does it do to the battery? | RN devs, marketing | AW AN | none | #448 |
| 16 | Input-to-frame latency (engine side) | How many frames from a touch to its effect? | game devs | DW AW AN | none | #450 |
| 17 | Determinism across JSC, V8 and Hermes | Does a seeded fixed-step run match across runtimes? | devs | all JS engines | none | #449 |
| 18 | Device tiers (low, mid, high) | Is this only fast on flagships? | devs, marketing | AW AN | Pixel 7 only (middle) | #454 (Q1 2027), #163 |
| 19 | iOS of any kind | Anything at all on iPhone? | everyone | IW IN | **never measured** | #452 (owned Mac and iPhone, Q1 2027), #453 (native app) |
| 20 | Per-release history | Is it getting faster or slower? | maintainers | all | history files exist, not published | #437 |
| 21 | Reproduce on your own device | Can I check this myself? | maintainers, devs | DW AW IW | clone the engine | #451 |

Out of scope, stated so nobody assumes it is measured: **true GPU execution time** on the web (page
script cannot read it reliably; capacity, row 3, is the GPU-inclusive proxy) and **touch-to-photon
latency** (needs a high-speed camera; row 16 measures the engine's share).

## Issues and order

New issues: #437–#452, plus two owner decisions, #453 and #454; all are in the **Perf** milestone. Recommended order:

1. **#437 public export.** Every later lane then reaches any consumer (including the public site)
   without a consumer-side adapter change.
2. **#438, #439, #440.** Cheap: they reuse `apps/bench-web` and the node harness. Together they
   give marketing its capacity figure, CanvasKit its overhead figure, and React Native readers a Hermes
   CPU figure.
3. **#162, then #441 and #442.** The native lane is what RN Skia and Reanimated readers need most;
   #162 moves from p3 to p2.
4. **#443, #445.**
5. p3: #444, #446, #447, #448, #449, #450, #451.
6. **Q1 2027, when the Mac and iPhone arrive:** #453, #452, #454.

Changes to existing issues:

- **#162** raised from p3 to p2; its Done-when now also requires the rows to be published in
  `benchmarks.md` at the next recapture.
- **#163** stays p3, deferred to the device decision in #454 (see its comment).
