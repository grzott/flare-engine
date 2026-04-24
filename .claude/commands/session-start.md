---
description: Start the next pending session from docs/plans/sessions.md. Routes to engine-builder or game-builder by scope tag. Verifies state, presents implementation plan, stops for user approval before touching files.
argument-hint: "[#session-id]"
---

# /session-start

Begin a session from [docs/plans/sessions.md](../../docs/plans/sessions.md).

## Step 0 — Pick session

If the user passed `#N`, target that row. Else pick the lowest-numbered `pending` row. If none → report "no pending sessions — run /plan-sessions" and stop.

If the target row is `in_progress` (left over from a previous abandoned attempt), ask the user whether to resume or reset. Do not auto-resume.

## Step 1 — Route by scope

- `[engine]` → delegate to `engine-builder`
- `[game]` → delegate to `game-builder`
- `[mixed]` → delegate to `engine-builder` first (engine half), then hand off to `game-builder` for the game half. Each agent owns its scope; no cross-editing.

## Step 2 — Flip row status

Edit `docs/plans/sessions.md`: flip the row `pending` → `in_progress`. Stamp open date.

## Step 3 — Builder verifies + plans

The builder:
1. Runs state verification per [.github/instructions/status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md).
2. Reads the session row's `goal`, `touched paths`, `gates`, `target commits`.
3. Drafts an implementation plan (files to create/modify, tests to add, risks, dep additions).
4. **STOPS.** Presents the plan. Waits for user approval.

## Step 4 — On approval

Builder implements exactly what was planned. No drive-by changes. Session does not close here — run `/session-close` when implementation is complete.
