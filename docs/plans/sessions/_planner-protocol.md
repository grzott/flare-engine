# Planner protocol

Shared contract between `engine-planner` and `game-planner` for writing to [../sessions.md](../sessions.md).

## Invocation

Both planners are dispatched by `/plan-sessions`. Users may also invoke either agent directly via `Agent` tool.

## Pre-work verification (mandatory)

Both planners run the state-verification protocol from [../../../.github/instructions/status-sync.instructions.md](../../../.github/instructions/status-sync.instructions.md) **before** drafting rows:

1. Read the primary plan doc (`build-plan.md` for engine, `<game>-build-plan.md` for game).
2. Read its mirror (`builder-reference.md` Current State for engine, `apps/<game>` row for game).
3. Reconcile with disk (`packages/<name>/src/` for engine, `git log --oneline -n 20 -- apps/<game>` for game).
4. Halt on drift. Never plan on stale status.

## Draft mode (propose-only)

Both planners present the draft slice as a markdown table **in chat first**. They do not write to `sessions.md` until the user approves.

The draft must:
- Cover 10–20 rows (hard limit; more = reject, split into two slice refreshes).
- Preserve existing `done` and `in_progress` rows verbatim (no renumbering, no deletion).
- Only append new rows or edit `pending` rows that haven't been opened yet.
- Include `depends on` references for any `[mixed]` row or any row that can't start until a prior one closes.

## Mixed-scope handling

Rows tagged `[mixed]` are jointly owned. The initiating planner drafts the half it owns and invokes the other planner (via `Agent` tool) to draft the matching half. Each planner writes only its own fields; neither edits the other's touched paths.

## Write mode

After user approval, the planner:
1. Opens `docs/plans/sessions.md` for edit.
2. Inserts new rows at the end of the active slice (highest `#` + 1 onwards).
3. Never touches `done` / `in_progress` rows except to append a `closed` date or transition `pending` → `blocked` (with a `depends on` reference added).
4. Stamps no dates — `opened` belongs to `/session-start`, `closed` belongs to `/session-close`.

## Sizing ceiling

If the user asks for a slice > 20 rows:
- Offer to split the slice into two planner runs.
- Never write more than 20 new `pending` rows in one invocation.

## Handoff on drift

If pre-work verification finds drift (doc mirrors disagree, phase rows stale, game changelog out of sync with git history), the planner stops and hands off:
- Engine drift → `engine-builder` (sync docs) or `architect` (process break).
- Game drift → `game-builder` (sync game plan) or `architect` (process break).

Never silently plan past drift.
