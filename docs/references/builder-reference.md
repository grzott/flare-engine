# Builder Reference

Detailed protocols for the `@builder` agent. See [builder.agent.md](../../.github/agents/builder.agent.md) for core instructions.

## Current State

All 34 `@flare-engine/*` packages + `create-flare-app` are ✅ **DONE** and published-ready at 0.1.0. Per-package module/test/size counts live in each package's folder (`packages/<name>/src`, `packages/<name>/tests`) and in package READMEs. Cumulative test count: **~1,180** across the engine (all green).

Active + pending work is tracked at phase / app / milestone granularity:

| Row                                                      | Status                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo scaffold                                        | ✅ DONE                                                                                                                                                                                                                                                                                                                                        |
| Phase 7 — Hardening                                      | ✅ DONE — 907 tests, 0 failures; 3 bugs fixed, integration suite added                                                                                                                                                                                                                                                                         |
| Phase 8 — Benchmarking                                   | ✅ DONE — Android capture (Galaxy A54 5G release) in `benchmarks/results/device.json`; iOS capture pending as optional follow-up; Phase 10 stays deferred (physics is first C++ target if ever needed)                                                                                                                                         |
| Phase 9 — Demo Game                                      | ✅ DONE — full loop verified on device                                                                                                                                                                                                                                                                                                         |
| Phase 10 — C++ Accel                                     | ⬜ data-gated (after Phase 8 device signal); not blocking launch                                                                                                                                                                                                                                                                               |
| Phase 11.1 — CanvasKit parity + storage                  | ✅ DONE — parity report at `docs/references/canvaskit-parity.md`                                                                                                                                                                                                                                                                               |
| Phase 11.2–11.5, 11.7, 11.10 — engine packages           | ✅ DONE — all Tier-1, genre, and Tier-2 stub packages shipped                                                                                                                                                                                                                                                                                  |
| Phase 11.8 — CLI + scaffolder                            | ✅ DONE — `@flare-engine/cli` (pack-atlas, tiled-to-flare, new) + `create-flare-app` with blank/topdown/shmup templates                                                                                                                                                                                                                        |
| Phase 11.11 — Landing-page MP4 + store links             | ⬜ not started — MP4 placeholder (URL swap), store-page links in docs. Live web build dropped 2026-04-22.                                                                                                                                                                                                                                      |
| Phase 11.12 — Docs site                                  | ⬜ not started — deferred to pre-launch polish alongside 11.13                                                                                                                                                                                                                                                                                 |
| Phase 11.13 — API lock + RC + pre-launch polish          | ⬜ not started — governance files, API snapshots, EUIPO trademark filing, RC publish                                                                                                                                                                                                                                                           |
| Phase 11.14 — Extraction + reusability + demo retirement | ✅ **DONE** (2026-04-24) — 8/8 engine extractions shipped; 8/8 per-package SKILL.md files updated; `apps/demo` deleted and every reference swept. See [build-plan.md §11.14](../plans/build-plan.md#1114--extraction--reusability--demo-retirement).                                                                                                                   |
| `apps/pan-tvardowski` (showcase + canonical end-to-end reference)        | 🟡 **M0–M9.4 done, M9.5–M9.6 pending** (2026-04-26) — all 8 zones playable + full menu/save/settings/credits/inventory/shop/dialogue-portrait shell shipped, 38+ tests green (portrait manifest, locale parity, inventory + shop suites). `apps/demo` (prior proof-of-concept) retired 2026-04-24. M9 split into M9.1 UI kit ✅ · M9.2 inventory/codex ✅ · M9.3 shop + entitlements ✅ · M9.4 dialogue avatar slot ✅ · M9.5 asset-swap infra · M9.6 store-ready bundle. See [pan-tvardowski-build-plan.md §17](../plans/pan-tvardowski-build-plan.md#17--milestones). |
| Game 2 (roguelike)                                       | ❌ DEFERRED post-launch to separate private repo (dogfood test of published 0.1.0)                                                                                                                                                                                                                                                             |
| Phase 12 — Launch                                        | ⬜ planned                                                                                                                                                                                                                                                                                                                                     |

## Extraction candidates (PT → engine, Phase 11.14)

Strict genre-agnostic filter: extractions must work for any 2D / 2.5D mobile game genre. See [pan-tvardowski-build-plan.md §21](../plans/pan-tvardowski-build-plan.md#21--engine-extraction-notes-feeds-phase-1114) for rejected items + rationale.

| Extraction                                           | Target package                                | Status                                                  |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `createPostFxController`                             | `@flare-engine/postfx`                        | ✅ shipped 2026-04-24 (37 tests)                        |
| `createA11yBridge`                                   | `@flare-engine/a11y`                          | ✅ shipped 2026-04-24 (17 tests)                        |
| `createTier2Wiring`                                  | `@flare-engine/engine`                        | ✅ shipped 2026-04-24 (19 tests)                        |
| `MainMenuKit`                                        | `@flare-engine/ui`                            | ✅ shipped 2026-04-24 (40 tests total)                  |
| `DialoguePanel` (avatar slot) + `speakerPortraitKey` | `@flare-engine/ui` + `@flare-engine/dialogue` | ✅ shipped 2026-04-24 (42 + 40 tests)                   |
| `ShopPanel` + `ProductCatalog` + `EntitlementStore`  | `@flare-engine/ui` + `@flare-engine/iap`      | ✅ shipped 2026-04-24 (40 + 17 tests)                   |
| `createScreenshotScene`                              | `@flare-engine/share`                         | ✅ shipped 2026-04-24 (22 tests)                        |
| Canonical placeholder-atlas docs                     | `@flare-engine/assets` (example-only)         | ✅ shipped 2026-04-24 (JSDoc pointer to PT shape-atlas) |

> **Source-of-truth rule.** Engine phases + packages → this table + [build-plan.md Phase Summary](../plans/build-plan.md). Game apps → `docs/plans/<game>-build-plan.md` changelog; this table mirrors only the last-milestone marker. See [status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md).

Each scaffolded package has: `package.json` (workspace deps), `tsconfig.json`, `tsup.config.ts`, `src/index.ts` (empty export).

## Verification Protocol

MANDATORY — never declare work complete without running verification.

**Per-module loop** (repeat for each source file):

1. Implement the module in `packages/<name>/src/<module>.ts`
2. Export from `packages/<name>/src/index.ts`
3. Write tests in `packages/<name>/tests/<module>.test.ts`
4. `cd packages/<name> && bun test` → all pass
5. Fix failures → re-test until green

**Phase gate** (after all modules in a phase):

1. `bun run typecheck` → zero errors
2. `bun run lint` → zero errors
3. `bun run build` → 16/16 packages build
4. `bun run test` → all tests pass
5. Verify size budgets (check `dist/` output)
6. Update the "Current State" table above

## Task Completion Guidelines

**New module:**

1. Implement source following API spec exactly
2. Write tests — cover edge cases: NaN, Infinity, zero, negative, very large, degenerate inputs
3. Export from barrel `index.ts`
4. Verify: tests pass, build succeeds, size within budget

**Bug fix:**

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify the test passes, no regressions

**Refactor:**

1. Ensure tests pass before refactoring
2. Refactor
3. Ensure tests still pass — identical behavior

## Do Not

- Do not add features beyond what the API spec defines
- Do not create abstractions for single-use code
- Do not add error handling for scenarios that cannot occur
- Do not "improve" code that is not part of the current task
- Do not use `any`, `as any`, or `@ts-ignore`
- Do not create classes where plain objects + static functions suffice
- Do not allocate in hot paths (game loop, render, physics tick)
- Do not import from a higher layer
- Do not add default exports
- Do not overstate what works in commit messages — be honest and precise

## Learnings

<!-- Add lessons here when mistakes or non-obvious patterns are discovered. -->
<!-- Format: - [topic]: [lesson] -->
