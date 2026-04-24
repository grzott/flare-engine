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

**Microbench JSON** — re-run the off-device suite (takes ~60 s on Windows):

```bash
cd benchmarks
bun run bench        # writes benchmarks/results/microbench.json
```

**Device JSON** — hand-append samples from a device bench scene (the original `apps/demo` source was retired at stage 11.14; `apps/pan-tvardowski` M9.6 will re-introduce an in-game bench scene):

1. Release build on hardware: `cd apps/pan-tvardowski && npx expo run:android --variant release --device`
2. Triple-tap the menu title → bench scene runs 3 × 10 s
3. Copy CSV between `BENCH FPS CSV BEGIN` / `END` markers from logcat (`adb logcat ReactNativeJS:V *:S`)
4. Append a device entry to [`benchmarks/results/device.json`](../../benchmarks/results/device.json) following the existing schema
5. Regenerate the markdown doc from cache (no microbench re-run):

```bash
cd benchmarks
bun run bench:md:cache   # writes docs/references/benchmarks.md from cached JSON
```

Then rebuild the dashboard to see the new device rows.

## Notes

- The dashboard imports types from `@flare-engine/benchmarks` (workspace dep) but reads the JSON files directly from disk via relative paths. If you move `benchmarks/results/`, update `app/lib/data.ts`.
- Private workspace — ignored by Changesets, never published.
- Deployment target for launch is GitHub Pages alongside `apps/site` (Phase 11.12). Static export: `next build` + `next export` (config already `output: 'export'` in `next.config.ts`).
