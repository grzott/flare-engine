# Web Bench (PERF-6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish trustworthy web performance numbers for the engine before the OSS release — frame
cost under real CanvasKit, WASM payload size, and cold start — measured from one scenario source of
truth shared with the existing microbench.

**Architecture:** The microbench already separates pure-data scenario *descriptors* (e.g.
`FlushScenario` in `benchmarks/src/render.bench.ts`) from the Skia binding they run against
(`skia-stub.ts`). This plan promotes those descriptors into an exported `scenarios/` module in the
`@flare-engine/benchmarks` workspace, then adds a second runner — `apps/bench-web` — that binds the
same descriptors to **real CanvasKit in a browser** and measures rAF deltas under Playwright.
Node-with-stub and web-with-CanvasKit become two bindings of one scenario set, which is what makes
the two number sets comparable and keeps a renamed scenario a test failure rather than a silent gap.

**Tech Stack:** Bun, TypeScript strict, Biome, Turborepo, Playwright (new), canvaskit-wasm,
Next.js (existing dashboard).

**Spec:** [perf-measurement-2026-07.md](perf-measurement-2026-07.md) §11.6. Owner chose **full
scope, including the real-browser matrix** (2026-08-14).

## Global Constraints

- No `any`, no `as any`, no `@ts-ignore`, no `@ts-expect-error`
- Named exports only, no default exports; `import type` for type-only imports
- No `TODO` / `FIXME`; comment only non-obvious logic
- Bun runtime. `npm`/`npx`/`yarn`/`pnpm` are DENIED by a hook — use `bun` / `bunx`
- Biome only, never Prettier or ESLint
- Builders never run `git add` / `commit` / `push` — commit blocks go to the owner
- Conventional Commits, ≤72 chars, no body, no emoji, no `Co-Authored-By` trailer
- **`apps/bench-web` must be DOUBLE-LOCKED in the commit that creates it**: `private: true` in its
  manifest **and** an entry in `.changeset/config.json`'s `ignore` array. `apps/bench-dashboard` is
  single-locked today — do not repeat that.
- **Any new scoped workspace needs a `LAYER_MAP` entry in `scripts/check-deps-tiers.mjs` before the
  first CI run.** An unmapped scoped package is a hard error, not a warning.
- **The existing microbench numbers must not move.** `check:perf` compares committed counters. Task
  C1 is a pure refactor: if a counter or timing changes, the extraction changed behaviour and is
  wrong. This is the single highest-risk property in the plan.
- No version numbers in prose — the fleet is lockstep.

## Known state, verified 2026-08-16

- `benchmarks/src/scenario-contract.ts` is a **frozen name registry** (`EXPECTED_SCENARIOS`,
  `HEADLINE_PREFIXES`, `EXPECTED_SUITE_TITLES`) — not executable definitions. It stays, and the new
  scenarios module must remain consistent with it.
- `benchmarks/src/harness.ts` exports a generic `BenchDef<S>` plus `runBench`, `SMOKE_OVERRIDES`,
  `P99_MIN_SAMPLES`. Reuse it; do not fork a second harness.
- `benchmarks/package.json` `exports` currently exposes only the two results JSON files.
- `@flare-engine/benchmarks` is already `private: true` and already in `.changeset` `ignore`.
- **Playwright is not a dependency anywhere in the repo.**
- **TestingBot appears only in docs, plans, and a token-pattern in `scripts/audit-tarballs.mjs`** —
  there is no workflow, no config, no credential wiring in this repo. The browser matrix is
  greenfield here.
- `check:perf-freshness` is RED at HEAD and is not this plan's to fix — it needs an owner-run
  recapture from a quiet tree.

---

## Task C1: Promote the scenario descriptors into an exported SoT

**Files:**
- Create: `benchmarks/src/scenarios/index.ts`, plus one module per suite as the split demands
- Modify: `benchmarks/src/{ecs,physics,particles,render,integration}.bench.ts` — import descriptors
  instead of declaring them
- Modify: `benchmarks/package.json` — add a `"./scenarios"` export
- Modify: `scripts/check-deps-tiers.mjs` — `LAYER_MAP` entry for `benchmarks`
- Modify: `benchmarks/tests/**` — a test asserting the scenarios module and
  `scenario-contract.ts` agree

**Interfaces:**
- Consumes: `BenchDef<S>` from `harness.js`; the existing per-suite descriptor types.
- Produces: `@flare-engine/benchmarks/scenarios` exporting the pure-data scenario descriptors for
  every suite, consumed by the existing bench files, by `apps/bench-web` (Task C2), and later by
  `bench-native`.

**The property that matters:** descriptors are **data only** — counts, texture orders, rotated
fractions, alpha runs, effect selections. No Skia handle, no engine instance, no closure over a
runner. The Skia binding is supplied by whoever runs them. If a descriptor cannot be expressed
without touching a stub, it does not belong in this module yet; leave it in its bench file and say
so in the report.

- [ ] **Step 1: Write the failing consistency test**

`benchmarks/tests/scenarios.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { EXPECTED_SCENARIOS, EXPECTED_SUITE_TITLES } from '../src/scenario-contract.js';
import { SCENARIOS } from '../src/scenarios/index.js';

describe('scenario SoT', () => {
  it('covers every suite the contract freezes', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual([...EXPECTED_SUITE_TITLES].sort());
  });

  it('produces exactly the frozen scenario names, in order', () => {
    for (const title of EXPECTED_SUITE_TITLES) {
      const names = SCENARIOS[title]!.map((s) => s.name);
      expect(names).toEqual([...EXPECTED_SCENARIOS[title]!]);
    }
  });

  it('descriptors carry no runtime handles', () => {
    for (const title of EXPECTED_SUITE_TITLES) {
      for (const s of SCENARIOS[title]!) {
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }
    }
  });
});
```

The third test is the load-bearing one: a descriptor that survives a JSON round-trip unchanged is
provably free of functions, class instances, and Skia handles — which is exactly what lets the web
runner reuse it.

- [ ] **Step 2: Run it and watch it fail**

Run: `bun --cwd benchmarks test tests/scenarios.test.ts`
Expected: FAIL — `Cannot find module '../src/scenarios/index.js'`.

- [ ] **Step 3: Extract the descriptors**

Move the pure-data scenario lists out of each `*.bench.ts` into `src/scenarios/`. Each entry needs
at minimum a `name` matching `scenario-contract.ts` exactly, plus the suite-specific parameters
already present (for Render: `count`, `textures`, `order`, `rotatedFraction`, `alphaRuns`,
`stretch`, and an effect *identifier* rather than a constructed effect object).

Where a bench file currently builds an effect inline (`tint`, `outline`, `roofsCity`), the
descriptor carries a string key and the *runner* maps key → effect. That keeps the descriptor
JSON-round-trippable and lets the web runner build the same effect from the same key.

- [ ] **Step 4: Rewire the bench files to consume it**

Each `*.bench.ts` imports its descriptors and iterates them, instead of declaring inline arrays. The
work performed per scenario must be **identical** — same order, same counts, same effects.

- [ ] **Step 5: Prove the refactor moved no numbers**

Run: `bun run check:perf`
Expected: PASS with no counter drift.

This is the gate that catches a behaviour-changing "refactor". If it fails, do not update the
baseline — the extraction is wrong. Report the exact counter that moved.

Then: `bun --cwd benchmarks test`, `bun run lint`, `bun run typecheck`.

- [ ] **Step 6: Export it and map the layer**

Add to `benchmarks/package.json`:

```json
    "./scenarios": "./src/scenarios/index.ts",
```

Add a `benchmarks` entry to `LAYER_MAP` in `scripts/check-deps-tiers.mjs`, matching the shape of the
entries already there. Then `bun run check:deps` must pass.

- [ ] **Step 7: Report** — no commit; list files changed.

---

## Task C2: `apps/bench-web` — double-locked scaffold + CanvasKit runner

**Files:**
- Create: `apps/bench-web/package.json`, `tsconfig.json`, `index.html`, `src/main.ts`,
  `src/runner.ts`
- Modify: `.changeset/config.json` — add `apps/bench-web`'s package name to `ignore`
- Modify: `scripts/check-deps-tiers.mjs` — `LAYER_MAP` entry

**Interfaces:**
- Consumes: `@flare-engine/benchmarks/scenarios` (C1), `@flare-engine/render-web`,
  `@flare-engine/render`, `canvaskit-wasm`.
- Produces: a page that runs every scenario against real CanvasKit and reports, per scenario,
  rAF-delta `p50` / `p95` / `p99` in milliseconds, plus a machine-readable result payload on
  `window` for Playwright to collect (Task C3).

- [ ] **Step 1: Scaffold, double-locked in this same step**

`apps/bench-web/package.json` must carry `"private": true`. In the same change, add its name to the
`ignore` array in `.changeset/config.json`. Both locks land together — a bench app that reaches the
changeset flow is a publish landmine, and `apps/bench-dashboard` is single-locked today precisely
because this was done in two steps once before.

Add the `LAYER_MAP` entry before running `check:deps`.

- [ ] **Step 2: The runner**

`src/runner.ts` binds the shared descriptors to real CanvasKit:

- load CanvasKit via `@flare-engine/render-web`'s `loadCanvasKit` (it now has stall/deadline bounds
  and retries after failure — use it rather than hand-rolling a loader)
- build a surface, build a `FrameRenderer` via `createWebSkiaModule` + `createFrameRenderer`
- for each descriptor: warm up, then sample rAF deltas until `P99_MIN_SAMPLES` from
  `@flare-engine/benchmarks` harness constants is satisfied, then compute p50/p95/p99

Reuse the harness's existing percentile logic if it is exported; if it is not, export it from
`harness.ts` rather than writing a second implementation. Two percentile implementations that
disagree is a defect this plan should not create.

- [ ] **Step 3: A test that the runner reports every scenario**

Assert the runner's result payload has one entry per name in `EXPECTED_SCENARIOS`, so a dropped
scenario fails rather than silently shrinking the published table.

- [ ] **Step 4: Gate** — `bun run lint`, `bun run typecheck`, `bun run check:deps`,
  `bun run check:changeset`. Report each.

---

## Task C3: Playwright harness

**Files:**
- Create: `apps/bench-web/playwright.config.ts`, `apps/bench-web/scripts/run.ts`
- Modify: `apps/bench-web/package.json` — Playwright devDependency + a `bench:web` script
- Modify: root `package.json` — a `bench:web` passthrough script if the repo's other bench scripts
  have one

**Interfaces:**
- Consumes: the runner's `window` result payload from C2.
- Produces: a headless run that writes one result record per scenario.

- [ ] **Step 1: Add Playwright and pin the browser**

Playwright is **not currently a dependency anywhere in this repo** — you are introducing it. Install
it in `apps/bench-web` only, not at the root. Pin the browser version; an unpinned browser makes
every future capture incomparable to the last, which defeats the point of a baseline.

- [ ] **Step 2: Headless run with repeatability controls**

Disable GPU-variance sources you can control and record the ones you cannot. At minimum record the
browser name and version into each result record — Task C4's provenance schema needs it anyway.

- [ ] **Step 3: Gate** — the run completes headless and emits one record per scenario.

---

## Task C4: The no-GPU numbers

**Files:**
- Create: `apps/bench-web/scripts/payload.ts`
- Modify: `apps/bench-web/scripts/run.ts`

Three numbers, none of which need a GPU, all of which a reader of a web engine's docs will look for:

1. **CanvasKit WASM bytes** — `default` vs `full` binary, **raw and gzipped**, four numbers. Read
   them from the installed `canvaskit-wasm` package rather than hardcoding.
2. **Cold start to first rendered frame** — from navigation start to the first completed
   `composite()`, on a warm cache and a cold one.
3. **The same, throttled to a 4G profile** — Playwright can emulate this; state the exact profile
   used in the output so the number is reproducible.

- [ ] **Step 1** — implement, then verify the byte numbers against `ls -l` and `gzip -c | wc -c` on
  the actual files. A payload number that disagrees with the file on disk is worse than no number.
- [ ] **Step 2: Gate** — all three groups emit finite values; report them.

---

## Task C5: Provenance, history, and the dashboard Web section

**Files:**
- Modify: `apps/bench-web/scripts/run.ts` — append to `history.ndjson`
- Modify: `apps/bench-dashboard/app/lib/data.ts` (+ `schema.ts`) — read and validate web records
- Create: a dashboard Web section
- Modify: `docs/references/benchmarks.md` — a dated Web section

**Interfaces:**
- Produces: history records carrying the full provenance schema
  `{ commit, host, runtime, appVersion, unit }` alongside the measurements.

- [ ] **Step 1: Provenance schema.** Match the existing history record shape exactly — read it
  before writing. `runtime` distinguishes the web lane from the node lane; that field is what stops
  the dashboard mixing incomparable numbers into one series.
- [ ] **Step 2: Dashboard.** `apps/bench-dashboard` has a validating parser that **throws** on
  schema drift, and it is a static export, so a bad record is a failed build rather than a broken
  page. Extend the validator rather than bypassing it. Also switch the dashboard's dead dependency
  on `@flare-engine/benchmarks` to a live package-export import, which is what removes the Turbopack
  whole-project-trace warning.
- [ ] **Step 3: Publish.** Add a dated Web section to `docs/references/benchmarks.md`.
- [ ] **Step 4: Gate** — `bun run build` (the dashboard build is the schema gate), plus the full
  root gate.

---

## Task C6: The real-browser matrix — OWNER-GATED, DO NOT START BLIND

**Owner answered 2026-08-16:** the TestingBot account exists and is currently wired to the
Pan Tvardowski repo.

**No migration is needed.** TestingBot authenticates with an account-level key/secret pair, not a
repo binding, so adding the same two values as GitHub secrets here does not disconnect PT. Both
repos can use the account simultaneously. Treat this as additive.

**Still open, and narrower than account access:** PT uses TestingBot for *native Android device*
runs (APK upload, device matrix). C6 needs **real-browser** coverage — desktop and mobile browsers
running CanvasKit — which is a differently-tiered capability. The question to answer from the
dashboard's device/browser catalogue is: does the current plan include real-browser
(Selenium/WebDriver) minutes, or is it a native-device-only tier?

Per `perf-measurement-2026-07.md` §11.7's B21 ordering, **catalogue verification comes FIRST**,
before any workflow is written. A prior device lane in this project failed at exactly this step.

There is no TestingBot workflow, config, or credential wiring in this repo today — this is
greenfield here, not a revival. Verified 2026-08-16: the string appears only in plans, the session
log, `.gitignore`, and a token pattern in `scripts/audit-tarballs.mjs`.

### Security constraint — non-negotiable, this repo goes public

`flare-engine` flips public at the OSS launch. CI credentials in a public repo leak through
**workflow triggers**, not through the encrypted secret store: a workflow that runs on
`pull_request` from forks — and especially anything using `pull_request_target` — can be made to
exfiltrate secrets via an attacker's pull request.

The TestingBot workflow must therefore be triggered by **`workflow_dispatch` and `push` on `main`
only**. Never `pull_request`, never `pull_request_target`, never a fork-triggered event. This is
cheap to get right now and unpleasant to retrofit once the repo is public and third-party PRs
exist. Any future edit to that workflow's `on:` block is a security review, not a chore.

Do not begin C6 until the owner confirms. C1–C5 deliver publishable web numbers without it; the
matrix adds breadth, not the headline figures.

- [ ] **Step 1:** Owner confirms plan tier + device catalogue. Record the answer in this file.
- [ ] **Step 2:** One single-device `workflow_dispatch` run before any matrix or cron.
- [ ] **Step 3:** Expand to the matrix only after a green single-device run.
- [ ] **Step 4:** No `continue-on-error`. A silent zero-row week must turn the lane red.

---

## Exit criteria

- One scenario SoT, consumed by both runners, with a test that fails on divergence from
  `scenario-contract.ts`
- `check:perf` green with **no counter drift** from C1
- `apps/bench-web` double-locked, `LAYER_MAP`-mapped, `check:deps` and `check:changeset` green
- Headless Playwright run emits p50/p95/p99 per scenario plus the three payload/startup groups
- `history.ndjson` records carry full provenance; the dashboard builds (its validator throws on
  drift, so a green build is the schema proof)
- `docs/references/benchmarks.md` has a dated Web section
- C6 either complete or explicitly parked with the owner's answer recorded here

## Out of scope

- `check:perf-freshness` — red at HEAD, needs an owner-run recapture from a quiet tree
- `bench-native` (PERF-7) — this plan only makes the scenario SoT ready for it
- Changing any existing microbench number
