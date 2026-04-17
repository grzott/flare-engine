---
description: "Build the next phase — reads current state, identifies next unfinished phase, implements with verification"
agent: builder
---

# Build Next Phase

## Step 1 — Identify next phase

1. Read `docs/references/builder-reference.md` — check the "Current State" table
2. Read `docs/plans/build-plan.md` — find the **lowest phase** with unfinished packages
3. Read `docs/design/api-specs.md` — read the API spec section for those packages

## Step 2 — Plan implementation order

For the identified phase, list all modules to implement. Order them so that dependencies come first (e.g., if module B imports from module A, implement A first).

State the order before starting. Example:

```
Phase 2 — Core Runtime
1. @flare/core: clock.ts → game-loop.ts → app-lifecycle.ts → screen.ts → coroutine.ts → pool.ts
2. @flare/ecs: world.ts → component.ts → query.ts → system.ts → prefab.ts → fsm.ts
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
6. Update the "Current State" table in `docs/references/builder-reference.md` — mark completed packages as **DONE**
