# Performance

What Flare measures, how, and — the part that matters most — **what it does not measure at all.**

**This page carries no numbers.** Every figure lives in
[`docs/references/benchmarks.md`](docs/references/benchmarks.md), which is generated from the
committed baseline [`benchmarks/results/microbench.json`](benchmarks/results/microbench.json) and
the per-lane web captures beside it, and carries its own capture date, commit and spread under every
table. This page describes what those measurements are, how they are taken, and where the gaps are.

---

## Read this first

**The node lane — where the headline numbers come from — is a pure-JavaScript cost, measured on one
desktop machine under Bun.** No Skia rasterization, no GPU, no bridge, no device, no browser. The
draw path is measured up to the point where the engine hands a batch to Skia; what Skia then does
with it is not measured in that lane at all.

Three web lanes go further: they bind real CanvasKit through `@flare-engine/render-web` and add
software rasterization, two GPU-backed lanes on real drivers, a browser, and one phone. **Both GPU
lanes measure CPU-side submission cost, not GPU execution time** — WebGL and CanvasKit calls queue
work and return, so a clock bracket sees everything the CPU does to build and hand off the frame and
none of what the GPU then does with it.

Nothing in this repository measures **native** rendering — React Native + Skia on a device — at all.

That is a real limit, not a disclaimer. A frame that costs 5 ms of engine time here can miss 60 fps
on a phone for reasons none of these benchmarks can see.

---

## What is measured

| Surface | How | Status |
|---|---|---|
| Off-device microbenchmarks (ecs, physics, particles, render, integration) | Bun, one desktop machine, 5 independent runs folded to a median with a spread band | **current** |
| Draw-path allocation counters | exact integers against a counting Skia stub — allocations, draw calls, batch runs, transform writes | **current, gated in CI** |
| Published package size | gzipped tarball bytes per package, ceilinged | **current, gated in CI** |
| Integration heap footprint | isolated subprocess per scenario, warmed to the allocation plateau | **current** |
| Web render — CPU-raster | 18 scenarios through real CanvasKit on an offscreen `MakeSurface`, driver-independent by construction | **current** |
| Web render — desktop GPU | the same 18 scenarios on an on-screen `<canvas>` + WebGL surface (ANGLE/D3D11, RTX 4070 Ti); **CPU-side submission cost** | **current** |
| Web render — Android device | the same 18 scenarios on a USB-attached Pixel 7 (Mali-G710), same submission-cost caveat | **current** |
| CanvasKit WASM payload | raw and gzipped bytes read off the installed package, never hardcoded | **current** |
| Web cold start to first rendered frame | plain and throttled (4 Mbit/s) network profiles, cold and warm | **current** |

### Headline numbers

The current figures — with capture date, commit, machine and per-row spread — live in one place:
[`docs/references/benchmarks.md`](docs/references/benchmarks.md#headline-numbers). That page is
regenerated from the committed baseline by `bun run bench:md`, and this page deliberately does not
restate it: a hand-copied table here went 2.5× stale the moment the baseline was re-captured, which
is exactly the failure the one-source-per-fact rule exists to prevent.

**The spread column there is not decoration.** A number without it cannot tell a regression from
this machine having a bad minute, and for three months this repository published single-run figures
that turned out to be 3.1× optimistic. Treat any change inside the band as noise.

### Zero-allocation claims

The engine claims zero allocation in `update()` and `render()`. That claim rests on **exact integer
counters**, not on heap deltas:

- 11 draw-path scenarios assert precise per-frame counts — pool misses, Skia factory calls,
  `drawAtlas` / `drawImageRect` / `drawRect` calls, and rotated/unrotated transform writes.
- All 11 run in CI on every push via `bun run check:perf`, and **fail in both directions**: an
  improvement is a changed published claim and must be committed too.

Heap measurements are a **footprint proxy, not a retention measurement**. Under JSC,
`process.memoryUsage().heapUsed` reports MarkedSpace footprint rather than live bytes, so it moves
with GC scheduling. The integration heap rows currently read below the instrument's own resolution
(`< ±512 B/frame` at 500 entities, `< ±1311 B` at 2 000) — which means "under the noise floor",
never "exactly zero".

---

## What is NOT measured

### iOS — never, at all

**No Flare number has ever been measured on any iOS device.** Not once, on any device, at any
point. The blocker is an Apple Developer Program subscription, and it has never been unblocked. If
you are shipping to iOS, this repository gives you no performance information whatsoever — budget
accordingly and measure it yourself.

### GPU execution time — on any lane

The two GPU-backed web lanes measure what the **CPU** spends building and submitting a frame, not
what the GPU spends drawing it. Reading true GPU time from page script needs a timer-query
extension that is generally not exposed, or a forced pipeline sync that distorts the number it is
trying to measure. Submission cost is the figure a main-thread frame budget contends with, which is
why it is the one published — but it is not "how long the GPU took".

### Native (React Native + Skia) rendering — never benchmarked

The web lanes bind real CanvasKit; the **native** Skia path has no benchmark of any kind. Nothing
here tells you what `@shopify/react-native-skia` costs on a device, and web CanvasKit numbers must
not be read as a proxy for it.

### Android **native** frame rates — stale, and unrefreshable

The only native on-device capture in this repository is from **2026-04-22** — one Android handset,
running a bench scene from a game app that now lives in a separate repository. It measures that
game, not the engine. The copy-CSV-from-logcat pipeline behind it no longer exists anywhere, so the
file is marked `stale` in its own metadata and cannot be refreshed. Rebuilding engine-owned native
device measurement is planned work; until it lands, treat every native device figure as a historical
record of one build on one handset.

This is **not** refreshed by the on-device web lane. That lane is a different measurement on a
different phone (Pixel 7) through a different renderer (Chrome + WebGL), and it is current; the
2026-04-22 native capture stays dead regardless.

### Packages with no benchmark at all

Benchmarks measure five packages directly — `ecs`, `physics`, `particles`, `render` and
`render-web` (the three web lanes drive its real surface) — plus `core` indirectly through the
pools, out of 41. These have per-frame hot paths and **no coverage at all**:

`animation` · `postfx` · `tilemap` · `pathfinding` · `math` · `scene` · `simulation` · `ui` ·
`shapes` · `input` · `a11y`

Their cost is not known to be small. It is not known.

### Other unmeasured surfaces

- **Cold start / time-to-first-frame on native (iOS, Android).** Measured for web only — see the
  cold-start section of [`benchmarks.md`](docs/references/benchmarks.md#cold-start-to-first-rendered-frame).
- **Memory ceilings** — peak RSS under sustained load, texture eviction, resume-from-background.
- **Garbage-collection pauses.** Nothing in this repository can currently measure GC pause time,
  which is why no package README claims "no GC during gameplay".
- **Multi-core / worker behaviour.** Everything is single-threaded and measured as such.

---

## Methodology

**Two tracks, deliberately separated.**

*Track A — deterministic counters.* Integers that do not depend on machine speed: allocations,
draw calls, batch runs, transform writes, published bytes. These are hard-gated in CI and can fail
a pull request outright.

*Track B — wall-clock.* Recorded and published, never hard-gated. Wall-clock on shared hardware
swings far too widely to gate on without constant false alarms, so it is measured on stable
hardware and reported with its variance.

**Every capture must state its provenance.** A number that cannot name the commit it measured is
treated as having no value: `bench:promote` refuses runs from a dirty tree, runs that disagree on
machine or commit, and runs captured with an undeclared `__DEV__` (which would measure a JSC
deoptimisation rather than the engine).

**Captures are refused from a busy machine.** Foreign CPU load is measured across the timed suites
and recorded; a window above 15%, or one where two or more runs sit further than 10% from the
folded median, cannot be published. Both exist because two captures taken beside a fleet of
background processes once read a headline row 23% low and only a human noticing caught it.

**Captures are refused under a power-saving plan.** Every number this repository published before
2026-08-19 was captured on a machine running Windows *Power saver*, which made results bimodal with
a ~2.5× swing on an i9-13900KF. The capture now reads the active power scheme, records it beside
`cpuModel` as provenance, and refuses outright to run under Power saver.

**Freshness is mechanically enforced.** `check:perf-freshness` fails CI when any source a suite
measures has changed since the capture commit — comparing reachability, not dates, because a
sixty-day-old capture against untouched sources still describes the code, and a capture from this
morning against an edited source does not.

### Published figures that were withdrawn

Both of these were wrong in this repository's own published tables, and both are stated here rather
than quietly overwritten:

- **Every web figure published before 2026-08-18 was quantized to the display refresh interval** and
  must not be cited. The sampler took a frame-to-frame `requestAnimationFrame` delta as its sample,
  so every value was an integer multiple of 16.667 ms; 13 of the 18 GPU rows reported the refresh
  rate itself and nothing about the engine.
- **Every node figure published before 2026-08-19 was captured under Windows Power saver** and reads
  roughly 2.5× slow against the same code on the same machine under High performance.

### Reproducing

```bash
bun run bench            # x5, from a clean tree — appends to the run log
bun run bench:promote    # folds the last 5 runs into the baseline, with spread bands
bun run bench:md         # regenerates docs/references/benchmarks.md
```

Numbers will not match this page — different silicon, different thermal behaviour. The **ratios**
between scenarios, and each row's spread, are what transfer.
