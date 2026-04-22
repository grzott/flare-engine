# Builder Reference

Detailed protocols for the `@builder` agent. See [builder.agent.md](../../.github/agents/builder.agent.md) for core instructions.

## Current State

| Package                      | Layer | Status                                                                           |
| ---------------------------- | ----- | -------------------------------------------------------------------------------- |
| Monorepo scaffold            | —     | **DONE**                                                                         |
| `@flare-engine/math`         | 0     | **DONE** — 10 modules, 354 tests, 6KB gzip                                       |
| `@flare-engine/events`       | 0     | **DONE** — 2 modules, 27 tests, 621B gzip                                        |
| `@flare-engine/core`         | 1     | **DONE** — 6 modules, 70 tests, 3.3KB gzip                                       |
| `@flare-engine/ecs`          | 1     | **DONE** — 7 modules, 52 tests, 2.6KB gzip                                       |
| `@flare-engine/render`       | 2     | **DONE** — 7 modules, 68 tests, 4.4KB gzip                                       |
| `@flare-engine/input`        | 2     | **DONE** — 8 modules, 59 tests, 15KB raw (gamepad+remap in 11.4)                 |
| `@flare-engine/physics`      | 2     | **DONE** — 5 modules, 48 tests, 2.8KB gzip                                       |
| `@flare-engine/audio`        | 2     | **DONE** — 4 modules, 30 tests, 1.8KB gzip                                       |
| `@flare-engine/assets`       | 2     | **DONE** — 3 modules, 22 tests, 1.8KB gzip                                       |
| `@flare-engine/scene`        | 3     | **DONE** — 3 modules, 31 tests                                                   |
| `@flare-engine/animation`    | 3     | **DONE** — 4 modules, 44 tests, 1.3KB gzip                                       |
| `@flare-engine/particles`    | 3     | **DONE** — 2 modules, 25 tests                                                   |
| `@flare-engine/tilemap`      | 3     | **DONE** — 5 modules, 37 tests                                                   |
| `@flare-engine/debug`        | 3     | **DONE** — 3 modules, 25 tests                                                   |
| `@flare-engine/react`        | 4     | **DONE** — 5 modules, 16 tests                                                   |
| `@flare-engine/engine`       | 4     | **DONE** — 1 module, 6 tests + 10 integration                                    |
| `@flare-engine/storage`      | 2.5   | **DONE** — 7 modules, 44 tests, ~3KB gzip                                        |
| `@flare-engine/errors`       | 2.5   | **DONE** — 3 modules, 14 tests, 1.7KB raw                                        |
| `@flare-engine/testing`      | 2.5   | **DONE** — 4 modules, 23 tests, 3.4KB raw                                        |
| `@flare-engine/ui`           | 3.5   | **DONE** — 10 modules, 37 tests, 15KB raw                                        |
| `@flare-engine/postfx`       | 3.5   | **DONE** — 4 modules, 19 tests, 7KB raw                                          |
| `@flare-engine/localization` | 2.5   | **DONE** — 5 modules, 30 tests, 6.5KB raw                                        |
| `@flare-engine/deep-links`   | 2.5   | **DONE** — 5 modules, 20 tests, 5.2KB raw                                        |
| `@flare-engine/share`        | 2.5   | **DONE** — 2 modules, 17 tests, 4.9KB raw                                        |
| `@flare-engine/a11y`         | 2.5   | **DONE** — 2 modules, 11 tests, 1.5KB raw                                        |
| Phase 7 — Hardening          | —     | ✅ **DONE** — 907 tests, 0 failures; 3 bugs fixed, integration suite added       |
| `@flare-engine/pathfinding`  | 3     | **DONE** — 4 modules, 54 tests, 20KB raw                                         |
| `@flare-engine/dialogue`     | 3     | **DONE** — 3 modules, 41 tests, 5.5KB raw                                        |
| `@flare-engine/leaderboards` | 6     | **DONE** — 2 modules, 5 tests, 496B ESM (interface-only stub)                    |
| `@flare-engine/achievements` | 6     | **DONE** — 2 modules, 5 tests, 519B ESM (interface-only stub)                    |
| `@flare-engine/iap`          | 6     | **DONE** — 2 modules, 5 tests, 504B ESM (interface-only stub)                    |
| `@flare-engine/analytics`    | 6     | **DONE** — 2 modules, 5 tests, 451B ESM (interface-only stub)                    |
| `@flare-engine/devtools`     | 5     | **DONE (partial 0.1.0)** — 6 modules, 14 tests, ~2.8KB gzip                      |
| `@flare-engine/cli`          | 5     | **DONE** — 4 modules, 11 tests, ~8.7KB raw (sharp + maxrects-packer + commander) |
| `create-flare-app`           | 5     | **DONE** — 4 modules + 3 templates (blank/topdown/shmup), 12 tests, ~8KB raw     |

| Phase 8 — Benchmarking | — | ✅ **DONE** — Android capture (Galaxy A54 5G release) populated in `benchmarks/results/device.json`; doc regenerated via `bench:md:cache`. iOS capture pending as follow-up; Phase 10 gating decision recorded (stay deferred, physics is first C++ target if ever needed). |
| Phase 9 — Demo Game | — | ✅ DONE — full loop verified on device |
| Phase 10 — C++ Accel | — | ⬜ data-gated (after Phase 8) |
| Phase 11.1 — CanvasKit parity + storage | — | ✅ DONE — parity report at `docs/references/canvaskit-parity.md`, storage shipped, LICENSE propagation wired |
| Phase 11.2–11.5, 11.7, 11.10 — engine packages | — | ✅ DONE — all Tier-1, genre, and Tier-2 stub packages shipped |
| Phase 11.8 — CLI + scaffolder | — | ✅ **DONE** — `@flare-engine/cli` (pack-atlas, tiled-to-flare, new) + `create-flare-app` with blank/topdown/shmup templates |
| Phase 11.11 — Demo web / MP4 | — | ⬜ not started — MP4 + poster is default deliverable; live WebGL stretch |
| Phase 11.12 — Docs site | — | ⬜ not started — deferred to pre-launch polish alongside 11.13 |
| Phase 11.13 — API lock + RC + pre-launch polish | — | ⬜ not started — governance files, API snapshots, Kenney atlas swap, RC publish |
| Game 2 (roguelike) | — | ❌ DEFERRED post-launch to separate private repo (dogfood test of published 0.1.0) |
| Phase 12 — Launch | — | ⬜ planned |

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
