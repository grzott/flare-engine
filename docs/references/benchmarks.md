# Flare Engine — Benchmarks

> Generated: 2026-04-16 · Runtime: Bun 1.3.11 · Platform: win32 x64. Regenerate with `bun run bench:md` inside `benchmarks/`.

## Headline numbers

| Metric | Value |
|---|---:|
| ECS step, 1000 entities (Pos+Vel) | **23.5 µs** / frame |
| Particles integrate, 1000 alive | **7.4 µs** / frame |
| Render flush, 1000 sprites / 1 atlas | **32.3 µs** / frame |
| Integration frame, 1000 entities + 300 particles | **9.46 ms** / frame |
| Device FPS | _pending capture — see [Device](#device) section_ |

## Methodology

Off-device microbenchmarks exercise engine hot paths under Bun on the developer machine — pure algorithmic cost, no Skia, no React Native bridge, no device I/O. Their value is regression detection and order-of-magnitude sizing; they do **not** predict on-device frame times. For real frame times see the [Device](#device) section.

Each row reports the median of 30 samples, where each sample times N inner iterations of the hot path. "p99" is the 99th-percentile sample latency across those 30 samples.

Frame budget at 60 fps is 16.67 ms. A system taking 1 ms per step leaves 15+ ms for the rest of the frame.

## ECS

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| ecs.step   500 entities (Pos+Vel) | 11.83 µs | 84.5K/s | 18.7 µs |
| ecs.step  1000 entities (Pos+Vel) | 23.49 µs | 42.6K/s | 42.5 µs |
| ecs.step  2000 entities (Pos+Vel) | 46.55 µs | 21.5K/s | 53.2 µs |
| ecs.step  5000 entities (Pos+Vel) | 120.56 µs | 8.3K/s | 135.0 µs |

## Physics

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| physics.step   100 AABB sparse | 77.02 µs | 13.0K/s | 107.8 µs |
| physics.step   100 AABB dense  | 76.54 µs | 13.1K/s | 93.2 µs |
| physics.step   500 AABB sparse | 2.18 ms | 459/s | 2453.2 µs |
| physics.step   500 AABB dense  | 2.20 ms | 454/s | 2573.8 µs |
| physics.step  1000 AABB sparse | 9.50 ms | 105/s | 10735.0 µs |
| physics.step  1000 AABB dense  | 10.38 ms | 96/s | 12918.6 µs |

## Particles

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| particles.update   500 integrate-only | 2.79 µs | 358.0K/s | 13.6 µs |
| particles.update  1000 integrate-only | 7.41 µs | 135.0K/s | 11.8 µs |
| particles.update  2000 integrate-only | 19.05 µs | 52.5K/s | 28.1 µs |
| particles.update  5000 integrate-only | 45.41 µs | 22.0K/s | 63.4 µs |
| particles.update   500 emit+integrate | 6.11 µs | 163.8K/s | 13.1 µs |
| particles.update  1000 emit+integrate | 12.87 µs | 77.7K/s | 22.7 µs |
| particles.update  2000 emit+integrate | 24.62 µs | 40.6K/s | 43.5 µs |

## Render

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| render.flush    100 sprites / 1 atlas | 4.16 µs | 240.1K/s | 8.5 µs |
| render.flush    500 sprites / 1 atlas | 18.20 µs | 55.0K/s | 30.4 µs |
| render.flush   1000 sprites / 1 atlas | 32.28 µs | 31.0K/s | 73.6 µs |
| render.flush    500 sprites / 4 atlas | 17.62 µs | 56.7K/s | 29.8 µs |
| render.flush   1000 sprites / 8 atlas | 43.36 µs | 23.1K/s | 84.7 µs |
| render.sort     500 items (0 swaps) | 1.31 µs | 761.4K/s | 2.5 µs |
| render.sort     500 items (5 swaps) | 6.74 µs | 148.4K/s | 10.8 µs |
| render.sort    1000 items (10 swaps) | 25.71 µs | 38.9K/s | 35.3 µs |

## Integration

| Scenario | Cost / op (median) | Ops / sec | p99 sample |
|---|---:|---:|---:|
| integration.frame   500 entities + 300p | 2.27 ms | 441/s | 2653.5 µs |
| integration.frame  1000 entities + 300p | 9.46 ms | 106/s | 12305.9 µs |
| integration.frame  2000 entities + 300p | 40.62 ms | 25/s | 47120.4 µs |

## Integration heap delta

Heap growth across N steady-state frames after warmup, measured `process.memoryUsage().heapUsed` deltas around forced GCs. Numbers near zero indicate zero-alloc steady state (modulo bookkeeping noise). Negative values just mean the GC reclaimed warmup garbage.

| Scenario | Frames | Δ heap | Per-frame |
|---|---:|---:|---:|
| integration.heap   500 entities | 500 | -16861.4 KB | -34532.2 B |
| integration.heap  1000 entities | 500 | +18244.1 KB | 37364.0 B |
| integration.heap  2000 entities | 500 | -16910.5 KB | -34632.7 B |

## Device

No device samples captured yet. Run `apps/demo` on hardware, open the bench scene (triple-tap the menu title), copy CSV from console, and append entries to `benchmarks/results/device.json`.

## Notes on interpretation

- **ECS** — "op" is one `world.step(dt)` running the move system over all entities. Per-entity cost = `cost / entities`.
- **Physics** — "op" is one frame: move every collider + `world.step()`. "dense" packs colliders into a 500×500 area (many overlaps); "sparse" uses 2000×2000 (few).
- **Particles** — "integrate-only" holds N particles alive and calls `update(dt)` — measures pool integration cost. "emit+integrate" runs a saturated emitter at 2× cap/s with gravity.
- **Render** — `flush` measures sprite command queueing + grouping by texture. `sort` measures `sortByDrawOrder` on a nearly-sorted list with K random swaps (insertion sort is O(n+k²) after k swaps).
- **Integration** — one frame = `world.step` + per-entity `coll.setPosition` + `coll.step` + `emitter.update` + sprite draw queue + `sortByDrawOrder` + `batch.flush`. Steady state: 300 particles + N entities (Pos+Vel + AABB collider + sprite). Closer shape match to a real demo frame than per-system microbenches.

## Gating Phase 10 (C++ acceleration)

Per [build-plan.md](../plans/build-plan.md), C++ acceleration is only started for subsystems where these benchmarks (plus on-device measurements from the demo game) show a concrete bottleneck. Priority order from [native-acceleration.md](../design/native-acceleration.md) remains: particles → ECS hot loop → spatial hash → physics. Numbers above are the JS baseline against which any C++ port must demonstrate speedup.

