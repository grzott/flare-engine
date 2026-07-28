# `apps/bench-dashboard`

Static Next.js dashboard that visualises Flare engine benchmark results. Reads the JSON produced by [`benchmarks/`](../../benchmarks) and renders four views — headline overview, microbench suites, integration frame cost, and on-device FPS samples.

Private, never published to npm. Not part of the engine runtime.

## Routes

| Path           | Source                               | Purpose                                                     |
| -------------- | ------------------------------------ | ----------------------------------------------------------- |
| `/`            | `benchmarks/results/microbench.json` | Headline cards — ECS / particles / render / integration     |
| `/micro`       | `benchmarks/results/microbench.json` | Per-suite tables + charts (ECS, physics, particles, render) |
| `/integration` | `benchmarks/results/microbench.json` | Integration-frame cost + heap delta                         |
| `/device`      | `benchmarks/results/device.json`     | On-device FPS captures from a device bench scene            |

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
A local exploratory run therefore shows up in `git status`; use `bun run bench -- --no-record`
if you do not want it in the record.

The normal capture is five runs then a promote, which is what puts a real spread on every row.
`bench:promote` refuses runs that disagree on machine, commit, or scenario set, and refuses any
run captured from a dirty tree — a baseline has to name exactly the code it measured.

The dashboard reads the **baseline**, so only `bench:baseline` changes what it renders. Both
commands go through turbo and build the engine packages first — benchmarks resolve
`@flare-engine/*` to `dist/`, so an unbuilt run measures stale code.

**Device JSON** — hand-append samples from a device bench scene (the original `apps/demo` source was retired at stage 11.14; the bench scene lives in [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski), now its own repo):

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

## Notes

- The dashboard imports types from `@flare-engine/benchmarks` (workspace dep) but reads the JSON files directly from disk via relative paths. If you move `benchmarks/results/`, update `app/lib/data.ts`.
- Private workspace — ignored by Changesets, never published.
- Deployment target for launch is GitHub Pages alongside `apps/site` (Phase 11.12). Static export: `next build` + `next export` (config already `output: 'export'` in `next.config.ts`).
