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
| **B19** | major | **release.yml runs a parallel gate subset** — a ci.yml-only perf gate cannot block a publish. Every perf gate lands in *both* workflows, plus verify.sh *after* build, engine/mixed scope only (test runs before build there; game scope skips build). | release.yml:32-37, verify.sh:58-69 |
| **B20** | major | **PT harness fails-green class** to fix before the P3 lift: regression-check exits 0 on zero rows; a >7-day gap resets the baseline to current (weekly cadence self-pins to ratio 1.0 — window must be ≥4× cadence or last-N-runs); no device×scenario×metric matrix validation; the 5% ratio gate has no absolute floor (its only real firing was 5 "regressions" on µs-scale noise, itself masked); zero-combo runs exit green; scenario ids live in three divergent namespaces (dispatch enum ≠ flow stems ≠ ndjson); debug artifacts were never uploaded (path outside workspace + `if-no-files-found: warn`). | PT regression-check.ts:32,:136; bench-cloud.sh:311-336; perf-bench.yml:43 |
| **B21** | major | **B3 revive protocol reordered** (root cause reattributed, §9): verify TestingBot account/plan/device-catalog names FIRST → fix artifact upload so the next failure leaves evidence → one single-device `workflow_dispatch` → only then fresh APK at HEAD → weekly cron with staleness gate, never `continue-on-error`. | PT perf-bench.yml:13-29 + gh run logs |
| **B22** | major | **results/device.json is a third stale published surface** (generated 2026-04-22, one Galaxy A54 entry) rendered by the dashboard /device route; its documented refresh pipeline (triple-tap + "BENCH FPS CSV" logcat markers) no longer exists anywhere in PT. §1–§8 never mention it. | device.json:2, dashboard README.md:39-52 |
| **B23** | major | **`createBenchSession` has zero consumers** in benchmarks/ or PT while api-specs ships it as "the backbone for deterministic bench scenarios"; P3 "reuse bench-mode.ts" would hand-roll seeding a third time (PT uses its own mulberry32; benchmarks uses SeededRNG directly). Consolidate or correct api-specs before the flip. | packages/testing/src/bench-session.ts:25, api-specs.md:434 |
| **B24** | blocker | **§6's freshness items had no mechanical checker in any phase** — pull-not-push reapplied to the gate itself. The keystone control is `check:perf-freshness` in PR CI (the only runner that provably always runs): fail when a suite's capture date predates the newest commit under the packages it measures. Same liveness-canary pattern as `check:readme`. | §6:278-280 vs §5; ci.yml:35 precedent |
| **B25** | major | **Dashboard fails-green class**: unchecked `as T` cast + hand-duplicated types (dead `@flare-engine/benchmarks` dep); headline substring match → `return null` (schema drift renders NaN or silently drops cards while CI stays green); /integration undated and renders B2 noise with good/bad colors; no staleness logic anywhere; deploy target is dead infra (README: GH Pages beside nonexistent `apps/site` via the removed `next export`); basePath/absolute-nav/root-escaping-link deploy blockers. | data.ts:6-11, page.tsx:41,:74, integration/page.tsx:29-31, README.md:58 |
| **B26** | lead | **A real zero-alloc violation to hunt**: the isolated heap measurement (see §9 B2) shows +15.7–33.4 KB/frame retained growth in the integration frame, stable ±0.2%. P1's exact alloc counters should localize it. Known uncounted steady-state alloc: the live slice at frame-renderer.ts:383,:390. | measured 2026-07-28, 2 isolated runs |

---

## 11. Execution rows — Arc PERF (todo.md points here)

§5's phases remain the design rationale; this section is the row-ified execution order with
§9–§10 folded in. Routing: **PERF-3 = engine-builder** (`packages/**`, minor changeset);
all other rows **[MT]** main-thread. **PERF-1→5 are the pre-freeze must** (the §7
"defensible release" core plus gates); PERF-8 is cheap and pre-freeze-preferred; PERF-6/7
slide post-flip if the calendar tightens, with PERFORMANCE.md declaring the blank (§8).
Owner-OOB items are ledgered per row, never blocking. Changesets: only PERF-3 touches
`packages/*/src` → one lockstep minor; other rows need none.

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

### §11.4 PERF-4 — microbench honesty (P1 rework) [MT, 1–2 sessions]

Requires PERF-3. Kills B1, B16, B17, B23, B26-hunt. Files: benchmarks/src/** (+ a counting
FrameRendererModule stub), api-specs.md if B23 resolves by amendment.

1. Render bench drives the real pipeline: construct
   `createFrameRenderer(countingSkiaStubModule)` and pass `frameRenderer.drawAtlas` to
   `flush` — the only way `fillXforms` executes (§9: a flush callback can never reach it).
   The stub counts **every** DrawSurfaceLike method and hard-fails on any unknown call, so
   a future draw path (like 2026-07's zone-bg drawRect) breaks the gate loudly instead of
   shipping unmeasured.
2. Scenario matrix: sprite sweep 100→5,000 × atlas 1/4/8 in *both* interleaved (worst case,
   keep) and texture-clustered (expected runs == atlas count) orders; rotated fraction
   0/50/100%; mixed alpha/stretch/effect scenarios; outline/stretch/zone-bg path scenarios
   (B17).
3. Allocation measurement: retire the in-process heap-delta; report heap only
   isolated-subprocess-per-scenario (stable ±0.2%); the exact gate is phrased honestly —
   "zero pool misses + zero injected-factory calls per steady-state frame" (pool/factory
   counters provably cannot see e.g. the live slice at frame-renderer.ts:383,:390; the
   subprocess heap number stays as the whole-heap backstop). Hunt the B26 +15–33 KB/frame
   lead.
4. Harness stats: report max as `max`; p99 only at n≥100; warm up by elapsed time (≥300 ms)
   not 3 fixed batches; multi-run median-of-medians + IQR by default.
5. Bound the physics/integration workloads (wrap/bounce at seed bounds) + a post-run
   bounding-box assert so stationarity is machine-checked (B16).
6. Seeding: consolidate all bench seeding on `@flare-engine/testing` `createBenchSession`,
   or amend api-specs.md:434 (B23).
7. Extend coverage: animation, postfx, tilemap, pathfinding, math — per-frame paths only.

**Exit:** the bench measures the transform path; every row carries variance; alloc counts
are exact integers; suites are stationary.

### §11.5 PERF-5 — Track A gate + freshness canary + freeze-gate homing (P2) [MT, 1–2 sessions]

Kills B7, B8, B19, B24. Files: scripts/check-perf.mjs, scripts/check-perf-freshness.mjs,
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
gate by reference.

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

### §11.8 PERF-8 — publish: dashboard hardening + PERFORMANCE.md (P5) [MT]

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
