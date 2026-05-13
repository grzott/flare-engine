---
description: Start the next row from docs/plans/todo.md. Routes to engine-builder or game-builder. Verifies state, presents implementation plan, stops for user approval before touching files.
argument-hint: "[row-keyword]"
---

# /start

Begin the next work row from [docs/plans/todo.md](../../docs/plans/todo.md).

## Step 1 — Pick row

Read `docs/plans/todo.md`. Pick the first row under `## Active`. If the user passed an argument, match it against row keywords (case-insensitive substring) and pick that one instead. If no row matches → report "no active row" and stop.

If the row's scope is unambiguous from its goal text or paths:
- `packages/**` only → engine
- `apps/<game>/**` only → game
- both → mixed (engine half first, then game half)

If ambiguous, ask the user.

## Step 2 — Route to builder

- engine → delegate to `engine-builder` agent
- game → delegate to `game-builder` agent
- mixed → engine-builder first; on completion of engine half, hand to game-builder

## Step 3 — Builder plans

The builder:
1. Reads `docs/plans/roadmap.md` for context.
2. Reads the row goal + any paths mentioned in the row.
3. Drafts an implementation plan: files to create/modify, tests to add, suspected risks.
4. **STOPS.** Presents the plan. Waits for user approval.

## Step 4 — On approval

Builder implements exactly what was planned. No drive-by changes. Session does not close here — run `/close` when implementation is complete.

## Notes

- Rows in `todo.md` are append-only history; no status flips per row. When a row is done, move it under `## Done` (or delete if uninteresting). The session block in `SESSION_LOG.md` is the canonical history.
- No tier picker, no supersession footnotes, no mirror rows. If priority changes, reorder rows in `todo.md` directly.
