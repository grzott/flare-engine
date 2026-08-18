# Consumer docs sync after the 0.3.0 cut (plan, 2026-08-18)

Session plan for the two sibling repos that publish claims about this engine. **Gated: runs only
after CE-W6 publishes `0.3.0` restricted** — both repos install from the restricted registry, so
nothing here is executable before the publish.

Each repo runs in **its own harness with its own gate**. Nothing in this plan is executed from the
engine repo, and no agent working here writes into a sibling repo ([[workflow_agents_write_wrong_repo]]).

## 0. What this plan is not

It is the **facts-and-version** half only. The two code swaps are already specified elsewhere and
are not restated here (one source per fact):

| Code swap | Spec |
|---|---|
| `flare-engine-page` render-web adoption (D3) | [consumer-enablement-2026-08.md](consumer-enablement-2026-08.md) §10 W7 |
| `grzott-portfolio` dynamics swap | [dynamics-lift-2026-08.md](dynamics-lift-2026-08.md) §7, todo row **DYN-2** |

Each session below does its repo's swap **first**, because the fact rows describe the swap's
result. Claiming a consumer exists before the import is repointed is how a ledger goes wrong.

## 1. `flare-engine-page` — session P

`C:\_PROG\flare-engine-workspace\flare-engine-page`. Astro Starlight + starlight-typedoc on
Cloudflare Workers ([[flare_engine_page_repo]]).

**State verified 2026-08-18** by `bun scripts/sync-engine-docs.ts --check` against engine `a50c3ad`
(read-only; `--check` never writes):

- 42 packages seen; **1 added** — `@flare-engine/dynamics`
- **17 changed export surfaces** — achievements, analytics, assets, core, dialogue, engine, haptics,
  input, leaderboards, particles, react, render, render-web, tilemap, ui, ui-shop, create-flare-app
- committed catalog + manifest are **drifted**
- **`dynamics` has no `docs-sync/layer-map.json` entry**, so it renders under "Unclassified"

Order:

1. **`docs-sync/layer-map.json` — add `dynamics` BEFORE the sync run.** That file is the page's
   declared source of truth for a package's displayed layer, and an unmapped package does not fail;
   it renders "Unclassified". Getting this wrong ships an Unclassified package on the site the
   launch points at. Layer 2 (Systems), matching this repo's [roadmap.md](roadmap.md) table.
2. **Bump the 8 `@flare-engine/*` deps** `^0.2.1` → `^0.3.0`; `bun install` from the restricted
   registry. The committed `.npmrc` reads `${NPM_TOKEN}` from the environment — secret-free by
   design; the token must be exported in the shell.
3. **The D3 swap** (spec above). Do it in this session: the `render-web` hardening is what the bump
   delivers, and the swap is the only thing that proves it. Its verification is a browser pass —
   cycle all five animations, then force a context loss in devtools and confirm the hero self-heals
   rather than blanking until reload.
4. **`bun run sync:docs`** — regenerates `src/data/engine-packages.json` + `docs-sync/engine-manifest.json`.
   Output is deterministic (no timestamps, no engine sha baked in), so review the 17 changed
   surfaces rather than rubber-stamping a green diff.
5. **`docs/canvaskit-spike.md`'s empty "Spike Results" section can finally be filled** — web perf is
   no longer unmeasured. **Cross-link [benchmarks.md](../references/benchmarks.md)'s Web section
   rather than copying numbers into the page**; a second copy of a measured number is a second thing
   to keep fresh, and this repo's canary does not watch that repo.
6. Repo's own gate.

**Owner-OOB:** a weekly `engine-docs-sync` workflow opens a drift PR on its own schedule. Running
the sync by hand here only gets ahead of it — but confirm that workflow checks out an engine ref
that actually contains 0.3.0, or its next PR will revert this session's catalog.

## 2. `grzott-portfolio` — session Q

`C:\_PROG\grzott-portfolio`. The blog docs are a **fact ledger** (`docs/blog/NUMBERS.md`) with its
own audit protocol and its own precedent for handling published claims. A sync here means running
that protocol, not hand-editing rows.

**Already done 2026-08-17 — do not redo:** `engine-web-build-status` corrected,
`engine-render-web-consumers` 0 → 3 real import sites, and the web number rows
(`web-render-flush-1k-gpu-ms`, `web-render-flush-1k-cpu-raster-ms`, `web-render-8atlas-*`,
`web-bench-gpu-renderer`, `web-bench-vsync-floor`).

**Stale as of 2026-08-18:**

- `engine-packages` — reads **40**; now **41 scoped / 42 dirs** (`dynamics`, 2026-08-16).
- `engine-version` — reads **0.2.1 (restricted)**; becomes **0.3.0 (restricted)**.
- `engine-layer-tiers` — reads 7, a *measured* longest-path depth. `dynamics` is a new Layer-2 node
  depending only on `math`, so it probably does not move the path — but the row is measured, so
  measure it rather than reasoning about it.
- The audit header pins engine HEAD `df1e3de` (2026-08-04). Re-pin to the 0.3.0 commit.
- Any row citing microbench values captured before 2026-08-18: the recapture moved
  `render.flush 1000 / 1 atlas` 55.6 → 56.3 µs and `ecs.step 1000` 23.2 → 23.1 µs. **Both are inside
  the run-to-run spread** — growth/noise, not a correction.
- **The portfolio stops being a non-consumer.** Every row and post premise saying it has no
  `@flare-engine` dependency and is a "future greenfield showcase" flips the moment DYN-2 lands.
  That is the single biggest narrative change in this session.

Order:

1. **DYN-2 first** (spec above), so the ledger describes something true.
2. Run the repo's NUMBERS audit protocol against engine 0.3.0; update the rows above.
3. **`DISTRIBUTION.md` / `CHANGELOG.md` / `PUBLISHING-SCHEDULE.md`:** the published narrative pins
   *"the engine is `access: restricted` at **0.2.1** until the October flip; the flip IS the
   availability moment."* **That narrative survives the August publish intact** — 0.3.0 is still
   restricted, October is still the availability moment. Only the version detail moves. Do not
   re-plan the launch story around a version bump.
4. **Published posts: growth-not-correction**, matching this repo's established precedent — no
   retro-edits to shipped posts for a number that merely grew. Record the delta in NUMBERS and let
   `POSTMORTEMS.md` take anything that actually reverses a premise. The non-consumer flip in item 2
   is the one candidate that might qualify.

## 3. Sequencing

The two sessions are independent — neither blocks the other. Page first if you want the docs site
correct before the Oct 5-18 manual-test window; portfolio first if a post is queued against it.

Nothing in the engine repo is required beyond being published: no engine-side row exists for this
plan, deliberately.

## 4. Done when

- Page: `sync-engine-docs --check` exits clean, `dynamics` renders under Layer 2, the five hero
  animations run on `^0.3.0` with the D3 swap in place and the hero self-heals after a forced
  context loss, repo gate green.
- Portfolio: DYN-2 landed and the settle-parity assertion passes, NUMBERS re-audited against the
  0.3.0 commit with the six stale rows corrected, the restricted-version phrasing updated in the
  three distribution docs, no published post retro-edited.
