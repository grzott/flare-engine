# Perf Measurement Plan — 2026-07-28

> Scope: `flare-engine` + `Pan-Tvardowski`. Goal: real, current, automated performance
> numbers before the October 2026 open-source flip. Audit performed 2026-07-28 against
> working trees at `flare-engine@a3e4a64` and `Pan-Tvardowski@e0f35f5`. Every number below
> was re-derived this session, not read from a doc.

## Verdict

The measurement **tooling is already built** — off-device microbenches, a TestingBot +
Maestro device harness, a rolling-median regression gate, a dashboard generator, and a
Next.js dashboard app. Almost none of it is **wired to anything that forces it to run**.

The consequence is not "we have no numbers." It is worse: **we have wrong numbers, published.**
The headline render figure in `docs/references/benchmarks.md` is **3.2× optimistic** against
the code that ships today, and it has been re-published in two public blog posts and baked
into an OG image.

The problem is not devices, not money (~€11/mo), and not tooling. It is that every
measurement is a manual, owner-initiated act. Numbers were captured once and then rotted
while five features landed on top of them.

---

## 1. The regression (primary finding)

`benchmarks/results/microbench.json` was last captured **2026-04-16**. Re-running
`bun run --cwd benchmarks bench` today, three times, on the same machine, same runtime
(`Bun 1.3.11`), same platform (`win32 x64`):

| Scenario | Apr-16 baseline | run 1 | run 2 | run 3 | median | **ratio** |
|---|---:|---:|---:|---:|---:|---:|
| `render.flush 100 / 1 atlas` | 3.13 µs | 8.54 | 8.34 | 8.30 | 8.34 µs | **2.67×** |
| `render.flush 500 / 1 atlas` | 13.70 µs | 41.99 | 44.36 | 39.06 | 41.99 µs | **3.07×** |
| `render.flush 1000 / 1 atlas` | 26.61 µs | 84.03 | 90.73 | 77.04 | 84.03 µs | **3.16×** |
| `render.flush 500 / 4 atlas` | 16.95 µs | 56.23 | 53.79 | 50.81 | 53.79 µs | **3.17×** |
| `render.flush 1000 / 8 atlas` | 35.79 µs | 127.88 | 113.48 | 103.87 | 113.48 µs | **3.17×** |
| `ecs.step 1000` *(control)* | 23.70 µs | 23.55 | 23.06 | 23.08 | 23.08 µs | **0.97×** |

**The ECS control row is what makes this conclusive.** If the machine were slower today, ECS
would be slower too. It is not — it is within 3% of April. Render is uniformly ~3.1× worse
across every scenario. Run-to-run spread is ±8%; a 3.16× gap is an order of magnitude outside
the noise band.

Other suites drifted too, single-run against `benchmarks.md`:

| Scenario | Apr | Jul-28 | ratio |
|---|---:|---:|---:|
| `particles.update 1000 integrate-only` | 7.7 µs | 9.10 µs | 1.18× |
| `physics.step 500 AABB sparse` | 2.09 ms | 2.86 ms | 1.37× |
| `integration.frame 1000 + 300p` | 9.01 ms | 12.43 ms | 1.38× |

### Why render moved

`packages/render/src/sprite-batch.ts` took five commits after the baseline, none of them
followed by a re-bench:

| Date | Commit | What it added to the hot path |
|---|---|---|
| 2026-05-10 | `db21689` | `alpha` — a new field in the batch-run key |
| 2026-06-03 | `ec11ddf` | per-sprite rotation via RSXform — `cos`/`sin` branch in `fillXforms` |
| 2026-06-04 | `39329f4` | non-uniform stretch — a second new field in the batch-run key |
| 2026-07-08 | `e271eb2` | shader-effect + z-order correctness |
| 2026-07-10 | `376969a` | toolchain: Biome 2 + TS 5.9 + tsdown |

This is very likely the honest price of shipped features, not a bug. **That does not matter
for the record.** The published number describes April's code, and April's code is not what
anyone will install.

### Blast radius

| Surface | Status |
|---|---|
| `docs/references/benchmarks.md` § Headline + § Render | wrong |
| `grzott-portfolio` `docs/blog/NUMBERS.md` rows `render-flush-1k-sprites-us`, `render-flush-500-sprites-us`, `render-flush-1k-8atlas-us` | wrong |
| Published post `2026-05-25-zero-alloc-game-loops-in-typescript` (body + dev.to) | cites 26.6 µs and 9.01 ms |
| Published post `2026-06-01-skia-atlas-2000-sprites-react-native` (body + dev.to) | cites 26.6 / 13.70 / 35.79 µs in a table and in prose |
| That post's **OG image** | KPI tile reads `26.6µs \| 1K FLUSH` |

---

## 2. Evidence ledger — what exists

### Works today

| Asset | Location | State |
|---|---|---|
| Off-device microbench harness | `benchmarks/src/` | **Runs clean.** 5 suites, ~60 s. Verified 2026-07-28 |
| Bench stats harness | `benchmarks/src/harness.ts` | median/mean/p99 over 30 samples, 3 warmups |
| Markdown generator | `bun run bench:md` | writes `docs/references/benchmarks.md` |
| Dashboard app | `apps/bench-dashboard/` | Next 16 + recharts, reads both result JSONs, static `out/` |
| Device harness | `Pan-Tvardowski/scripts/perf/bench-cloud.sh` | TestingBot + Maestro, 6 scenarios |
| Bench mode | `PT/src/perf/bench-mode.ts` | seeded RNG, muted audio/save, `BENCH_DONE` sentinel |
| Maestro perf flows | `PT/maestro/perf-*.yml` | 6 flows: boot, 2 bosses, bullet-curtain, particle-storm, zone-transitions |
| Regression gate | `PT/scripts/perf/regression-check.ts` | 7-day rolling median per device×scenario×metric |
| Dashboard renderer | `PT/scripts/perf/render-dashboard.ts` | writes `docs/perf/REGRESSION.md` |
| Device matrix | `PT/scripts/perf/devices.json` | 3 Android active, 3 iOS `skip:true`, 1 local AVD |
| Cost model + protocol | `docs/perf/protocol.md` | TestingBot PAYG ~€0.06/min, ~€11/mo projected |

### Broken, stale, or never wired

| # | Problem | Evidence |
|---|---|---|
| **B1** | **The render bench measures the wrong thing.** `drawAtlas: () => {}` is a no-op, so `fillXforms` — the per-sprite transform loop — never executes. The bench measures queueing + run-grouping only | `benchmarks/src/render.bench.ts:28` |
| **B2** | **Heap numbers are pure noise.** Today's run: −56,799 B/frame (500 ent), **+36,767** B/frame (1000 ent), −32,741 B/frame (2000 ent). The sign flips. This cannot support the README's "zero-alloc hot paths" claim | `integration.bench.ts` heap-delta output |
| **B3** | **Device harness paused.** Cron disabled 2026-06-24 after failing on-device **every night 06-13 → 06-24**, masked green by `continue-on-error`, burning ~58 device-min/night for zero rows. Last data row: **2026-06-12** | `PT/.github/workflows/perf-bench.yml:16-25` |
| **B4** | **The device harness measures the game, not the engine.** All 6 scenarios are Pan Tvardowski content (bosses, zones). Useful as a showcase datapoint; not an engine spec | `PT/maestro/perf-*.yml` |
| **B5** | **Bench coverage is 4 of 41 packages.** ecs, physics, particles, render (+ an integration composite). Nothing for animation, postfx, tilemap, pathfinding, scene, simulation, ui, math | `benchmarks/src/*.bench.ts` |
| **B6** | **Web is entirely unmeasured.** `packages/render-web` has 4 test files and zero benchmarks. `canvaskit-parity.md` flagged "`drawAtlas` WebGL performance may differ — benchmark in the stage 11.1 spike"; that spike never produced numbers | `docs/references/canvaskit-parity.md:11` |
| **B7** | **No gate anywhere.** `.github/workflows/ci.yml` has no bench step. `docs/plans/flip-runbook.md` has zero perf gates. `docs/plans/manual-test-protocol.md` sets no frame-rate bar | grep: 0 hits |
| **B8** | **`.perf-baseline.json` is `{}`** in both repos. The threshold mechanism exists and is empty | both roots |
| **B9** | **Duplicate stale infra.** `flare-engine/scripts/perf/` + `docs/perf/` are a dead fork left by the PT extraction — engine data stops 2026-05-26, PT's runs to 06-12, and the engine has no `perf-bench.yml` so its copy can never run | both trees |
| **B10** | **iOS has never been measured.** 3 iOS devices configured `skip:true`; blocked on the $99/yr Apple Developer Program | `devices.json`, `protocol.md` § Activating iOS |

---

## 3. Root cause

Every measurement in both repos is **pull, never push**. The bench runs when the owner types
the command. Nothing in CI, nothing in the release checklist, and nothing in the flip runbook
demands a fresh number. So:

- a number gets captured during a burst of enthusiasm,
- it gets copied into docs, then into `NUMBERS.md`, then into a blog post, then into an
  OG image — each copy losing a little more context about when it was taken,
- features land on the measured path,
- and the number keeps being true-looking for three months.

The fix is not more benchmarks. It is **making the absence of a fresh number fail something.**

---

## 4. Architecture: two tracks

The single most important design decision. Wall-clock time on a shared CI runner swings
±50% and cannot be hard-gated without constant false alarms. So split the signal:

### Track A — deterministic counters (hard CI gate, zero variance)

Integers that do not depend on machine speed. These can fail a PR outright.

| Counter | What it proves |
|---|---|
| Allocations per frame in the hot path | the zero-alloc claim, honestly |
| `drawAtlas` calls per flush, per scenario | batching actually batches |
| Batch-run count for a given draw order | z-order-preserving grouping works |
| `fillXforms` writes per frame | transform work is linear, not quadratic |
| Rotated vs unrotated branch hit counts | the cheap path is actually taken |
| Published bundle bytes (per package, gzipped) | size does not creep |

Implement by instrumenting the pools and the draw callback with counting stubs — not by
timing anything. **This is what goes in `ci.yml`.**

### Track B — wall-clock (recorded, dashboarded, soft-gated)

| Surface | Where it runs | Gate |
|---|---|---|
| Off-device microbench | owner machine + nightly self-hosted | rolling 7-day median ratio, warn at 1.10, fail at 1.25 |
| Native device frame p95 | TestingBot, 3 Android | existing `regression-check.ts`, per-device thresholds |
| Web frame p95 | Playwright headless + TestingBot browsers | same gate shape |
| Cold start / bundle load | both | absolute budget, generous |

**Never gate Track B on a GitHub-hosted runner.** Record there, gate on stable hardware.

---

## 5. Phases

### P0 — Correct the record (0.5 day) — do this first, independent of everything else

Right now the repo publishes a wrong number. That is a bigger liability than publishing none.

1. Run `bun run --cwd benchmarks bench` **5×**; record all five, commit the median as the new
   baseline plus an explicit variance band (min/max) so the next reader can tell noise from drift.
2. Regenerate `docs/references/benchmarks.md` (`bun run bench:md`). Add a `Captured:` date to
   every table, not just the page header.
3. Add a **"what these do not measure"** paragraph naming B1 explicitly: the flush bench passes
   a no-op draw callback, so per-sprite transform cost is excluded.
4. In `grzott-portfolio`: update the three `NUMBERS.md` render rows, re-date them, and add a
   `POSTMORTEMS.md` entry.
5. Decide the correction policy for the two published posts. Repo convention is: do not retro-edit
   published bodies; issue a correction of record. The OG image tile is the awkward one — it is
   an image asset, regenerable, and carries no date.

**Exit:** no published surface in either repo cites a render number captured before 2026-07-28.

### P1 — Make the microbench trustworthy (2 days)

1. **Fix `render.bench.ts`.** Replace `drawAtlas: () => {}` with a counting stub that still
   forces `fillXforms` to run. Split scenarios by rotated fraction (0% / 50% / 100%) — the
   rotated branch costs a `cos` + `sin` and the unrotated one does not, so a single blended
   number hides the real axis.
2. **Sprite-count sweep:** 100 / 500 / 1 000 / 2 000 / 5 000 × atlas count 1 / 4 / 8.
   This is the axis that grows, and the one currently unmeasured.
3. **Replace heap-delta with allocation counting.** `process.memoryUsage()` deltas across a GC
   are unusable (B2). Instrument `Pool` and the RSXform pool with a counter, assert exact
   integers. This turns "zero-alloc" from a claim into a test.
4. **Multi-run by default.** The harness should run each bench N times and report
   median-of-medians + IQR, so variance is visible in the output rather than inferred.
5. **Extend coverage** to the packages with real hot paths: `animation`, `postfx`, `tilemap`,
   `pathfinding`, `math`. Skip the ones that are not per-frame.

**Exit:** the bench measures the transform path; alloc counts are exact; every row carries a
variance band.

### P2 — CI gate (1 day)

1. Add a `bench` job to `flare-engine/.github/workflows/ci.yml` running **Track A only** —
   allocation counts, draw-call counts, batch counts, bundle bytes. Hard fail on any delta.
2. Populate `.perf-baseline.json` in both repos with real per-scenario thresholds.
3. Add a nightly (or weekly) Track B run on stable hardware, appending to an ndjson and
   regenerating the dashboard. A self-hosted runner on the dev machine is the cheap option;
   a scheduled local script with commit-back is cheaper still.
4. **Delete `flare-engine/scripts/perf/` and `flare-engine/docs/perf/`** (B9) or add a header
   pointing at PT as the owner. Two divergent copies of a regression gate is a trap.

**Exit:** a PR that adds an allocation to the render hot path fails CI.

### P3 — Engine-level device bench (3 days) — the biggest gap

PT measures a game. An engine release needs engine numbers.

1. Create `apps/bench-native` — a minimal Expo app whose only job is running engine scenarios.
   No game logic, no assets beyond a test atlas, no auth/IAP/save.
2. Reuse PT's harness wholesale: the `bench-mode.ts` pattern, the `BENCH_DONE` +
   `copyTextFrom` extraction trick (Hermes release does not forward `console.log` to logcat —
   PT already solved this), `bench-cloud.sh`, `devices.json`, the regression gate.
3. Scenarios, each a pure engine stress:
   - sprite sweep 100 → 5 000, atlas count 1 / 4 / 8
   - rotated fraction 0 / 50 / 100 %
   - postfx chain depth 0 / 1 / 3 passes
   - particle count sweep
   - **texture eviction after backgrounding** and **resume-from-background** — the two failure
     modes committed to publicly on r/reactnative 2026-06-10 and still unrun
4. Revive the paused cron: cut a fresh bench APK at HEAD, validate with one
   `workflow_dispatch`, then re-enable weekly (not nightly — nightly was burning device minutes
   for no new signal).

**Exit:** a per-device table of engine frame cost vs sprite count that is not entangled with
Pan Tvardowski's content.

### P4 — Web bench (3 days) — currently a total blank

The engine is positioned as web + React Native. Web has zero numbers.

1. Create `apps/bench-web` — CanvasKit, the **same scenario definitions** as P3 so native and
   web are directly comparable. Shared scenario module, two runners.
2. Timing via `requestAnimationFrame` deltas; report p50/p95/p99 frame time.
3. Headless run under Playwright for repeatability; real-browser matrix via TestingBot's
   browser grid (confirm the plan tier covers real-device browsers before relying on it).
4. Also capture the cheap, honest, high-value numbers that need no GPU at all:
   - CanvasKit WASM bundle bytes, default vs full build, raw and gzipped
   - cold start to first rendered frame
   - the same over a throttled 4G profile
5. Wire the results into the same ndjson + dashboard.

**Exit:** `benchmarks.md` has a Web section, and the freeze-window browser matrix gains a
frame-rate bar instead of only "it renders".

### P5 — Publish and gate the release (1 day)

1. Regenerate `benchmarks.md` with all four tracks; deploy `apps/bench-dashboard` (it already
   builds to static `out/`).
2. Write a root `PERFORMANCE.md` stating methodology **and what is not measured** — iOS,
   any device not in the matrix, and any claim without a capture date.
3. Add a **Perf gate** section to `docs/plans/flip-runbook.md`. It currently has none.

---

## 6. Proposed release gate (new, for the flip runbook)

No `0.3.0` freeze without:

- [ ] Track A counters green in CI, thresholds committed in `.perf-baseline.json`
- [ ] Microbench re-run within 7 days of the freeze commit, committed with variance bands
- [ ] Engine-level device numbers on ≥2 Android devices, captured within 14 days
- [ ] Web numbers on ≥1 desktop + ≥1 mobile browser
- [ ] Every number in `README.md`, `benchmarks.md`, and `PERFORMANCE.md` carries a capture date
- [ ] No number older than the most recent commit to the path it measures
- [ ] `PERFORMANCE.md` names every unmeasured surface, iOS first

The last two are the ones that would have caught this audit's finding in June.

---

## 7. Cost and sequencing

| Item | Cost |
|---|---|
| TestingBot PAYG | ~€0.06/min, projected ~€11/mo at the planned cadence |
| Apple Developer Program (iOS numbers) | $99/yr — the only hard blocker for B10 |
| Real Android device (owned) | €0 |
| Everything else | time only |

Roughly 10 weeks to the October 5 freeze. Effort is ~10.5 working days.

**Order by value density:**

1. **P0** — half a day, removes a live liability. Do it this week regardless of the rest.
2. **P1** — makes every future number mean something. Nothing downstream is worth doing first.
3. **P2** — the only phase that stops this recurring.
4. **P4 (web)** before **P3 (device)**, against instinct: web is a total blank and the engine is
   marketed as web + RN, whereas device already has *some* data and a working harness. Web also
   needs no device minutes and no Apple account.
5. **P3** — the biggest single win for credibility, and the one that answers the standing
   r/reactnative and LinkedIn questions with data.

If time runs short, P0 + P1 + P2 is a defensible release: current numbers, honest scope
labels, and a gate that keeps them current. P3 and P4 can land as `0.3.x` follow-ups **provided**
`PERFORMANCE.md` says plainly that device and web are unmeasured — which is exactly what the
2026-07-27 devlog already told readers.

---

## 8. What this plan deliberately does not do

- **Does not chase absolute-time gating in GitHub CI.** Shared runners cannot support it.
- **Does not treat PT numbers as engine numbers.** They stay, labelled as a showcase datapoint.
- **Does not promise iOS.** It is $99/yr and a credential dance; it is listed, not scheduled.
- **Does not retro-edit published blog posts.** Corrections of record, per repo convention.
