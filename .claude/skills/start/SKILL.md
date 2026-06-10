---
name: start
description: Start the next row(s) from docs/plans/todo.md. Accepts a count ("3", max 5) or a row keyword. Routes to engine-builder or game-builder. Presents ALL selected row plans, stops ONCE for batch approval, then runs rows sequentially with a per-row gate and per-row commit block.
argument-hint: "[N | row-keyword]"
---

# /start

Begin the next work row(s) from [docs/plans/todo.md](../../../docs/plans/todo.md).

## Step 1 — Pick row(s)

Read `docs/plans/todo.md`.

- **No argument** → take the first row under `## Active` (batch of 1).
- **Integer N** (cap 5) → take the top N rows under `## Active`.
- **Keyword** → match it against row keywords (case-insensitive substring) and take that single row.
- No match → report "no active row" and stop.

Scope per row, from its goal text or paths:
- `packages/**` only → engine
- `apps/<game>/**` only → game
- both → mixed (engine half first, then game half)

If ambiguous, ask the user.

## Step 2 — Plan every row

For each selected row, the routed builder (`engine-builder` for engine, `game-builder` for
game, engine-builder first for mixed):

1. Reads `docs/plans/roadmap.md` for context.
2. Reads the row goal + any paths mentioned in the row.
3. **Verifies every declared path exists** (Glob) — stale spec paths are a known repeated
   planner error; name the real file in the plan, not the row's guess.
4. Drafts an implementation plan: files to create/modify, tests to add, suspected risks.
5. If the row adds any user-facing string, the plan MUST declare the localization cascade
   upfront: `src/localization/keys.ts` + `locales/en.json` + `locales/pl.json` (the single
   most repeated undeclared drift in 188 logged sessions).
6. If the row adds or renames an export in `packages/render` or `packages/react`, the plan
   MUST include the mock-stub updates in `packages/react/tests/{game-view,safe-area}.test.ts`.

## Step 3 — ONE approval stop

Present ALL row plans together. **STOP.** Wait for user approval. The user may strike rows
from the batch or amend plans. Nothing is implemented before this approval.

## Step 4 — Batch init

Write the current dirty-path list to the batch baseline (empty file if the tree is clean):

```bash
git status --porcelain | awk '{print $2}' | sort -u > .claude/.batch-baseline
```

(Skip for a batch of 1 if you prefer today's single-row behavior — verify.sh treats a
missing baseline exactly as before.)

## Step 5 — Run rows sequentially

For each approved row, in order:

1. Implement exactly the approved plan. No drive-by changes.
2. Run the gate: `bash .claude/hooks/verify.sh "<row goal>" "<scope>" "<frictions>"`
   (frictions grammar in the [/close skill](../close/SKILL.md)).
3. On gate failure: fix and re-run — max 2 fix attempts, then halt the batch and report.
4. Overlap check: if this row's emitted file list intersects a previous row's, print
   "rows N/M overlap on `<files>` — consider one combined commit". Per-row commit blocks
   are only clean when rows touch disjoint files; prefer batching rows from different
   packages.
5. Move the closed row to `## Done` in `todo.md`.

## Step 6 — Batch end

Delete `.claude/.batch-baseline`. Print the collected per-row commit blocks in order —
the user runs them (builders never run `git add`/`commit`/`push`).

## Notes

- Rows in `todo.md` are append-only history; no status flips per row. The session block in
  `SESSION_LOG.md` is the canonical history.
- No tier picker, no supersession footnotes, no mirror rows. If priority changes, reorder
  rows in `todo.md` directly.
- `/loop` is NOT the batch mechanism — reserve it for poll-style waits, always with an
  explicit max-iterations.
