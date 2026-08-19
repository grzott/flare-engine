# Finishing the benchmarking area for publication (runbook, 2026-08-19)

What is left before the benchmark story can ship with 0.3.0, in execution order. Steps marked
**OWNER** cannot be done by an agent (machine settings, or a judgement call about scope).

State 2026-08-19 (updated): §1 PERF-14 and §2 PERFORMANCE.md are **done**. `check:perf-freshness` is
still RED, now for one reason only — `benchmarks/src` changed in `5be8ce7`, so the baseline was taken
by a different instrument and needs a re-capture. The second complaint it used to carry (the
published page rendered from an older capture than the baseline) is cleared: `bun run bench:md` was
re-run against the `d9d2746` baseline. Root tsc 0. Three web lanes captured and folded. Remaining
critical path: §3 (web staleness guard) and the re-capture in §1c.

---

## Critical path — these block publishing

### 1. PERF-14 — settle the power-plan finding — **DONE 2026-08-19**

**Resolved.** Owner set High performance and re-captured; the error came out at **~2.5x on every
headline row** (`integration.frame` 12.62 → 5.01 ms, `render.flush 1000 / 1 atlas` 55.6 → 23.1 µs —
full table in todo.md `## Done`). Protocol decision: **assert**, implemented in
`benchmarks/src/power.ts` — the scheme is recorded in capture provenance and a capture under Power
saver is refused. Landed `5be8ce7` + `f457e82`; withdrawal notice published in `PERFORMANCE.md`.

**What it did not settle — carried forward as PERF-14b.** The ~2x straddle still happens under High
performance. Eleven captures at `f457e82`, all at ~1-2% foreign load: the first eight are tight
(`render.flush` 21.1-22.9 µs), the last three step to 44.9-45.5 µs together. Read §"Known conditions"
below before capturing — the back-to-back instruction in 1c is what walked the machine into it.

The original steps are kept below as the re-capture procedure, since they are run again after any
`benchmarks/src` change.

**1a. OWNER — set the plan and confirm.**

```
powercfg /getactivescheme
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c   # High performance
powercfg /getactivescheme                                   # confirm it took
```

If `8c5e7fda…` is not present on the machine, Balanced (`381b4222-f694-41f0-9685-ff5bb260df2e`) is
an acceptable fallback — record which was used.

**1b. Close the noisy apps.** The load guard refuses a window above 15% foreign load. Discord,
Razer Synapse + ChromaVisualizer, Steam, EA Desktop and spare Chrome windows are the repeat
offenders on this machine; with them closed it reads ~3-6%, with them open ~20%.

**1c. Recapture and fold, from a clean tree** (the bench refuses dirty-tree captures):

```
git status --porcelain          # must be empty
bun run bench                   # x5, back-to-back, no other work in between
bun run bench:promote
bun run bench:md
bun run check:perf-freshness    # must print OK
```

**Superseded 2026-08-19 — do not follow blindly.** This step used to say "run the five without
pauses, a gap lets the CPU drop back to a low clock state". Under Power saver that was the observed
behaviour; under High performance the opposite showed up — eight uninterrupted runs were tight and
runs nine through eleven stepped ~1.8x slower together. Until PERF-14b separates the cause, capture
the five, then **check the run log before promoting**: if the five do not sit in one mode, discard
the window rather than letting `promote`'s 2-of-5 deviation guard decide for you.

**1d. Size the error — this is the actual deliverable of PERF-14.** Compare the new folded baseline
against the committed one and record the delta per suite. If the numbers move materially, then the
2026-07-30 and 2026-08-18 baselines were captured in whichever mode they happened to catch, and
`benchmarks.md` needs a correction notice saying so — the same treatment the vsync correction got.
If they do not move, that is equally worth recording: it bounds the effect.

**1e. Decide the protocol.** Three options, pick one and write it into `benchmarks/src/load.ts`'s
neighbourhood plus `PERFORMANCE.md` § Methodology:

- **record it** — add the active power scheme to capture provenance beside `cpuModel`, so a reader
  can see it (cheapest, honest, does not prevent a bad capture);
- **assert it** — refuse a capture taken under a power-saving plan, the way foreign load is refused
  (strongest, and consistent with how this repo treats measurement conditions);
- **pin it** — have the capture script set and restore the plan (most invasive, needs elevation,
  not recommended).

Recommended: **assert**, matching the existing load guard. Record the choice in the row.

### 2. PERFORMANCE.md — two sections are now materially false — **DONE 2026-08-19**

**Resolved**, and wider than specified: the audit found the headline table itself was 2.5x stale, so
the table was removed rather than re-typed — `PERFORMANCE.md` now carries **no numbers at all** and
points at the generated page for every figure, which is the one-source-per-fact fix for a duplicate
that has now gone stale twice. The web/Android rewrites below were done as specified, plus a new
"Published figures that were withdrawn" section carrying both the vsync and the power-plan
corrections. Original spec kept below.

`PERFORMANCE.md` is launch-facing and leads with what is *not* measured. Two of its claims stopped
being true on 2026-08-16/18:

- **§ "Web / CanvasKit — never benchmarked"** — wrong. Three lanes now exist (CPU-raster, desktop
  GPU, on-device Android), plus WASM payload bytes and cold start. Rewrite to state what each lane
  measures and, critically, that both GPU lanes measure **CPU-side submission cost, not GPU
  execution time**.
- **§ "Android device frame rates — stale, and unrefreshable"** — now half true. The 2026-04-22
  `device.json` capture is still stale and still unrefreshable, and that must stay said. But
  engine-owned *web-on-device* measurement now exists on a real phone. Separate the two claims
  rather than letting the new lane look like a refresh of the old file.

Also add the pre-2026-08-18 correction to the honesty list: every web figure published before that
date was quantized to the display refresh interval and must not be cited.

### 3. Web lanes have no staleness guard — close it

`check:perf-freshness` covers only the five node suites (`freshness.suites` in
`.perf-baseline.json`), and **nothing in `scripts/` or CI watches the web captures at all**. A web
capture can go arbitrarily stale, or be deleted, and every gate stays green. The node lane's own
history is the argument for fixing this: the freshness canary is what caught the instrument change
that made this whole arc necessary.

Minimum viable: extend `check-perf-freshness.mjs` to also assert each web lane's capture exists,
carries `runs >= 2`, and names a commit reachable from HEAD; treat `render-web`/`postfx`/`render`
`src` changes since that commit as staleness for the web lanes the way package changes stale the
node suites. Wire it into the same CI jobs that already run `check:perf-freshness`
(`ci.yml:52`, `release.yml:47`).

### 4. Final pass

```
bun run lint && bun run typecheck && bun run test && bun run build
bun run check:deps && bun run check:changeset && bun run check:readme
bun run check:nodenext && bun run check:perf && bun run check:perf-bytes
bun run check:perf-freshness
bunx tsc -p tsconfig.json --noEmit          # expect 0
bun run build --force --filter=@flare-engine-apps/bench-dashboard
```

The dashboard build is the schema gate — it throws on drift and is a static export, so a green
build is the proof the published data validates.

---

## Not blockers — scope decisions **OWNER**

These make the benchmark story *broader*, not *more correct*. The area can publish without them
because `PERFORMANCE.md` states the gaps plainly, which is the standard this repo holds itself to.

- **PERF-4b — coverage extension.** Eleven packages with per-frame hot paths have zero benchmark
  coverage (animation, postfx, tilemap, pathfinding, math and others). Honest today because the doc
  says so; it stays a gap until this lands.
- **PERF-7 — native bench app + device lane.** `apps/bench-native` does not exist. This is the only
  path that refreshes the dead `device.json` and removes the permanent red banner from the dashboard
  device page. Two sessions plus an APK build. A Pixel 7 is available over adb, so the hardware
  half is no longer blocked.
- **C6 — TestingBot browser matrix.** Parked. The capability probe exists; the plan-tier question is
  unanswered and owner-only. The on-device lane covers the mobile case it was mainly wanted for.
- **PERF-9 — physics broadphase (B27).** An engine perf fix, not a benchmarking-area item. Post-freeze.

**The decision to make:** does "ready for publishing" mean *the numbers we publish are correct,
current and honestly bounded* (critical path only — achievable in one session plus the owner steps),
or does it also mean *broad coverage across packages and native device numbers* (add PERF-4b and
PERF-7, roughly three to four more sessions)?

The critical path is the defensible minimum. Everything in it is either a live falsehood
(PERFORMANCE.md), an unverified foundation (PERF-14), or a missing guard on published data
(web freshness).

---

## Known conditions to carry into any capture session

- **Bun panics `integer overflow` during teardown, after all writes.** Measured 4/5 on the
  CPU-raster web lane, 1/7 Android, 0/5 desktop GPU. The exit code is not a reliable success signal
  on the long lane — check for the written result files instead.
- **Device is a Pixel 7** (panther, Tensor GS201, Mali-G710), not a Pixel 9. Captures record this
  correctly from `getprop`; prose should match.
- **~~Back-to-back matters.~~ The machine changes mode mid-batch, in both directions.** Under Power
  saver a gap let the CPU downclock; under High performance, runs 9-11 of an uninterrupted batch
  stepped ~1.8x *slower* than runs 1-8 at the same 1-2% foreign load (`f457e82`, 2026-08-19). Treat
  "all five runs sat in one mode" as something to verify in `history.ndjson`, not something the
  batching style guarantees. Tracked as PERF-14b.
- **BIOS 1611 / microcode 0x11F, with WHEA-corrected machine-check events under load.** A BIOS
  update is scheduled; a capture session before it lands carries this as a known confound.
