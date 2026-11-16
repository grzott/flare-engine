---
"@flare-engine/render": patch
---

`SpriteBatch.flush` no longer slows down for coloured sprites in a process that has already flushed many kinds of uncoloured run. No exported signature changes, and the flush callback is called exactly as before: `(image, commands)` for an uncoloured run, `(image, commands, colors)` for a coloured one.

What changed, all inside `SpriteBatch`:

- A queue that holds at least one sprite drawn with a `color` is flushed by its own loop; a queue with none is flushed by a loop that does no colour work. Both group runs by the same keys as before.
- Returning the queued commands to the pool, in `flush` and in `clear`, is one shared indexed loop instead of a `for...of` at the end of each.

Why: with one loop for both, the first coloured sprite sent that loop back to unoptimised code under JavaScriptCore. In a process that had already recompiled it several times for different uncoloured workloads, it stayed there for longer than a benchmark warm-up.

Measured under Bun 1.3.11 on Linux x64, against the benchmark's counting Skia stub (no rasterization), on the `particles.draw 1000 coloured + fading / 1 atlas` row, median per frame, each reading in a fresh process:

| | alone | after the particles, render, integration and render-system suites |
|---|---|---|
| before | 75.1 - 76.3 µs (8 processes) | 128.3 - 143.6 µs in 7 of 8, 63.6 µs in 1 |
| after | 60.3 - 61.9 µs (32 processes) | 61.1 - 62.9 µs in 30 of 32, 71.8 and 72.9 µs in 2 |

The two slower readings that remain were not traced to a cause. The uncoloured `render.flush`, `integration.frame` and `render.system` rows, measured in three processes before and three after, moved by 2.4% at most and in both directions, which is about their run-to-run spread on that machine. Hermes, V8 and SpiderMonkey were not measured.

`bun run bench:order` in `benchmarks/` repeats the comparison: it measures the row alone and after those suites, in fresh processes, and fails when an after-suites reading is more than 15% from the alone median.
