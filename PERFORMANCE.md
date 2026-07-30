# Performance

What Flare measures, how, and — the part that matters most — **what it does not measure at all.**

Numbers below are quoted from the committed baseline
[`benchmarks/results/microbench.json`](benchmarks/results/microbench.json); the full tables live in
[`docs/references/benchmarks.md`](docs/references/benchmarks.md), which is machine-generated and
carries its own capture date under every table. If this page and that one disagree, that one is
right and this one is stale — [open an issue](../../issues).

---

## Read this first

**Every published Flare number is a pure-JavaScript cost, measured on one desktop machine under
Bun.** No Skia rasterization, no GPU, no bridge, no device, no browser. The draw path is measured
up to the point where the engine hands a batch to Skia; what Skia then does with it is not
measured anywhere in this repository.

That is a real limit, not a disclaimer. A frame that costs 12.6 ms of engine time here can miss
60 fps on a phone for reasons none of these benchmarks can see.

---

## What is measured

| Surface | How | Status |
|---|---|---|
| Off-device microbenchmarks (ecs, physics, particles, render, integration) | Bun, one desktop machine, 5 independent runs folded to a median with a spread band | **current** |
| Draw-path allocation counters | exact integers against a counting Skia stub — allocations, draw calls, batch runs, transform writes | **current, gated in CI** |
| Published package size | gzipped tarball bytes per package, ceilinged | **current, gated in CI** |
| Integration heap footprint | isolated subprocess per scenario, warmed to the allocation plateau | **current** |

### Headline numbers

Captured 2026-07-30 at `b1b21c1`, 5 runs, 13th Gen Intel Core i9-13900KF, `__DEV__ = false`,
4.6% of the machine busy with other work.

| Scenario | Median | Spread across runs |
|---|---:|---|
| `ecs.step` 1 000 entities | 23.2 µs | 22.9–23.5 µs |
| `particles.update` 1 000 integrate-only | 9.0 µs | 8.9–9.1 µs |
| `render.flush` 1 000 sprites / 1 atlas | 55.6 µs | 54.5–56.1 µs |
| `render.flush` 1 000 sprites / outline effect | 123.6 µs | 118.4–129.4 µs |
| `physics.step` 500 AABB sparse | 2.77 ms | 2.43–2.83 ms |
| `integration.frame` 1 000 entities + 300 particles | 12.62 ms | 12.31–12.71 ms |

**The spread column is not decoration.** A number without it cannot tell a regression from this
machine having a bad minute, and for three months this repository published single-run figures
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

### Web / CanvasKit — never benchmarked

`@flare-engine/render-web` has test coverage and zero benchmarks. The CanvasKit parity notes
flagged that `drawAtlas` WebGL performance may differ materially from the native path and that it
should be benchmarked; that never happened. Web bundle size, WASM load time and cold start are
likewise unmeasured.

### Android device frame rates — stale, and unrefreshable

The only on-device capture in this repository is from **2026-04-22** — one Android handset,
running a bench scene from a game app that now lives in a separate repository. It measures that
game, not the engine. The copy-CSV-from-logcat pipeline behind it no longer exists anywhere, so
the file is marked `stale` in its own metadata and cannot be refreshed. Rebuilding engine-owned
device measurement is planned work; until it lands, treat every device figure as a historical
record of one build on one handset.

### Packages with no benchmark at all

Benchmarks measure four packages directly — `ecs`, `physics`, `particles`, `render` — plus `core` indirectly through the pools, out of 41. These have per-frame hot paths and **no coverage at all**:

`animation` · `postfx` · `tilemap` · `pathfinding` · `math` · `scene` · `simulation` · `ui` ·
`shapes` · `input` · `a11y`

Their cost is not known to be small. It is not known.

### Other unmeasured surfaces

- **Cold start / time-to-first-frame** on any platform.
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

**Freshness is mechanically enforced.** `check:perf-freshness` fails CI when any source a suite
measures has changed since the capture commit — comparing reachability, not dates, because a
sixty-day-old capture against untouched sources still describes the code, and a capture from this
morning against an edited source does not.

### Reproducing

```bash
bun run bench            # x5, from a clean tree — appends to the run log
bun run bench:promote    # folds the last 5 runs into the baseline, with spread bands
bun run bench:md         # regenerates docs/references/benchmarks.md
```

Numbers will not match this page — different silicon, different thermal behaviour. The **ratios**
between scenarios, and each row's spread, are what transfer.
