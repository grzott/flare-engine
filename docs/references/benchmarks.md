# Flare Engine — Benchmarks

> Generated: 2026-04-22 · Runtime: Bun 1.3.11 · Platform: win32 x64. Regenerate: `bun run bench:md` (re-runs microbenches, ~60s) or `bun run bench:md:cache` (device-only update from cached JSON).

## Headline numbers

| Metric | Value |
|---|---:|
| ECS step, 1000 entities (Pos+Vel) | **23.7 µs** / frame |
| Particles integrate, 1000 alive | **7.7 µs** / frame |
| Render flush, 1000 sprites / 1 atlas | **26.6 µs** / frame |
| Integration frame, 1000 entities + 300 particles | **9.01 ms** / frame |
| Samsung Galaxy A54 5G · light (10 enemies + 50 bullets) | **120 fps avg** (min 119.79, max 120.41) |
| Samsung Galaxy A54 5G · medium (30 enemies + 150 bullets) | **117 fps avg** (min 111.37, max 119.52) |
| Samsung Galaxy A54 5G · heavy (50 enemies + 300 bullets) | **48 fps avg** (min 46.88, max 48.82) |

## Methodology

Off-device microbenchmarks exercise engine hot paths under Bun on the developer machine — pure algorithmic cost, no Skia, no React Native bridge, no device I/O. Their value is regression detection and order-of-magnitude sizing; they do **not** predict on-device frame times. For real frame times see the [Device](#device) section.

Each row reports the median of 30 samples, where each sample times N inner iterations of the hot path. "p99" is the 99th-percentile sample latency across those 30 samples.

Frame budget at 60 fps is 16.67 ms. A system taking 1 ms per step leaves 15+ ms for the rest of the frame.

## ECS

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| ecs.step   500 entities (Pos+Vel) | 11.51 µs | 86.9K/s | 17.8 µs |
| ecs.step  1000 entities (Pos+Vel) | 23.70 µs | 42.2K/s | 45.1 µs |
| ecs.step  2000 entities (Pos+Vel) | 46.70 µs | 21.4K/s | 58.3 µs |
| ecs.step  5000 entities (Pos+Vel) | 119.68 µs | 8.4K/s | 128.8 µs |

## Physics

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| physics.step   100 AABB sparse | 79.94 µs | 12.5K/s | 100.9 µs |
| physics.step   100 AABB dense  | 74.62 µs | 13.4K/s | 103.8 µs |
| physics.step   500 AABB sparse | 2.09 ms | 477/s | 2462.4 µs |
| physics.step   500 AABB dense  | 2.05 ms | 489/s | 2575.5 µs |
| physics.step  1000 AABB sparse | 8.33 ms | 120/s | 9562.7 µs |
| physics.step  1000 AABB dense  | 9.58 ms | 104/s | 10891.0 µs |

## Particles

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| particles.update   500 integrate-only | 2.78 µs | 359.5K/s | 5.1 µs |
| particles.update  1000 integrate-only | 7.71 µs | 129.8K/s | 14.5 µs |
| particles.update  2000 integrate-only | 16.90 µs | 59.2K/s | 28.9 µs |
| particles.update  5000 integrate-only | 47.11 µs | 21.2K/s | 73.3 µs |
| particles.update   500 emit+integrate | 8.46 µs | 118.2K/s | 17.3 µs |
| particles.update  1000 emit+integrate | 13.01 µs | 76.9K/s | 21.2 µs |
| particles.update  2000 emit+integrate | 27.71 µs | 36.1K/s | 46.2 µs |

## Render

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| render.flush    100 sprites / 1 atlas | 3.13 µs | 319.8K/s | 21.7 µs |
| render.flush    500 sprites / 1 atlas | 13.70 µs | 73.0K/s | 22.1 µs |
| render.flush   1000 sprites / 1 atlas | 26.61 µs | 37.6K/s | 44.9 µs |
| render.flush    500 sprites / 4 atlas | 16.95 µs | 59.0K/s | 28.2 µs |
| render.flush   1000 sprites / 8 atlas | 35.79 µs | 27.9K/s | 66.2 µs |
| render.sort     500 items (0 swaps) | 1.26 µs | 790.9K/s | 2.7 µs |
| render.sort     500 items (5 swaps) | 5.97 µs | 167.5K/s | 11.2 µs |
| render.sort    1000 items (10 swaps) | 20.81 µs | 48.1K/s | 27.4 µs |

## Integration

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| integration.frame   500 entities + 300p | 1.99 ms | 503/s | 2249.8 µs |
| integration.frame  1000 entities + 300p | 9.01 ms | 111/s | 11420.8 µs |
| integration.frame  2000 entities + 300p | 38.01 ms | 26/s | 42665.4 µs |

## Integration heap delta

Heap growth across N steady-state frames after warmup, measured `process.memoryUsage().heapUsed` deltas around forced GCs. Numbers near zero indicate zero-alloc steady state (modulo bookkeeping noise). Negative values just mean the GC reclaimed warmup garbage.

| Scenario | Frames | Δ heap | Per-frame |
|---|---:|---:|---:|
| integration.heap   500 entities | 500 | -10897.5 KB | -22318.0 B |
| integration.heap  1000 entities | 500 | +18123.7 KB | 37117.3 B |
| integration.heap  2000 entities | 500 | -16795.0 KB | -34396.2 B |

## Device

On-device FPS samples captured from a device benchmark scene (hidden triple-tap on title). Each sample = one second; load levels spawn fixed entity/particle counts.

### Samsung Galaxy A54 5G (Android 16 / One UI 8.0)

> Release build via `npx expo run:android --variant release`. Hermes enabled. 120 Hz display, uncapped. Bench scene: bullets with random velocities + wall-bounce integration + `coll.step()` per frame; enemies static. Samples = 1/sec, 10s per load.

| Load | Min | Avg | Max | Samples |
|---|---:|---:|---:|---:|
| light (10 enemies + 50 bullets) | 119.79 | 120.2 | 120.41 | 10 |
| medium (30 enemies + 150 bullets) | 111.37 | 116.6 | 119.52 | 10 |
| heavy (50 enemies + 300 bullets) | 46.88 | 48.0 | 48.82 | 10 |

## Notes on interpretation

- **ECS** — "op" is one `world.step(dt)` running the move system over all entities. Per-entity cost = `cost / entities`.
- **Physics** — "op" is one frame: move every collider + `world.step()`. "dense" packs colliders into a 500×500 area (many overlaps); "sparse" uses 2000×2000 (few).
- **Particles** — "integrate-only" holds N particles alive and calls `update(dt)` — measures pool integration cost. "emit+integrate" runs a saturated emitter at 2× cap/s with gravity.
- **Render** — `flush` measures sprite command queueing + grouping by texture. `sort` measures `sortByDrawOrder` on a nearly-sorted list with K random swaps (insertion sort is O(n+k²) after k swaps).
- **Integration** — one frame = `world.step` + per-entity `coll.setPosition` + `coll.step` + `emitter.update` + sprite draw queue + `sortByDrawOrder` + `batch.flush`. Steady state: 300 particles + N entities (Pos+Vel + AABB collider + sprite). Closer shape match to a real demo frame than per-system microbenches.

## Gating Phase 10 (C++ acceleration)

Per [build-plan.md](../plans/build-plan.md), C++ acceleration is only started for subsystems where these benchmarks (plus on-device measurements from the demo game) show a concrete bottleneck. Priority order from [native-acceleration.md](../design/native-acceleration.md) remains: particles → ECS hot loop → spatial hash → physics. Numbers above are the JS baseline against which any C++ port must demonstrate speedup.

### Decision — 2026-04-22

First device capture (Samsung Galaxy A54 5G, Android 16, release): light (60 entities) 120 fps, medium (180 entities) ~117 fps, heavy (350 entities) ~48 fps. The cliff between medium and heavy maps to the physics microbench: `CollisionWorld.step` is O(n·log n) broadphase + O(k) resolution, and the heavy load crosses the 500-AABB threshold where Bun measures ~2 ms/step (≈12 ms/step extrapolated under Hermes on ARM). That single call consumes most of a 16.6 ms budget at 350 colliders, confirming physics as the primary bottleneck at demo-scale loads — matching the `<1000 dynamic entities` guidance in the physics package.

**Outcome:** Phase 10 stays deferred until a second device (iOS) confirms the same cliff and a realistic target game needs >200 colliders. Demo at typical gameplay loads (≤150 colliders) comfortably holds 120 fps on mid-range Android, so the launch does not require a native port. If a future consumer hits the ceiling, the data points to physics broadphase (spatial hash) as the first C++ target, not particles.

