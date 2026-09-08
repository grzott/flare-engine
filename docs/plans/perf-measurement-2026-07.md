# Perf Measurement Plan — 2026-07-28

> Scope: `flare-engine` + `Pan-Tvardowski`. Goal: real, current, automated performance
> numbers before the October 2026 open-source flip. Audit performed 2026-07-28 against
> working trees at `flare-engine@a3e4a64` and `Pan-Tvardowski@e0f35f5`. Every number below
> was re-derived this session, not read from a doc.
>
> **Second pass 2026-07-28 (18-agent adversarial audit):** §9 verifies and corrects §1–§8,
> §10 adds findings B11–B26, §11 row-ifies execution. **Rows live in `todo.md` Arc PERF;
> builders read the row's §11 spec.** §1–§8 stay as the first-pass record; where §9
> corrects them, §9 wins.

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
| **B6** | ~~**Web is entirely unmeasured.**~~ **CLOSED 2026-08-16/18 (PERF-6 + PERF-13).** Three folded lanes now published — CPU-raster, desktop GPU (ANGLE/D3D11), on-device Android (Pixel 7) — plus WASM payload bytes and cold start. Original finding: `packages/render-web` has 4 test files and zero benchmarks. `canvaskit-parity.md` flagged "`drawAtlas` WebGL performance may differ — benchmark in the stage 11.1 spike"; that spike never produced numbers | `docs/references/canvaskit-parity.md:11` |
| **B7** | ~~**No gate anywhere.**~~ **CLOSED 2026-07-29 (PERF-5).** ci.yml and release.yml both run `check:perf` + `check:perf-bytes` + `check:perf-freshness`; verify.sh runs the counter half on engine/mixed rows; flip-runbook and manual-test-protocol each reference the H1 perf gate | ci.yml, release.yml, verify.sh |
| **B8** | ~~**`.perf-baseline.json` is `{}`**~~ **CLOSED 2026-07-29 (PERF-5).** Populated: 11 counter rows + 41 byte ceilings. An empty `counters` or `bundleBytes` block is now an explicit failure, so it cannot silently return to `{}` | .perf-baseline.json |
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

### P4 — Web bench (3 days) — **DELIVERED 2026-08-16/18 (PERF-6, PERF-13)**

The engine is positioned as web + React Native, and web had zero numbers when this was written. Three
lanes now exist; see `docs/references/benchmarks.md` § Web (CanvasKit). Original scope below.

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

## 6. Release gate — HOMED (2026-07-29, PERF-5)

This section proposed the gate. It now **lives** in
[road-to-oss-2026-09.md](road-to-oss-2026-09.md) §11 / OSS-H1, "Perf gate (single source)", and is
not restated here: the freeze checklist is the thing people actually read at freeze time, and a
gate that exists in a planning doc is a gate nobody runs. `flip-runbook.md` and
`manual-test-protocol.md` each carry one reference checkbox pointing at that block.

The two items that would have caught this audit's finding in June — "no number older than the most
recent commit to the path it measures", and dated numbers everywhere — are the ones with
mechanical checkers now: `check:perf-freshness` (this file, §11.5) and the generator's
`Captured:`/`Rendered:` split (§11.1). The remaining device/web items are dated-or-declared,
pending PERF-6/PERF-7.

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
labels, and a gate that keeps them current. P3 and P4 can land as `0.4.x` follow-ups **provided**
`PERFORMANCE.md` says plainly that device and web are unmeasured — which is exactly what the
2026-07-27 devlog already told readers.

---

## 8. What this plan deliberately does not do

- **Does not chase absolute-time gating in GitHub CI.** Shared runners cannot support it.
- **Does not treat PT numbers as engine numbers.** They stay, labelled as a showcase datapoint.
- **Does not promise iOS.** It is $99/yr and a credential dance; it is listed, not scheduled.
- **Does not retro-edit published blog posts.** Corrections of record, per repo convention.

---

## 9. Second-pass verification — 2026-07-28, 18-agent adversarial audit

Every §1–§2 claim re-verified against both working trees, including one full live bench
re-run (Bun 1.3.11, win32 x64, 115 s wall, rc 0, tree restored clean). New blocker/major
findings were each independently refutation-tested; everything below survived.

| §1–§8 claim | Verdict | What changed |
|---|---|---|
| Render ~3.1× regression, ECS control flat | **CONFIRMED live** | Fresh medians 8.35 / 39.77 / 75.47 / 52.67 / 108.60 µs = 2.67–3.11× vs the committed Apr-16 baseline; `ecs.step 1000` at 1.01×. 4 of 5 render rows within 5% of the §1 medians. |
| §1 secondary drift table (particles 1.18× / physics 1.37× / integration 1.38×) | **WITHDRAWN** | Re-runs swing these suites up to ±35% same-machine (particles 0.99–1.01×, physics 0.88×, integration 0.92–1.34× across runs). Load artifacts, not regressions. Root cause is B16. |
| "±8% run-to-run spread" | **PARTIAL** | Holds for render + ecs only. No single-run gate under 1.4× is honest for physics/particles/integration until B16 is fixed. |
| B1 no-op drawAtlas | **CONFIRMED, worse** | The bench never constructs `createFrameRenderer` at all — `fillXforms` (frame-renderer.ts:402) is unreachable *regardless of the callback body*. P1.1's "counting stub that forces fillXforms" is **refuted as written**; the fix is driving the real frame-renderer with a counting Skia stub module (§11.4). Same hole in `integration.bench.ts:92` (§1 omitted this). |
| B2 heap noise | **REFRAMED** | The sign-flip is in-process contamination (the heap section runs after ~90 s of suite garbage, index.ts:316-317). Isolated subprocess-per-scenario runs are stable to ±0.2% and always positive: **+15.7 / +33.4 / +31.1 KB per frame** at 500/1000/2000 entities — a real retained-growth signal against the zero-alloc claim (B26), hidden by its own harness. |
| B3 nightly failure | **CONFIRMED; root cause reattributed** | Live gh-run logs: the same 06-10 APK passed 3 scenarios on 06-13, then everything failed in seconds from 03:18 UTC with empty reasons and unsyncable artifacts — the signature of a TestingBot account/service cutover, **not** a stale APK. P3's "cut a fresh APK" revive step inherits the wrong fix (B21). |
| B5, B6, B7, B8, B10 | **CONFIRMED** | As written. (Citation nit: the B6 quote lives at canvaskit-parity.md:9, not :11.) |
| B9 dead fork | **CONFIRMED, stronger** | The engine copy cannot run even *manually* (bench-cloud.sh:46,:78 target nonexistent `apps/pan-tvardowski`); engine ndjson is a byte-identical 32-row prefix of PT's 74; PT's fork has three real divergences the engine copy lacks (absolute-p95-ceiling gate `6eb6d80`, standalone-layout detection, updated protocol). Hard delete; P3 lifts from PT HEAD only. |
| §2 "5 suites, ~60 s" | corrected | 115 s measured; the "~60s" string is also baked into the generator (index.ts:120). P0's 5× protocol is ~10 min. |
| §7 "~€11/mo" | corrected | That figure comes from the stale engine fork. PT's living protocol.md: 216 min ≈ **€13/mo**; actual spend ≈ €0 while the cron is paused. This audit fell into the B9 trap it documents — future perf docs cite repo-qualified paths. |
| §6 gate home | **MOVED** | flip-runbook fires two weeks *after* the freeze it would gate; freeze authority is road-to-oss-2026-09.md §11 (OSS-H1). §6 as written also contradicted road-to-oss §13 (web numbers scheduled post-flip) and this plan's own §7 fallback. Resolution: §11.5 item 6. |
| P0.5 "repo convention: no retro-edit" | unrecorded | The convention exists nowhere in this repo (grep hits only this plan). §11.2 has the owner write it down in the portfolio repo first. |

## 10. New findings — B11–B26

| # | Sev | Finding | Evidence |
|---|---|---|---|
| **B11** | blocker | **Bench code executes in NO gate.** No `test` script in benchmarks/package.json → turbo test, CI, and verify.sh all skip it; root tsconfig excludes benchmarks/. Only biome + per-package `tsc --noEmit` see it — bench *bodies* never run under automation. This is the mechanism that let §1 rot ship silently. | benchmarks/package.json:8-15, turbo.json:9-11, tsconfig.json:9 |
| **B12** | major | **Every invocation overwrites the tracked baseline.** `bench`, `bench:json`, and even `bench:md` rewrite results/microbench.json with a fresh timestamp; no history, no append, no explicit-baseline mode. The first P0 run destroys the April forensic capture (git-recoverable only). | index.ts:319-325, results.ts:85-91 |
| **B13** | major | **`--from-cache` forges freshness**: stamps `new Date()` + current machine over cached numbers; cached.generated/runtime/platform are never read. Already fired once — benchmarks.md says "Generated: 2026-04-22" over the 04-16 capture. | index.ts:112-114, :282-313 |
| **B14** | major | **Zero provenance.** No CPU model, cores, RAM, hostname, git SHA, or dirty flag in any output; two machines produce byte-identically-labelled reports; §6's "no number older than the path's last commit" is unimplementable against this schema. | results.ts:30-36, index.ts:272-273 |
| **B15** | major | **bench:md truncates the published doc at spawn** (shell `>`), and markdown prints only at the very end of a ~2 min run; the baseline is written *before* the markdown. Any unattended crash leaves a 0-byte tracked benchmarks.md plus an already-overwritten baseline. | benchmarks/package.json:10-11, index.ts:264,:319-329 |
| **B16** | major | **Physics/integration workloads are non-stationary**: positions integrate unbounded (up to ±5,500 px drift vs a 2,000 px seed box over the sample window); "dense" decays to sparse mid-run; medians depend on sampler config. Explains the withdrawn secondary table. | physics.bench.ts:15,:29-39 |
| **B17** | major | **Multi-atlas rows measure degenerate run-length-1 grouping** (`images[i % uniqueTextures]` breaks the batch run on every adjacent sprite); the alpha/rotation/stretch batch-key fields — the three post-April features — are never varied. "Batching actually batches" is never exercised. | render.bench.ts:37-48, sprite-batch.ts:195-201 |
| **B18** | major | **Nothing forces a build before benching.** benchmarks resolves `@flare-engine/*` to dist/; there is no turbo `bench` task, no `dependsOn ^build`. Un-built invocations — including P0's protocol as written — silently measure stale code. | benchmarks/package.json deps, turbo.json |
| **B19** | ~~major~~ **CLOSED 2026-07-29 (PERF-5)** | **release.yml runs a parallel gate subset** — a ci.yml-only perf gate cannot block a publish. Every perf gate lands in *both* workflows, plus verify.sh *after* build, engine/mixed scope only (test runs before build there; game scope skips build). **Done as specified**, minus `check:perf-bytes` in verify.sh (~69 s to pack 41 packages; CI and release both run it). | release.yml, verify.sh |
| **B20** | major | **PT harness fails-green class** to fix before the P3 lift: regression-check exits 0 on zero rows; a >7-day gap resets the baseline to current (weekly cadence self-pins to ratio 1.0 — window must be ≥4× cadence or last-N-runs); no device×scenario×metric matrix validation; the 5% ratio gate has no absolute floor (its only real firing was 5 "regressions" on µs-scale noise, itself masked); zero-combo runs exit green; scenario ids live in three divergent namespaces (dispatch enum ≠ flow stems ≠ ndjson); debug artifacts were never uploaded (path outside workspace + `if-no-files-found: warn`). | PT regression-check.ts:32,:136; bench-cloud.sh:311-336; perf-bench.yml:43 |
| **B21** | major | **B3 revive protocol reordered** (root cause reattributed, §9): verify TestingBot account/plan/device-catalog names FIRST → fix artifact upload so the next failure leaves evidence → one single-device `workflow_dispatch` → only then fresh APK at HEAD → weekly cron with staleness gate, never `continue-on-error`. | PT perf-bench.yml:13-29 + gh run logs |
| **B22** | ~~major~~ **ADDRESSED 2026-07-30 (PERF-8)** | **results/device.json is a third stale published surface** (generated 2026-04-22, one Galaxy A54 entry) rendered by the dashboard /device route; its documented refresh pipeline (triple-tap + "BENCH FPS CSV" logcat markers) no longer exists anywhere in PT. §1–§8 never mention it. | device.json:2, dashboard README.md:39-52 |
| **B23** | major | **`createBenchSession` has zero consumers** in benchmarks/ or PT while api-specs ships it as "the backbone for deterministic bench scenarios"; P3 "reuse bench-mode.ts" would hand-roll seeding a third time (PT uses its own mulberry32; benchmarks uses SeededRNG directly). Consolidate or correct api-specs before the flip. | packages/testing/src/bench-session.ts:25, api-specs.md:434 |
| **B24** | ~~blocker~~ **CLOSED 2026-07-29 (PERF-5)** | **§6's freshness items had no mechanical checker in any phase** — pull-not-push reapplied to the gate itself. The keystone control is `check:perf-freshness` in PR CI (the only runner that provably always runs): fail when a suite's capture date predates the newest commit under the packages it measures. Same liveness-canary pattern as `check:readme`. **Shipped comparing reachability rather than dates** — `git log <capture-sha>..HEAD -- <measured paths>` (§11.5). | check-perf-freshness.mjs |
| **B25** | ~~major~~ **CLOSED 2026-07-30 (PERF-8)** | **Dashboard fails-green class**: unchecked `as T` cast + hand-duplicated types (dead `@flare-engine/benchmarks` dep); headline substring match → `return null` (schema drift renders NaN or silently drops cards while CI stays green); /integration undated and renders B2 noise with good/bad colors; no staleness logic anywhere; deploy target is dead infra (README: GH Pages beside nonexistent `apps/site` via the removed `next export`); basePath/absolute-nav/root-escaping-link deploy blockers. | data.ts:6-11, page.tsx:41,:74, integration/page.tsx:29-31, README.md:58 |
| **B26** | ~~lead~~ **WITHDRAWN 2026-07-29** | **Not a zero-alloc violation — a warm-up artifact.** The reported +15.7–33.4 KB/frame was measured after a 30-frame warm-up and one forced GC, which snapshots the heap *below* the plateau its allocation rate implies; the climb to that plateau was then divided by the frame count and published as retained growth. Re-measured with a 2000-frame warm-up (PERF-4a, two independent probes): −0.2 to +2.5 KB/frame, and every structural invariant flat across 2000 frames — `SpriteBatch.allocCount` frozen at N after frame 1, `ParticlePool.created` 0, broadphase size constant. Under JSC `heapUsed` reports MarkedSpace *footprint*, never live bytes, so it cannot carry a retention claim at all; the exact counters now do (§11.4a). **Real finding underneath:** the plateau's height is driven by `CollisionWorld`'s reused pair-`Set` — see B27. | re-measured 2026-07-29, PERF-4a |
| **B27** | major | **`CollisionWorld`'s "no per-frame allocation" pair buffers are inverted under JSC.** `pairBufA`/`pairBufB` swapped with `clear()` + refill (collision-world.ts:56-60,:133-135) hold ~49 MB heap / ~227 MB RSS after 2500 frames × 564 keys, versus ~1 MB / ~177 MB for a fresh `new Set()` per frame and 0.3 MB for a reused array — the reuse costs ~38× the footprint it was written to save. Two smaller siblings in the same loop: `SpatialIndex.update` does `entries.find(closure)` per entity per frame (spatial-index.ts:49-51 — a closure allocation *and* O(n²) per frame on top of the brute-force broadphase), and `for (const [a, b] of this.entries)` (collision-world.ts:137) materialises a 2-element array per entity per frame while `CollisionEntry` already carries `.entity`. Measured under Bun/JSC only — **verify on Hermes before changing engine code**, since RN is the primary target. Row: §11.9. | measured 2026-07-29, PERF-4a probes |
| **B28** | ~~major~~ **CLOSED 2026-07-29 (PERF-10)** | **The `typeof __DEV__` guard costs ~270 ns per evaluation wherever `__DEV__` is undeclared** — JSC has no inline cache for an unresolvable global identifier. Measured on this machine, 1e6 evaluations: undeclared **272.5 ns**, declared-false **0.7 ns**, declared-true **1.2 ns**, and a `globalThis` property read of an *absent* property **0.46 ns**. PERF-3 put that expression inside `fillXforms` (frame-renderer.ts:413,:429), i.e. once per sprite per transform pass — 9x that under an outline effect — and `Pool.release` (pool.ts:78) has had it once per released object since before this arc. React Native always defines `__DEV__`, so RN builds are unaffected; **web/CanvasKit bundles and any Node/Bun consumer are not**, unless their bundler defines it. Cost there: ~0.27 ms/frame at 1000 sprites, ~2.4 ms under outline. It also inflated this arc's own first re-capture ~7x until PERF-4a pinned the flag. Fix is a `globalThis` property read — equally toggleable at runtime, ~400x cheaper when absent. **Done:** `fillXforms` and `Pool.release()` converted; undeclared-configuration cost fell from 412–450 µs to 56–88 µs on `render.flush 1000 / 1 atlas`, matching the declared configuration (§11.10). | measured 2026-07-29, PERF-4a |
| **B29** | ~~major~~ **CLOSED 2026-07-29 (PERF-11)** | **The harness cannot tell a quiet capture from a contended one.** Provenance records `cpuModel`/`cpuCount`/`totalMemMB`/`gitSha`/`gitDirty` but nothing about machine LOAD, and nothing in the capture path refuses or flags a busy machine. Demonstrated 2026-07-29: two consecutive 5-run captures taken while eight residual agent processes were resident read `integration.frame 1000` at 10.54 ms and 9.7 ms against 12.5 ms an hour earlier, with `render.flush` ~10% high and the `ecs.step` control row displaced — across a commit whose only executable change was one `lines.push` in the markdown generator. Both captures were discarded by hand; a third, on a quiet machine, returned to 12.63 ms (12.55–12.88). **The only thing that caught it was a human reading the control row**, which is the same pull-not-push failure mode as B24. Options: sample load at capture start and refuse above a threshold; record it in provenance so promote can refuse a mixed window; or assert the control row against a committed expectation. Not pre-freeze-blocking, but it undermines every number the arc publishes. **Done:** foreign CPU load is measured around the timed suites and recorded in provenance; `promote` refuses a run above 15% foreign load, a run with no load record at all, and a window whose runs disagree by more than 20% — the last pinned against this incident's real recorded medians. §11.11. | measured 2026-07-29, PERF-5/10 review round |

---

## 11. Execution rows — Arc PERF (todo.md points here)

§5's phases remain the design rationale; this section is the row-ified execution order with
§9–§10 folded in. Routing: **PERF-3, PERF-9 and PERF-10 = engine-builder** (`packages/**`, minor
changeset each); all other rows **[MT]** main-thread. **PERF-1→5 are the pre-freeze must** (the §7
"defensible release" core plus gates); PERF-8 is cheap and pre-freeze-preferred; PERF-6/7
slide post-flip if the calendar tightens, with PERFORMANCE.md declaring the blank (§8).
Owner-OOB items are ledgered per row, never blocking. Changesets: only PERF-3 and PERF-9
touch `packages/*/src` → one lockstep minor each; other rows need none.

### §11.1 PERF-1 — bench harness automation-hardening + dead-fork delete [MT]

Kills B11, B12, B13, B14, B15, B18, B9. Files: turbo.json, root package.json,
benchmarks/{package.json,src/index.ts,src/results.ts,src/harness.ts}, delete
scripts/perf/* (5 files) + docs/perf/* (3 files) + the .gitignore:39-44 block, one pointer
line in docs/plans/engine-deep-audit-2026-07.md:77.

1. Turbo `bench` task `{dependsOn:["^build"],cache:false}`; root `bench` script → `turbo bench` (B18).
2. benchmarks `test` script: smoke-run every suite (samples=2, innerIters=1), assert finite
   stats + a frozen scenario-name fixture (a headline scenario `findResult` returning null
   exits non-zero — today a renamed scenario silently drops the row). Rides turbo test →
   CI + verify.sh execute bench bodies on every PR (B11).
3. Results lifecycle: append every run to results/history.ndjson; microbench.json updates
   only behind `--write-baseline`; bench:md is read-only by default (B12).
4. Provenance in MicrobenchReport + markdown header: cpuModel, cpuCount, totalMemMB,
   hostname, gitSha, gitDirty (B14). Separate `Captured:` from `Rendered:`; cache renders
   print the cached capture metadata and refuse caches older than a max age (B13).
5. Atomic in-script markdown write (temp + rename); drop the shell redirection (B15).
6. Generator hygiene: move the hardcoded "Decision — 2026-04-22" prose + stale numbers out
   of index.ts:247-261; the dead `../plans/build-plan.md` link goes with it; "~60s" strings
   → measured ~2 min.
7. Hard-delete the fork (verified zero executable references in either repo): the only perf
   harness greppable in this repo afterwards is the living one. Keep root
   .perf-baseline.json (PERF-5 populates it).

**Exit:** `turbo bench` builds then runs; CI executes bench bodies; a mid-run crash cannot
damage benchmarks.md or the baseline; every result row carries provenance.

### §11.2 PERF-2 — correct the record (P0) [MT + owner OOB]

Requires PERF-1 (fresh dist, provenance, `--write-baseline`). Files:
benchmarks/results/*, docs/references/benchmarks.md, packages/particles/README.md,
packages/physics/README.md.

1. 5× full captures (~10 min); commit the median via `--write-baseline` + min/max variance
   band; all five runs land in history.ndjson. Keep an ECS-style control row in every
   future capture — the §1 methodology that made the finding conclusive.
2. Regenerate benchmarks.md: per-table `Captured:` dates; a "what these do not measure"
   paragraph naming B1 (no transform path until PERF-4) and B17 (multi-atlas rows are the
   interleaved worst case); re-run or withdraw the render.sort rows; label the A54 device
   table + device.json as stale-2026-04-22 pending PERF-7 (B22).
3. Add capture context to the perf claims shipped in package READMEs
   (particles/README.md:3, physics/README.md:3 — tarball surfaces §1's blast radius missed).
4. Owner OOB ledger (cross-repo, not blocking): first record the no-retro-edit convention
   in the portfolio repo (it is folklore today, §9), then the three NUMBERS.md render rows,
   a POSTMORTEMS.md entry, corrections of record for the two posts, the OG image tile.

**Exit:** no engine-repo surface renders a pre-2026-07-28 render number without a capture
date; owner items ledgered.

### §11.3 PERF-3 — engine perf-observability counters (engine-builder, packages/**)

The small engine half Track A needs (§4 counters that have no observable surface today).
Files: packages/render/src/{sprite-batch.ts,renderer.ts,frame-renderer.ts},
packages/core/src/pool.ts, tests, api-specs.md. One lockstep minor changeset.

1. `SpriteBatch.allocCount` getter — increment at the `_acquire` miss site
   (sprite-batch.ts:247); cost only on miss.
2. Core `Pool.created` getter beside the factory-call sites (pool.ts:45,:58) — makes
   ParticlePool-internal allocation observable (its Pool is private, not injectable).
3. Rotated/unrotated branch counters in `fillXforms` (frame-renderer.ts:406): two
   module-level ints + reset/read, guarded by the proven `typeof __DEV__` runtime pattern
   (precedent pool.ts:37-39, survives to dist); add a dist-grep assertion that tsdown never
   compile-time-defines `__DEV__`.
4. Resolve the `stats.drawCalls` ≡ `stats.batchCount` aliasing (both increment at
   sprite-batch.ts:203-205,:219-221): document drawCalls as batch-runs or repoint it at
   real canvas calls; note outline fans one run into 9 canvas drawAtlas calls.

Zero-alloc law: pre-allocated integer increments only — established production practice
(`renderer.stats` already increments per run via game-view.tsx:179).

**Exit:** every §4 counter has an engine surface or a bench-side injection point; gate +
root tsc green.

### §11.4a PERF-4a — microbench honesty (P1 rework) [MT] — DONE 2026-07-29

Required PERF-3. Kills B1, B16, B17, B23; withdraws B26 and spawns B27/§11.9. Files:
benchmarks/src/** (+ `skia-stub.ts`, `heap-probe.ts`, `alloc.ts`), benchmarks/tests/**,
apps/bench-dashboard (p99 tolerance only), benchmarks/results/*, docs/references/benchmarks.md.

1. Render + integration benches drive the real pipeline: `createFrameRenderer(countingStub)`
   with `frameRenderer.drawAtlas` passed to `flush` — the only way `fillXforms` executes
   (§9: a flush callback can never reach it). **Measured effect: `render.flush 1000
   sprites / 1 atlas` is 486 µs, not 89 µs — 5.4× of what the old bench reported, and that
   5.4× was the unmeasured transform build.** The stub counts every DrawSurfaceLike method
   and, in strict mode (the gate; not the timed runs), throws on any member it does not
   know, so a future draw path breaks the gate loudly instead of shipping unmeasured. Its
   `set`/`setXYWH` write real fields — a no-op setter, which is what every pre-existing test
   stub uses, lets JSC eliminate the transform arithmetic as dead.
2. Scenario matrix: 15 flush rows + 3 sort rows. Sweep 100→5,000 × 1 atlas; 4- and 8-atlas
   in *both* interleaved (run length 1, worst case) and clustered (runs == atlas count)
   orders; rotated 0/50/100%; 4 alpha runs; tint / outline / stretch / zone-bg paths (B17).
3. Allocation: in-process heap-delta retired for an isolated subprocess per scenario that
   warms to the allocation plateau under a wall-clock budget and reports per-block deltas
   plus a convergence flag. The exact gate is 11 rows of integers — zero pool misses, zero
   particle-factory calls, zero cached Skia factory calls, and per-frame draw-call and
   transform-write counts predicted from the scenario (e.g. outline == 9 drawAtlas and 9N
   transform writes; 8-atlas interleaved == 1000 drawAtlas, clustered == 8). It runs in CI
   via `turbo test`, not only when a human types the bench command.
4. Harness: `max` always, p99 only at n≥100 samples (default samples 100; rows below the
   threshold publish `—` rather than the top sample under a percentile's name), warm-up by
   elapsed time (300 ms) instead of 3 fixed batches, per-row sample-window drift warning.
5. Physics + integration workloads wrap at the field edge; `outOfBoundsCount` asserts it in
   the smoke gate and aborts a capture from the heap probe (B16).
6. Seeding consolidated on `@flare-engine/testing` `createBenchSession` in all five suites,
   and the particle emitter's seed is now stated rather than inherited from its default of
   1 (B23 resolved by consolidation — api-specs.md:434 needs no amendment).
7. Schema v2 + fail-closed promotion: `maxNs`, optional `p99Ns`, `alloc[]`, `schemaVersion`;
   `--promote` refuses a mixed-schema window, refuses runs whose exact counters disagree,
   and only folds a p99 when every run has one.

8. **`__DEV__` is pinned to `false` for every capture** (benchmarks/src/dev-flag.ts) and
   recorded in the report's provenance; `--promote` and `--markdown` both refuse a capture
   taken with it undeclared. This is not hygiene — see B28: leaving it undeclared made the
   first re-capture read 486 µs on the headline render row instead of 57 µs.

**Instrument discontinuity — do not compare across it.** The post-4a render and integration
numbers are not comparable to any capture before 2026-07-29: the measured region gained the
whole transform path, the warm-up policy changed from 3 fixed batches to a 300 ms budget,
sampling went from 30 to 100 samples, and the workloads are now bounded. §1's April-vs-July
regression table stands as a record of the *old* instrument comparing against itself; the
new baseline starts a new series.

**Exit met:** the bench measures the transform path; every row carries variance; alloc
counts are exact integers; suites are machine-checked stationary.

### §11.4b PERF-4b — bench coverage extension (P1 remainder) [MT]

Requires PERF-4a. Extend coverage to per-frame paths that no bench touches today:
animation (`updateTweens` / `updateSpring` / `updateAnimator`), postfx (controller tick,
`chain.enabled()`, `runtime.buildPass` against a stub Skia module), tilemap
(`TilemapRenderer.drawInto` culled, `getTileAt`, gid decode), pathfinding (A* open, A*
maze, JPS), math (`Vec2` `*Into`, `Transform2D`, `Mat3`) — per-frame paths only (B5).
Each new suite needs: a `scenario-contract.ts` entry, a smoke-gate row, `innerIters` sized
to the 0.3–25 ms sample window, and workspace deps added to benchmarks/package.json.
Ends with a 5-run re-capture + `bench:promote` + `bench:md`, exactly as PERF-4a did.

**Exit:** every tier-2/3 package with a per-frame hot path has at least one bench row, and
the published doc names the ones that still do not.

### §11.5 PERF-5 — Track A gate + freshness canary + freeze-gate homing (P2) [MT] — DONE 2026-07-29

**Shipped.** `scripts/lib/perf-gate.mjs` (pure reconcilers + a selftest both CLIs run before they
trust a green), `scripts/lib/pack.mjs` (the `npm pack` + unbuilt-dist primitives, now shared with
audit-tarballs.mjs instead of duplicated), `scripts/check-perf.mjs`, `scripts/check-perf-freshness.mjs`,
a populated `.perf-baseline.json` (11 counter rows + 41 byte ceilings), and the wiring in ci.yml /
release.yml / verify.sh. B7, B8, B19, B24 closed.

**Two deviations from the spec below, both deliberate:**

1. **The canary compares reachability, not dates (item 4).** The spec said "capture timestamp older
   than the newest commit". It ships as `git log <capture-sha>..HEAD -- <measured paths>`, which is
   exact where a timestamp is a proxy: a sixty-day-old capture against untouched sources still
   describes HEAD, and a capture from this morning against a source edited since does not. Clock
   skew and rebases cannot fool it. Absolute age stays where it already was — `bench:md` refuses to
   render a doc from a baseline older than 30 days — rather than becoming a second copy of one
   policy number. The suite→package map lists only DIRECT imports and is expanded through the
   workspace dependency graph at run time, so `math` correctly stales every `render` row without
   anyone maintaining that edge by hand.
2. **Byte ceilings are a separate invocation (`check:perf-bytes`), in CI and release but not in
   verify.sh (items 2, 5).** Packing 41 packages costs ~69 s measured. Paying that on every local
   `/close` is how a gate gets commented out; CI runs it on every push and release.yml runs it
   again on the path that ships bytes, so nothing reaches consumers unweighed. The counter half
   (~2 s) does run in verify.sh.

**Verified non-vacuous by mutation, not by reading:** a drifted counter, an improved counter, an
emptied `counters` block (the exact `{}` state B8 describes), a baseline key with no scenario, a
suite with no freshness mapping, unmapped heap rows, an instrument change since the capture, a
package over its ceiling, a package with no ceiling, and all four review-guard states each produce
the intended red. That exercise found a real bug: `git status --porcelain` marks an unstaged edit
with a leading SPACE, and trimming the whole output ate the first character of the first path —
`.perf-baseline.json` arrived as `perf-baseline.json`, so the rubber-stamp guard was blind to the
one file it exists to watch. Fixed with an untrimmed line split plus `-uall`.

**Item 7 (Track B plumbing) is a recorded decision, built in PERF-7 — see §11.5b below.**

---

Original spec. Kills B7, B8, B19, B24. Files: scripts/check-perf.mjs, scripts/check-perf-freshness.mjs,
.perf-baseline.json, .github/workflows/{ci.yml,release.yml}, .claude/hooks/verify.sh,
docs/plans/road-to-oss-2026-09.md §11, docs/plans/flip-runbook.md,
docs/plans/manual-test-protocol.md.

1. `check:perf`: runs the counter scenarios (deterministic integers, no timing) and
   reconciles **fail-closed** against .perf-baseline.json — empty baseline fails, scenario
   without a key fails, key without a scenario fails, any mismatch in *either* direction
   fails (improvements must be committed too), ≥1 nonzero expected counter per scenario as
   a liveness floor. This is the B3 lesson encoded: absence and emptiness are red, never
   green.
2. Populate .perf-baseline.json: counters + per-package bundle-byte **ceilings** (~10%
   above current; ceiling not exact-equality — bytes change on every legitimate edit) via
   reuse of audit-tarballs.mjs's `npm pack` + pure-Node tar parse; keep its unbuilt-dist
   guard; warn when actual < 0.7× ceiling (stale-generous limit).
3. Baseline-edit guard: fail when a PR edits .perf-baseline.json alongside
   `packages/**/src` without a dated justification line — the rubber-stamp vector.
4. `check:perf-freshness` (B24, the keystone): per-suite capture timestamp in
   microbench.json older than the newest commit under the packages that suite measures →
   fail. Wired beside check:readme.
5. Wire **both** workflows (ci.yml after build; release.yml — B19) + verify.sh after the
   build gate, engine/mixed scope only.
6. Home the freeze perf gate in **road-to-oss-2026-09.md §11 (OSS-H1)** as the single
   source (§9): hard items = Track A green + baseline populated + microbench captured ≤7
   days pre-freeze with variance bands + freshness canary green; device/web items =
   dated-or-declared-unmeasured (consistent with §7's fallback and road-to-oss §13).
   flip-runbook and manual-test-protocol each get ONE reference checkbox — no restated
   items (mirror-row rule). Freeze-window rule: any commit-back perf cron pauses (or
   diverts to artifact-only) Oct 5–18 per H1 fix-only; resumes post-flip.
7. Track B plumbing decision recorded here, built in PERF-7: local scheduled script with
   commit-back using `[skip ci]` or a `perf-data` branch (a plain push fires ci.yml + —
   post-ENABLE_RELEASE — release.yml nightly; branch protection is a 403 on today's
   free-plan private repo and becomes available+desirable at the flip; a self-hosted
   runner on a public repo executes fork-PR code — unsafe post-flip unless fenced). The
   warn tier (1.10) **pushes**: create-or-update a pinned "perf drift" GitHub issue —
   dashboards are this plan's own documented rot surface.

**Exit:** a PR that adds a hot-path allocation, a draw call, or lets a capture go stale
fails CI; a publish cannot bypass any of it; the 0.3.0 freeze checklist contains the perf
gate by reference. **All three hold as of 2026-07-29.**

### §11.5c Review fixes — 2026-07-29 (36-agent adversarial pass over §11.5 + §11.10)

Six lenses → two independent verifiers per finding (one refuting, one required to construct a real
repro). 36 raised, 31 survived, collapsing to ~13 distinct defects — four lenses independently found
the same `freshness` fail-open, which is the strongest signal in the batch.

**Fail-open holes closed** (all in the gate this arc built, all the same shape as the B8 disease
one level up — the check still runs, still prints OK, and is watching nothing):

- `freshness.instrument` absent, empty, or written as a string silently disabled the instrument
  canary. An empty path list yields no paths, no paths yields no commits, and no commits reads as
  fresh. Now validated: non-empty array of strings, or red. Note the asymmetry that made this easy
  to miss — a *stringified* `suites` value already failed closed (`workspaceClosure` spreads a
  string to characters, all unknown), while the identical malformation of `instrument` failed open.
- A suite mapped to `[]` was permanently fresh, for the same reason. Now red.
- An unresolvable base ref turned the rubber-stamp guard into a no-op that still printed OK — a
  shallow clone (`fetch-depth: 1`, a tempting CI speed-up) was enough. Now red whenever the
  baseline or a package src is modified and no range can be resolved.
- `--write` rebuilt `counters` from whatever the bench produced, so deleting a scenario from
  `alloc.ts` and re-running it silently erased the baseline key — rewriting the evidence instead of
  failing on it, defeating reconcileCounters' own "a scenario cannot be retired by deleting it from
  the bench" guarantee. Now requires an explicit `--retire`.
- `COUNTER_FIELDS` was only checked one way: a counter the BENCH gains but the list does not name
  was never compared, never written, and never missed. Now red.
- **A selftest assertion was vacuous.** `'a mapping with no suite fails'` passed `suiteTitles: []`,
  which hit the early return three branches above the drift check it claimed to pin, and its needle
  matched the early-return string. Split into two real assertions plus four new ones for the
  validations above.

**The doc the canary exists to protect was not being checked.** `bench:md` is a separate command, so
a capture + promote that stopped short of it left `docs/references/benchmarks.md` showing the
previous commit's numbers with every gate green. The generator now stamps
`<!-- flare-capture: <sha> -->` into the page and the canary asserts it matches the baseline.

**Doc-truth fixes** — in an arc about honest numbers, these matter more than their size suggests:

- The generated methodology paragraph still described the removed `typeof` guard in the **present
  tense**, contradicting the PERF-10 caveat twelve lines below it in the same file. Both rewritten.
- **The ~270 ns figure is JSC-only** (Bun, Safari/WebKit) and had been published as applying to
  "plain Node" and web bundles generally — but Node and Chrome are V8, which was never measured.
  Corrected everywhere, with the unmeasured engines named.
- The caveat claimed 56-88 µs was "the band shown below" while the table showed 55.1 µs
  (54.9-56.1). Removed.
- `benchmarks/src/dev-flag.ts` documented the pre-PERF-10 engine in the present tense, with line
  anchors (`frame-renderer.ts:413,:429`) that had already rotted. Rewritten without line numbers.
- api-specs claimed every non-RN runtime "already" sets `globalThis.__DEV__` — if that were true,
  the undeclared configuration PERF-10 fixed could not exist.
- **The re-capture recipe was wrong in three places** (road-to-oss §11, the canary's own failure
  message, verify.sh): all said `bench:baseline` ×5, which is `--write-baseline` and overwrites the
  tracked baseline with a single-run capture on every one of the five runs. The correct recipe is
  plain `bench` ×5 (append-only history) then `bench:promote`.
- "`{}` for three months" was wrong and mis-attributed: the figure belongs to the stale-capture
  window (April–July), not to the baseline file's lifetime.

**Also:** `bun run release` now runs `check:perf` + `check:perf-freshness` itself. B19 was satisfied
only by workflow steps, but the owner runs that script by hand for the restricted publish, and the
invariant is "a publish cannot bypass the gate". The core dist canary now counts `typeof __DEV__`
occurrences (exactly one — the constructor's) rather than merely matching `.__DEV__` anywhere in the
bundle, which any other module could have satisfied while `release()` quietly reverted.

**Refuted, recorded so they are not re-raised:** 5 findings, including the claim that
`const G = globalThis` misbehaves under tsdown's CJS output (it does not — verified against both
emitted artefacts) and that the ceiling `{}`/typo case ungates a package (the shape guard at
perf-gate.mjs fires).

### §11.5b Track B plumbing — DECIDED 2026-07-29, built in PERF-7

Recorded here so PERF-7 executes a decision instead of re-opening one. Track B is wall-clock: it
is recorded and dashboarded, never hard-gated (§4).

**Runner: a local scheduled script that commits results back.** Not a self-hosted GitHub runner —
on a public repo that executes fork-PR code, which is unacceptable after the flip unless fenced,
and fencing it is more machinery than the signal is worth. Not a GitHub-hosted runner either: §4's
whole premise is that its ±50% swing makes the numbers unusable for comparison.

**Commit-back lands on a `perf-data` branch**, not on `main` with `[skip ci]`. A plain push to
main fires ci.yml, and once `vars.ENABLE_RELEASE` is true it fires release.yml too — a nightly bot
push would attempt a nightly release. `[skip ci]` suppresses that but is a one-line typo away from
not suppressing it. A separate branch cannot reach the release path at all. Branch protection on
`main` is a 403 on today's free-plan private repo and becomes both available and desirable at the
flip; the branch layout is chosen so neither state changes the answer.

**The warn tier pushes; it does not wait to be looked at.** At a 1.10 rolling-median ratio the
automation creates-or-updates a **pinned GitHub issue** titled "perf drift", with the scenario, the
ratio, and the commit range. Dashboards are this plan's own documented rot surface (B22: the
device dashboard read from a JSON nothing had written in months and nobody noticed) — a signal
whose only delivery mechanism is a page someone must remember to open is a signal that does not
exist. Fail tier stays at 1.25 and stays soft: it opens the issue and labels it, it does not fail a
build, because a wall-clock number on shared hardware must never be able to block a merge.

**Freeze-window interaction:** the cron pauses Oct 5–18 per the H1 rule in road-to-oss §11.

### §11.11 PERF-11 — capture-time load guard (B29) [MT] — DONE 2026-07-29

`benchmarks/src/load.ts` measures **foreign CPU load** — system-wide utilisation from `os.cpus()`
minus this process's own share from `process.cpuUsage()` — across the window in which the timed
suites run, and records it in provenance. The window excludes the heap probes deliberately: they
fork, and `process.cpuUsage()` cannot see a child, so spanning them would misreport our own work as
a noisy neighbour.

**Two independent refusals in `promote`, because neither subsumes the other:**

| Check | Catches | Misses |
|---|---|---|
| foreign load > 15% | the cause — a contended machine | a resident process that pollutes cache without burning CPU |
| ≥2 runs >10% from the folded median | the symptom, whatever the cause | a window that is internally tight but at the wrong level |

B29 produced one capture of each kind, which is why both exist. A run with **no** load record is
also refused: "unrecorded" is not "quiet", and every pre-PERF-11 capture is unrecorded.

**Both thresholds are calibrated against measurement, not chosen.** Foreign load on the reference
machine in ordinary working state (editor + agent session) read 4.36 / 4.38 / 4.51 / 5.43 percent
across four captures — the realistic floor is ~5%, not zero — so the ceiling sits at ~3× that. The
**Stated limit:** the load ceiling was calibrated from below only. The machine state that produced
B29 no longer exists and was never measured with this instrument, so the load threshold is *not*
validated against the real event — the stability threshold is, and the test suite pins it using the
actual recorded medians (9.16/9.91/10.54/11.97/12.78 ms) rather than a made-up spread.

**The stability criterion counts runs deviating from the FOLDED MEDIAN, not the min-max band — a
correction forced by the guard failing on healthy data the first time it ran for real.** The band
version refused a `particles.update 1000 emit+integrate` window reading
16.42 / 20.20 / 16.51 / 16.46 / 16.49 µs. Thirteen of that row's fifteen recorded runs sit inside
16.4-16.75: the row was sound and the check was not. **A median of per-run medians absorbs one
outlier in five by construction**, so refusing on a single one fails data the published number
already handles correctly, while two deviant runs mean the median is straddling two states. The
gate now has the same robustness as the statistic it guards.

**Replayed over every recorded capture window**, as validation in both directions: it refuses B29's
bad capture (3 of 5 runs deviant) and the `0b88096` PERF-2-era window (3 of 5 on
`render.flush 500`, consistent with that era's documented 76-124 µs swing), and accepts every clean
window — each of which has at most one deviant run.

The published doc now carries the foreign-load figure beside the CPU model, and states both ceilings
in "What these numbers do not measure".

**Exit:** a contended or unstable capture cannot become a published baseline without a human
deliberately overriding, rather than a human happening to read the control row.

### §11.6 PERF-6 — web bench (P4) [MT, 2 sessions]

Runs before native, per §7. Files: benchmarks/src/scenarios/ (shared scenario SoT),
apps/bench-web/**, scripts/check-deps-tiers.mjs LAYER_MAP, .changeset/config.json,
apps/bench-dashboard/app/lib/data.ts (type import).

1. Scenario SoT: shared scenario definitions live in the **benchmarks workspace**
   (`@flare-engine/benchmarks` — already private:true + changeset-ignored), exported via
   package exports and consumed by benchmarks/, bench-web, and later bench-native. Add it
   to check-deps LAYER_MAP *before* the first CI run (unmapped scoped package =
   hard error). The dashboard's dead dep on it becomes live (also fixes the Turbopack NFT
   whole-project-trace warning by importing results via the package export instead of
   `readFileSync(resolve(cwd(), rel))`).
2. `apps/bench-web`: CanvasKit runner over the same scenarios; rAF-delta p50/p95/p99;
   Playwright headless for repeatability. **Double-lock in the first commit**:
   private:true + .changeset ignore (bench-dashboard is single-locked today — don't repeat
   that). Owner-OOB: confirm the TestingBot plan tier covers real-browser devices before
   scheduling the browser matrix.
3. The no-GPU numbers: CanvasKit WASM bytes (default vs full, raw + gzip), cold start to
   first rendered frame, same over a throttled 4G profile.
4. Results append to history.ndjson with the full provenance schema
   `{commit, host, runtime, appVersion, unit}`; dashboard gains a Web section (or defers
   to PERF-8).

**Exit:** benchmarks.md has a dated Web section; the freeze-window browser matrix gains a
frame bar.

### §11.7 PERF-7 — native bench app + device-lane revival (P3) [MT + owner OOB, 2 sessions]

Kills B4, B20, B21, B22. Files: apps/bench-native/**, .github/workflows/perf-bench.yml
(engine repo, new), engine copies of devices.json/regression-check lifted from **PT HEAD**,
apps/bench-dashboard device reader, docs/plans/todo.md (parked particle-storm gate).

1. `apps/bench-native` (minimal Expo, double-locked): engine scenarios from the shared
   module — sprite sweep, rotated fractions, postfx chain depth 0/1/3, particle sweep,
   texture-eviction-after-backgrounding + resume-from-background (the public r/reactnative
   commitments), native cold start.
2. Lift from PT HEAD only (the engine fork is deleted and was behind): includes the
   absolute-p95-ceiling gate. Apply the B20 hardening before first use: expected
   device×scenario×metric matrix validation (missing tuple = fail); staleness gate (newest
   row older than 2× cadence = fail); zero-combo runs exit non-zero; absolute-delta floor
   on the ratio gate; ONE scenario-id namespace with a contract test (dispatch enum ==
   flow stems == ndjson values); fixed artifact upload path. Rolling window ≥4× cadence
   (≥35 days at weekly) or last-N-runs, plus a frozen per-release anchor threshold so the
   rolling median cannot ratchet accepted regressions in silently.
3. Replicate PT's exfil contract (BENCH_DONE RN Text sentinel outside the Skia canvas,
   `'[perf-bench] ' + JSON` payload, copyTextFrom extraction); cut the PT couplings: appId,
   `pantvardowski://` scheme, the locale-coupled "Play" readiness wait (use a testID).
4. Revive per **B21 order**: TestingBot account/plan/device-catalog verification FIRST →
   artifact-path fix → one single-device `workflow_dispatch` → fresh APK at HEAD → weekly
   cron, no `continue-on-error`, staleness gate on.
5. Bridge device data to the dashboard (ndjson → device schema or a new reader) and delete
   the dead device.json hand-append pipeline + its README instructions (B22).
6. Rewrite todo.md's parked particle-storm gate against the new weekly lane — its
   S9(b)/7-day premise is unsatisfiable as parked.
7. Owner OOB: EAS project for bench-native; engine-repo TESTINGBOT_KEY/SECRET +
   BENCH_APK_URL; TestingBot account/credits; iOS stays parked ($99/yr, listed not
   scheduled).

**Exit:** a per-device engine frame-cost table free of PT content; a silent zero-row week
turns the lane red.

### §11.8 PERF-8 — publish: dashboard hardening + PERFORMANCE.md (P5) [MT] — DONE 2026-07-30

**Shipped.** New `apps/bench-dashboard/app/lib/schema.ts` (validating parser that THROWS),
`app/components/CaptureBanner.tsx`, root `PERFORMANCE.md`, a scoped turbo task, and a rewritten
dashboard README. B25 closed.

**The dashboard can no longer fail green.** It parsed `JSON.parse(...) as T` and indexed into
whatever came back, so schema drift rendered `NaN`, and a headline lookup that missed returned
`null` and silently dropped the card — a quarter of the overview page could vanish and the result
looked deliberate. Every field is now validated and every failure throws. Because this is a static
export, a throw is a **failed build**, not a broken page served to a reader. Verified by mutation,
each against a real `next build`:

| Planted defect | Result |
|---|---|
| `schemaVersion` bumped to 3 | refused, naming both versions |
| headline scenario renamed | refused, listing every available scenario |
| heap row missing `resolutionBytesPerFrame` | refused, naming the row and field |
| `DEPLOY=1` + 210-day-old capture | refused |
| same stale capture, no `DEPLOY` | builds (local exploration still works) |
| fresh capture + `DEPLOY=1` | builds |

**`DEPLOY=1` was silently inert until turbo declared it** — the same strict-env-mode trap that made
`FLARE_BENCH_ALLOW_STALE` unreachable in PERF-1. The mutation pass is the only reason it was caught:
the assert was written, looked correct, and did nothing. It is now declared on the scoped task,
which also lists `benchmarks/results/*.json` as inputs so a cache hit cannot redeploy stale HTML
over a fresh capture.

**Staleness is on every page**, not just the overview: capture date, commit, runs folded, `__DEV__`
state, machine, foreign load, and the age in days — amber past 14, red past 30. The device page gets
its own permanent red banner, because its data is not merely old but **unrefreshable** (B22): the
pipeline that produced it no longer exists, which is a different statement from "stale" and needed
saying differently.

**Heap section reworked** to the PERF-4a schema. The old table drew a red or green bar sized by the
raw delta, colouring GC-scheduling noise as an allocation regression (B2). It now shows warm-up
frames, the per-frame delta rendered as `< ±N B` when it is under the instrument's own resolution,
that resolution as its own column, the plateau, and convergence.

**Deploy target: decided as NONE, deliberately.** The recorded target was GitHub Pages "alongside
`apps/site`" via `next export` — `apps/site` has never existed in this repository and `next export`
was removed from Next several majors ago. It described infrastructure that was never built. The
dashboard is a local tool; the quotable numbers live in `docs/references/benchmarks.md` and
`PERFORMANCE.md`, both behind CI gates. Standing up a publishing surface with no gate behind it,
five weeks before a freeze, would add the exact problem this arc exists to remove. The pieces for a
future deploy are in place and what is still missing (`basePath`, a redeploy trigger) is written
down. **Owner may overrule — this is a judgement call, not a technical constraint.**

**Root `PERFORMANCE.md`** leads with what is NOT measured, iOS first: never measured on any iOS
device, ever; web/CanvasKit never benchmarked; the Android capture stale and unrefreshable; eleven
packages with per-frame hot paths and no coverage at all; no cold-start, memory-ceiling, GC-pause or
multi-core numbers anywhere. Three claims in its first draft were corrected against the data before
it shipped — the iOS device-matrix detail (that matrix moved to another repository), the device
capture date (2026-04-22 in this repo, not PT's 2026-06-12 last row), and the coverage count.

**No re-capture needed:** the row touches no measured source, so `check:perf-freshness` stayed green
throughout — the first row in this arc where that was true.

---

Original spec.

Kills B25. Files: apps/bench-dashboard/**, PERFORMANCE.md (new, root), turbo.json
(dashboard build inputs), docs/references/benchmarks.md.

1. Dashboard: `generated` + staleness banner (amber >14 d, red >30 d) on every page
   including /integration; a `DEPLOY=1` build-time assertion that fails the deploy on
   stale data; schema guard replacing the `as T` cast and the null-dropping headline
   substring match (throw, don't skip); heap section reworked to the PERF-4 alloc schema;
   benchmarks/results/*.json added to the dashboard's turbo build inputs (a cache hit must
   not redeploy stale HTML over fresh data).
2. Deploy: decide + wire the real target (flare-engine-page static assets or GH Pages —
   the README's recorded target is dead infra), with basePath/relative-nav fixes and the
   root-escaping ../../docs link replaced; a redeploy workflow triggered by result-JSON
   changes; fix README.md:39-58's dead instructions.
3. Root `PERFORMANCE.md`: methodology, provenance requirements, variance bands, and what
   is NOT measured — iOS first, then anything the matrix lacks.
4. Regenerate benchmarks.md with all landed tracks.

**Exit:** the dashboard cannot publish a stale or schema-drifted number; PERFORMANCE.md
names every unmeasured surface.

### §11.10 PERF-10 — hot-loop `__DEV__` guard (B28) — DONE 2026-07-29

**Shipped.** Two hot sites read `globalThis.__DEV__` as a property instead of evaluating the bare
identifier: `fillXforms` (frame-renderer.ts, once per sprite per transform pass) and
`Pool.release()` (pool.ts, once per released object). The `Pool` constructor keeps the identifier
form as specified. One lockstep minor changeset (core + render).

**Measured, before and after, on the PERF-4a bench** — `render.flush 1000 sprites / 1 atlas`,
median of 41 samples × 20 inner iterations after a 3000-frame warm-up:

| `__DEV__` | before | after |
|---|---:|---:|
| undeclared | 412–450 µs | 56–88 µs |
| declared `false` | 56–88 µs | 55–88 µs |
| declared `true` | 59 µs | 57 µs |

The 56/88 µs split is bimodal on this machine and appears in **both** configurations — one
interleaved pair came out `undeclared 55.9` / `declared-false 87.9`, the reverse of its
neighbours — so it is JIT/thermal state, not residual guard cost. The exit criterion holds: the
undeclared configuration is no longer distinguishable from the declared one, where before it was
~7.4× worse.

**Published numbers do not move**, and the generated doc now says so in "What these numbers do not
measure": the bench pins `__DEV__ = false` (dev-flag.ts), so the table has always shown the cheap
configuration. The win belongs to consumers who never define the flag — web/CanvasKit, Node, Bun.
RN defines it always and is unaffected.

**Dist canaries, both mutation-verified** (reverted to the identifier form → 6 failures across the
two packages): render's existing canary was rewritten — it used to assert `typeof __DEV__` SURVIVES
tsdown (guarding against constant-folding), and now asserts the opposite, that the bare form never
returns and the read stays `.__DEV__`. A matching `pool-dist.test.ts` was added for core, which
had no dist assertion at all; it cannot assert the identifier is absent, because the constructor
legitimately keeps it.

**Deviation:** the guards stay TRUTHINESS checks (`if (G.__DEV__)`), not the `=== true` the spec
below suggests. `=== true` would silently disable the pool's double-release guard for a consumer
who set `__DEV__ = 1`; truthiness matches the old expression for every possible value, so the
mechanical rewrite stays behaviour-preserving. Perf is identical — both are one inline-cached load.

**Follow-up fix to PERF-5, found by using it:** `check:perf-freshness` compared committed history
only, so at `/close` — where the row's changes are still uncommitted — it reported FRESH for
exactly the edits about to invalidate the capture, and the red would only appear in CI after the
push. Fails-green in the one place a builder can still cheaply act on it. It now counts
uncommitted changes to measured paths as staleness (`scripts/lib/git.mjs`, shared with
check-perf.mjs). This row is the proof: it correctly reds all five suites.

---

Original spec.

The cheapest real win in this arc: a mechanical rewrite of one expression, measured at ~270 ns
per evaluation saved wherever `__DEV__` is undeclared. Not an RN issue (Metro always defines
it) — this is web/CanvasKit and any Node/Bun consumer. One lockstep minor changeset.

Files: packages/render/src/frame-renderer.ts (:413, :429 — per sprite per transform pass),
packages/core/src/pool.ts (:78 — per released object; :38 is construction-time and fine),
tests. Leave the non-hot sites alone (assets/sprite-sheet.ts warn path, scene-manager.ts
transitions, devtools/dev-mode.ts) — they are not worth the churn.

1. Replace `typeof __DEV__ !== 'undefined' && __DEV__` in the hot sites with a module-level
   `const G = globalThis as { __DEV__?: boolean }` and `if (G.__DEV__ === true)`. A property
   miss on a stable object is inline-cached (0.46 ns measured) and stays toggleable at
   runtime, which the existing tests require — they flip `globalThis.__DEV__` mid-describe
   and expect the next call to honour it.
2. Keep the ambient `declare const __DEV__` for the remaining sites; do not introduce a
   build-time define (tsdown must never compile-time-fold this — §11.3 item 3 already
   asserts that with a dist grep).
3. Re-measure with the PERF-4a bench in both configurations and record the delta here. The
   bench pins `__DEV__ = false`, so the win will NOT show up in the published numbers — it
   shows up for consumers who never define the flag. Add one bench row or a note that says so.

**Exit:** no per-item hot loop in `packages/**` evaluates an unresolvable global; the
measured cost in the undeclared configuration falls to the declared-configuration cost.

### §11.9 PERF-9 — physics broadphase allocation + O(n²) update (B27) (engine-builder, packages/**)

Spawned by PERF-4a's B26 investigation. Not a launch blocker and not on the PERF-1→5
pre-freeze path — but it is the single largest allocation-pressure source in the measured
frame, and it sits under every game's collision step. One lockstep minor changeset.

Files: packages/physics/src/{collision-world.ts,spatial-index.ts}, tests.

1. **Verify on Hermes first.** Every number in B27 was measured under Bun/JSC. RN is the
   primary target; if Hermes reclaims `Set` backing storage on `clear()` the premise
   changes and only items 2–3 survive. Record the Hermes reading in this row before
   touching `collision-world.ts`.
2. `SpatialIndex.update` (spatial-index.ts:49-51): replace `entries.find((e) => e.item ===
   item)` with a `Map<T, SpatialEntry<T>>` index — removes a closure allocation per entity
   per frame and an O(n) scan inside an already O(n²) broadphase. Keep `remove`'s
   swap-remove semantics working with the index.
   **Note (PF-6, 2026-09-07): `SpatialEntry<T>` no longer exists as a public export — it is
   the internal `_Entry<T>`.** This item also reads superseded in the shipped code: `b617e49`
   ("perf(physics): uniform spatial hash broadphase, surface frozen", 2026-08-27) rewrote
   `SpatialIndex` around a dense array + `_slots: Map<T, number>` index, and `update()`
   (spatial-index.ts:88) is now O(1) via `_slots.get(item)` — no `.find()` scan remains.
   Re-verify against `todo.md`/`SESSION_LOG.md` before treating this item as open work.
3. `CollisionWorld.step` (collision-world.ts:137): iterate `this.entries.values()` and read
   `entryA.entity` instead of destructuring `[entityA, entryA]` — the field already exists,
   so this drops one 2-element array per entity per frame for free.
4. Pair set (collision-world.ts:56-60,:133-135), only if item 1 holds: the swap semantics
   are load-bearing — `activePairs` must still hold the previous frame's set at the two
   diff loops, and `remove()` mutates it in place while iterating. A fresh `Set` per step is
   the smallest change that preserves both; a sorted-array merge is cheaper still but
   rewrites the diff and `remove()`.
5. Re-measure with the PERF-4a heap probe and record the before/after plateau in
   benchmarks.md's heap section.

**Exit:** the integration heap plateau falls materially at 1000 entities with no change to
enter/exit signal behaviour, or the row is closed with the Hermes measurement that refutes
the premise.

---

## 12. Capture-integrity findings + guards (2026-08-25, PERF-19)

Surfaced while re-capturing all five lanes to clear the freshness gate ahead of CE-W6. Four
distinct ways the harness could report something other than what happened, all observed on the same
day. Three are now guarded in `apps/bench-web/scripts/capture.ts`; the fourth is warned about.

### F1 — the Android lane needs Chrome *foregrounded*, and said so only by failing five times

The driver attaches to Chrome rather than launching it (its own header explains why), so Chrome must
be open **and in the foreground** on the phone. Backgrounded, Chrome keeps its process — a `pidof`
check passes — but stops publishing `@chrome_devtools_remote`, and every capture then dies at
`connectOverCDP` having appended nothing. Five consecutive captures failed this way, each slow
enough to look like real work, and the battery temperature *falling* across the window was the only
hint that the phone had done nothing.

**Guard:** `preflightAndroid()` reads `/proc/net/unix` over adb and refuses before the server or the
tunnel start, naming the foreground requirement. One refusal in seconds instead of five silent
failures over twenty minutes.

### F2 — Chrome's DevTools endpoint wedges, and the error pointed at the tunnel

After repeated connect/disconnect cycles the endpoint stops answering while the socket stays
published. Playwright reports `connectOverCDP: Timeout 30000ms exceeded ... retrieving websocket url
from http://127.0.0.1:9222`, which reads like a tunnel fault; the tunnel is fine and only a Chrome
restart clears it.

**Guard:** the driver now catches that failure and rethrows naming the wedge, stating explicitly
that the socket *is* published so this is not the F1 case, and giving the fix (restart Chrome on the
phone). F1's preflight is what makes that disambiguation sound.

### F3 — the runner's exit code is wrong in both directions

- **Nonzero after success.** `bench:web:gpu` writes its baseline, appends all 18 records, then Bun
  panics with `integer overflow` during teardown and exits 3. Two Android captures did the same. The
  data was complete every time. **Intermittent**, not deterministic — a later run through the new
  wrapper did not panic at all.
- **Failure that looks like a run.** The F1 captures exited 1 having measured nothing.

A batch loop cannot tell these apart from the exit code, and folding the second kind republishes the
previous window as current — PERF-18's hazard reached through a different door. Both doors are now
shut on the fold side too: PERF-18 (2026-09-06) refuses any window whose newest capture is not newer
than the published baseline, whatever the capture's exit code claimed.

**Guard:** every `bench:web*` script now runs through `scripts/capture.ts`, which snapshots the
lane's history, runs the capture, and decides success from **what landed**: zero records appended is
a hard failure regardless of exit code; a nonzero exit *with* records is reported as success with
the crash noted. It also refuses a truncated write, a record missing `capturedAt`, and a window
spanning two `capturedAt` values (two runs interleaved as one). `bench:web:unguarded` keeps the raw
runner for debugging.

### F4 — a single capture silently replaces a folded baseline (GUARDED 2026-09-06, PERF-18)

Every capture rewrites its lane baseline from that one run, so one verification capture turns a
committed 5-run fold into a 1-run snapshot with nothing downstream saying so. This is B11's
"bench overwrites baseline" reaching the web lanes. It bit this session directly: a single GPU
capture clobbered a freshly committed fold, and it only surfaced because `bench:web:promote` later
refused a window whose commits disagreed — **at the same commit it would have published silently.**

`capture.ts` first printed the baseline-is-one-run notice with the exact `bench:web:promote` command
after every successful capture. That was a warning, not a guard; the real fix — writing the single
capture to a distinct path — landed with **PERF-18 (2026-09-06)**. A capture now writes a gitignored
`*-latest.json` sidecar, and `web.json` / `web-gpu.json` / `web-android.json` have exactly one
writer: the fold.

That is also what made F3's second door closable. While a capture stamped the published baseline,
the newest capture and the baseline's `generated` were equal after every legitimate run, so a
recency check could not have been written tighter than "strictly older" — which is not the shape of
either incident. With the sidecar in place, equality means *no new capture landed*, and
`judgeWindowRecency` refuses it (`--refold` is the named escape for deliberately re-folding a
published window).

### Measurement results from the same session

- **PERF-14b:** a 5-run back-to-back window at `4451478` was **mode-coherent** — `ecs.step 1000`
  spread 1.018x, `render.flush 1000` 1.088x, `integration.frame 1000` 1.027x, all in the fast state,
  4.13-4.50% foreign load, pinned to 16 P-core threads under High performance. No straddle. This does
  not close PERF-14b (its mode change appeared past run 8) but it does establish that a 5-run window
  is trustworthy here.
- **PERF-17:** the 100 s inter-run gap holds, and starting from a cool phone improves on it. Five
  device captures read 0.426 / 0.425 / 0.425 / 0.430 / 0.419 ms on `render.flush 1000 / 1 atlas`
  (worst 5.3% from median on any row, fold limit 10%), with **no monotonic degradation** — the two
  warmer runs were not slower, and the warmest was the fastest. Against the row's failure case of
  0.432 -> 0.541 and its own reference clean window of 0.426-0.457, this is tighter than either.

### F5 — the host can be quiet and still wrong (PERF-20, same day)

Re-capturing after the F1-F4 guards landed produced host-side numbers **1.6x-2.1x** the committed
baselines while CPU load read 7-11%, then 3.2%, then 1.8%. The node lane's foreign-load guard would
have passed every one of those. The cause was `ChromaVisualizer`, an RGB **visualiser** saturating
the GPU: it barely registers on CPU (0.69 CPU-s per 6 s, ~6% of one core) and is invisible to every
CPU-percentage check in the harness. Closing it restored exact agreement — `render.flush 1000 /
1 atlas` back to 11.300 ms against a committed 11.300.

Two guards, because neither alone is sufficient:

- **`classifyHostLoad`** samples host CPU via `os.cpus()` deltas before every capture and refuses at
  >=15% (the bar the node fold already enforces), warning from 8%. `BENCH_WEB_ALLOW_BUSY=1`
  overrides. Cheap, and catches plain CPU contention — **but it did not catch this incident**, and
  the code says so where someone changing it will read it.
- **`compareToBaseline`** compares every capture's per-row p50 against the lane's published fold and
  reports divergence >25%. This is the check that catches GPU contention, thermal state, driver
  changes — anything that moves the numbers without moving the CPU. It **reports rather than
  refuses**: a real engine change looks identical, and the harness cannot tell them apart. Rows whose
  baseline p50 is under 0.01 ms are skipped, because one unit in the last decimal of a 0.004 ms row
  is a meaningless 25% "shift" — those same rows refused a fold earlier that day on quantisation
  alone.

**Two bugs in these guards, both found by testing them live against the real fault, both of which
had passing unit tests and looked like clean passes:**

1. *It compared each capture against itself.* `run.ts` rewrites the lane baseline (F4) before the
   check read it, so `readBaselineP50` returned the numbers just written. Fixed by reading the
   baseline **before** spawning the capture.
2. *The warnings were skipped on the common path.* The non-zero-exit branch ended in an early
   `return`, so the drift and unfolded-baseline notices never printed — and the cpu-raster lane exits
   non-zero on nearly every capture. Both notices now sit after the branch.

The lesson is F3's in a new place: a silent guard and a working guard look identical from the
outside. Neither bug was visible from unit tests or from a green run; both took a live capture
against a machine that was genuinely in the bad state.
