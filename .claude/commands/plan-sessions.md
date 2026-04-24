---
description: Generate or refresh the 10–20 session slice in docs/plans/sessions.md. Auto-picks engine-planner or game-planner based on context (current dir under apps/<game>/ → game; else engine; user can override). Propose-only — waits for approval before writing.
argument-hint: "[engine|game|<game-name>]"
---

# /plan-sessions

Generate or refresh the 10–20 session slice in [docs/plans/sessions.md](../../docs/plans/sessions.md).

## Step 0 — Choose scope

If the user passed an argument, honor it:
- `engine` → use `engine-planner` (via the `Agent` tool)
- `game` → detect current `apps/<game>/` from recent git activity + cwd; if ambiguous, ask. Use `game-planner`.
- `<game-name>` → use `game-planner` targeting `apps/<game-name>/`

If no argument:
- If any `apps/<game>/*` was touched in the last 3 commits → default to `game-planner`.
- Else → default to `engine-planner`.

State the chosen scope before proceeding.

## Step 1 — Dispatch

Delegate to the chosen planner via the `Agent` tool with:
- Target: `docs/plans/sessions.md`
- Slice size: 10–20 rows
- Mode: **propose-only** (do not write without user approval)

The planner will:
1. Verify state (status-sync protocol).
2. Draft rows following [docs/plans/sessions/_template.md](../../docs/plans/sessions/_template.md).
3. Present the draft as a markdown table in chat.

## Step 2 — User approval gate

STOP. The planner's draft is displayed. Wait for user approval ("looks good", "ship it", or edits).

## Step 3 — Write

On approval, the planner appends/replaces rows in `docs/plans/sessions.md`, preserving `done` and `in_progress` history.

## Step 4 — Confirm

Print a one-line summary: `Added N rows [engine=X, game=Y, mixed=Z]. Next session: #<id> "<title>".`
