---
description: "Build the next phase — reads current state, identifies next unfinished phase, implements with verification"
agent: builder
---

# Build Next Phase

Follows [status-sync.instructions.md](../instructions/status-sync.instructions.md). Verify before planning, sync after building.

## Step 0 — Verify state (MANDATORY)

1. Read `docs/references/builder-reference.md` Current State table AND `docs/plans/build-plan.md` Phase Summary. If they disagree, **stop and reconcile first** — do not plan on contradictory docs.
2. Spot-check each package the next phase claims is "not started": does `packages/<name>/src/` already contain real code? Does `packages/<name>/tests/` pass?
3. If any mismatch is found, halt and surface it to the user — do NOT silently move the phase forward.

## Step 1 — Identify next phase

1. Read `docs/references/builder-reference.md` — check the "Current State" table
2. Read `docs/plans/build-plan.md` — find the **lowest phase** with unfinished packages
3. Read `docs/design/api-specs.md` — read the API spec section for those packages

## Step 2 — Plan implementation order

For the identified phase, list all modules to implement. Order them so that dependencies come first (e.g., if module B imports from module A, implement A first).

State the order before starting. Example:

```
Phase 2 — Core Runtime
1. @flare-engine/core: clock.ts → game-loop.ts → app-lifecycle.ts → screen.ts → coroutine.ts → pool.ts
2. @flare-engine/ecs: world.ts → component.ts → query.ts → system.ts → prefab.ts → fsm.ts
```

## Step 3 — Implement with per-module verification

For each module in order:

1. Implement the module following the API spec exactly
2. Export from the package's `src/index.ts`
3. Write tests in `packages/<name>/tests/<module>.test.ts`
4. `cd packages/<name> && bun test` → all pass
5. Fix failures → re-test until green
6. Move to next module

Follow existing patterns from completed packages.

## Step 4 — Phase gate

After all modules in the phase are complete:

1. `bun run typecheck` → zero errors
2. `bun run lint` → zero errors
3. `bun run build` → all packages build
4. `bun run test` → all tests pass
5. Check size budgets (see builder agent for targets)

## Step 5 — Sync docs (MANDATORY — do not skip)

1. Update the "Current State" table in `docs/references/builder-reference.md` — mark completed packages as **DONE** with module count, test count, and size. Use exact numbers, never approximations.
2. Update the Phase Summary row in `docs/plans/build-plan.md` if the phase state changed (🟡 → ✅).
3. Append a short dated note (`YYYY-MM-DD`) to the phase section in `build-plan.md` describing what shipped.
4. Never mark DONE without `bun run test && bun run build` green — see [status-sync.instructions.md](../instructions/status-sync.instructions.md).
