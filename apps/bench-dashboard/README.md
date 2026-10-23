# `apps/bench-dashboard`

Static Next.js dashboard that visualises Flare engine benchmark results. Reads the JSON produced by [`benchmarks/`](../../benchmarks) and [`apps/bench-web`](../bench-web) and renders five views — headline overview, microbench suites, integration frame cost, on-device FPS samples, and web (CanvasKit) numbers.

Private, never published to npm. Not part of the engine runtime.

## Routes

| Path           | Source                               | Purpose                                                     |
| -------------- | ------------------------------------ | ----------------------------------------------------------- |
| `/`            | `benchmarks/results/microbench.json` | Headline cards — ECS / particles / render / integration     |
| `/micro`       | `benchmarks/results/microbench.json` | Per-suite tables + charts (ECS, physics, particles, render) |
| `/integration` | `benchmarks/results/microbench.json` | Integration-frame cost + heap delta                         |
| `/device`      | `benchmarks/results/device.json`     | On-device FPS captures from a device bench scene            |
| `/web`         | `benchmarks/results/web.json`        | CanvasKit render suite, WASM payload, cold start — CPU-raster (offscreen `MakeSurface`), labelled as such |

JSON files are read at build time via `app/lib/data.ts`. Changing results = rerun the bench generators (see below) and rebuild.

## Commands

Run from repo root:

```bash
bun install                                # once
bun --filter @flare-engine-apps/bench-dashboard dev        # http://localhost:3000
bun --filter @flare-engine-apps/bench-dashboard build      # production build → .next/
bun --filter @flare-engine-apps/bench-dashboard typecheck
bun --filter @flare-engine-apps/bench-dashboard lint
```

## Refreshing data

**Microbench JSON** — re-run the off-device suite (takes ~2 min on Windows):

```bash
bun run bench            # runs + appends benchmarks/results/history.ndjson, leaves the baseline alone
bun run bench:promote    # folds the last 5 history runs into the baseline (median + spread)
bun run bench:baseline   # single-run shortcut: promotes just that one run, no spread
```

`history.ndjson` is **tracked on purpose** — it is the append-only record every baseline is
derived from, so a promoted number can always be traced back to the individual runs behind it.
A local exploratory run therefore shows up in `git status`. To keep one out of the record, set
`FLARE_BENCH_NO_RECORD=1` (PowerShell: `$env:FLARE_BENCH_NO_RECORD=1;`) before the command.
As with the staleness override, this is an env var rather than a flag because turbo runs in
strict env mode and `bun run` strips the `--` separator, so a flag never reaches the script.

The normal capture is five runs then a promote, which is what puts a real spread on every row.
`bench:promote` refuses runs that disagree on machine, commit, or scenario set, and refuses any
run captured from a dirty tree — a baseline has to name exactly the code it measured.

The dashboard reads the **baseline**, so only `bench:baseline` changes what it renders. Both
commands go through turbo and build the engine packages first — benchmarks resolve
`@flare-engine/*` to `dist/`, so an unbuilt run measures stale code.

**Device JSON** — hand-append samples from a device bench scene (the original `apps/demo` source was retired at stage 11.14; the bench scene lives in Pan Tvardowski, a private consumer game in its own repo):

1. Release build on hardware (in the PT repo): `bun run android --variant release --device`
2. Triple-tap the menu title → bench scene runs 3 × 10 s
3. Copy CSV between `BENCH FPS CSV BEGIN` / `END` markers from logcat (`adb logcat ReactNativeJS:V *:S`)
4. Append a device entry to [`benchmarks/results/device.json`](../../benchmarks/results/device.json) following the existing schema
5. Regenerate the markdown doc (renders the committed baseline, never re-runs the suites):

```bash
bun run bench:md   # writes docs/references/benchmarks.md from benchmarks/results/microbench.json
```

`bench:md` refuses a baseline older than 30 days rather than republish it silently. Until a
fresh capture lands, publish the existing one deliberately by setting
`FLARE_BENCH_ALLOW_STALE=1` (PowerShell: `$env:FLARE_BENCH_ALLOW_STALE=1;`) before the command.
The variable is declared in `turbo.json` — turbo runs tasks in strict env mode and drops any
variable a task does not list.

Then rebuild the dashboard to see the new device rows.

**Web JSON** — re-run `apps/bench-web`'s capture (~15 min for the full 18-scenario suite under
CPU-raster; a GPU lane also exists, see below):

```bash
bun run bench:web                                   # x5; appends web-history.ndjson (runtime: "web-cpu-raster") + rewrites the web-latest.json sidecar
bun run bench:web:promote --lane cpu-raster --runs 5 # folds those 5 captures into benchmarks/results/web.json — the only thing that writes it
bun run bench:web:gpu                               # x5; the GPU lane (runtime: "web-gpu"), then --lane gpu; local-only, not wired into this dashboard, not run in CI
```

A capture never writes a published baseline: it appends history and rewrites its own
(gitignored) `*-latest.json` sidecar. Publishing is `bench:web:promote` and nothing else, so a
single verification capture can no longer replace a folded window with a one-run snapshot.

`web-history.ndjson` is a separate append-only file from the node lane's `history.ndjson` — see
`apps/bench-web/scripts/history.ts`'s header for why sharing one file is unsafe (`bench:promote`'s
blind `rows.slice(-N)` has no runtime discriminant check). The dashboard reads `web.json`, the
folded baseline — never a single capture.

Then rebuild the dashboard to see the new `/web` numbers.

## Data loading and schema

`app/lib/data.ts` **imports** the three result JSONs through the `@flare-engine/benchmarks` package
exports rather than reading them from a relative path. That makes the workspace dependency real,
puts the data in the module graph (a changed capture is a changed build input), and drops the old
assumption that the build was invoked from this directory.

Everything then goes through `app/lib/schema.ts`, which **validates and throws**. It replaced an
unchecked `JSON.parse(...) as T`, and the difference is the point: this is a static export, so a
schema mismatch now fails the build instead of shipping a page that renders `NaN`, or silently
drops a headline card whose scenario was renamed. If you change the capture schema, this file is
what tells you — loudly.

## Staleness

Every page carries a `CaptureBanner`: capture date, commit, runs folded, `__DEV__` state, machine
and foreign load, plus the age in days — amber past 14, red past 30. Two of this repo's three
published perf surfaces went stale for months without anyone noticing; a bare "generated <date>"
is not enough, because nobody subtracts dates while reading a chart.

For a real publish, build with `DEPLOY=1`:

```bash
DEPLOY=1 bun run build          # fails if the capture is older than 30 days
```

`DEPLOY` is declared in the root `turbo.json` for this task — turbo runs in strict env mode and
drops any variable a task does not list, so an undeclared assert would have been silently inert.

## Deployment

**There is no deploy target, deliberately.** The note that used to sit here pointed at GitHub
Pages "alongside `apps/site`" via `next export` — `apps/site` has never existed in this
repository, and `next export` was removed from Next several major versions ago. It described
infrastructure that was never built.

This is a **local tool**. The published, quotable numbers live in
[`docs/references/benchmarks.md`](../../docs/references/benchmarks.md) and
[`PERFORMANCE.md`](../../PERFORMANCE.md), both of which are generated or maintained behind gates
that run in CI. The dashboard is for exploring a capture interactively, and standing up a deploy
pipeline for it before the October flip would add a publishing surface with no gate behind it —
which is the problem this arc exists to fix, not a solution to it.

If that decision changes, the pieces are in place: `output: 'export'` produces a static `out/`,
`DEPLOY=1` refuses stale data, and the turbo task lists the result JSONs as inputs so a cached
build cannot serve stale HTML over a fresh capture. What is still missing is a `basePath` for
whatever subdirectory it lands under, and a redeploy trigger on result-JSON changes.

## Notes

- Private workspace — ignored by Changesets, never published.
- No test suite. The schema guard is exercised by the build itself: a malformed capture fails
  `bun run build`, which CI runs.
