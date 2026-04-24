---
description: Close the current in_progress session — runs gates, checks doc-sync, flips sessions.md row to done, appends SESSION_LOG.md block, emits paste-ready commit bash blocks. Routes to the verifier agent.
---

# /session-close

Close the `in_progress` session in [docs/plans/sessions.md](../../docs/plans/sessions.md).

## Step 0 — Delegate

Delegate to the `verifier` agent (via the `Agent` tool). The verifier has no edit rights on source — it only runs gates, reads diffs, and writes to `SESSION_LOG.md` + `docs/plans/sessions.md`.

## Verifier protocol (reference — the verifier runs this; this command dispatches it)

1. **Diff audit** — `git diff --name-only`. Reject if files outside the session's `touched paths` appear without justification.
2. **Gates (halt on first failure)**:
   - Engine / mixed: `bun run lint` → `bun run typecheck` → `bun run test` → `bun run build`
   - Game: `bun --cwd apps/<game> run typecheck` → `bun run lint` → `bun --cwd apps/<game> test` → `bun --cwd apps/<game> run build` (if present)
3. **Device smoke** (game scope only) — print the command; user runs it; paste-back confirms.
4. **Doc-sync check** per [.github/instructions/status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md):
   - Engine: `builder-reference.md` Current State row updated, `build-plan.md` Phase Summary updated if phase state changed.
   - Game: `<game>-build-plan.md` §17 engine-coverage ticks + Change log entry, `builder-reference.md` mirror row, `release-readiness-checklist.md` ticks.
5. **Emit commit blocks** — Conventional Commits, subject only, ≤72 chars, scoped by concern (feat/fix/perf/refactor/test/docs/chore). Each commit = one fenced ```bash block.
6. **Write session artifacts**:
   - Flip `docs/plans/sessions.md` row `in_progress` → `done`, stamp close date.
   - Append session block to `SESSION_LOG.md` per [.github/instructions/session-close.instructions.md](../../.github/instructions/session-close.instructions.md).
7. **Report** — one-line summary + commit subjects.

## Failure modes

- **Gate red** → halt, surface the trimmed error, wait for user direction. Do not close.
- **Doc-sync gap** → halt, surface the missing entry, hand back to the builder. Do not close.
- **Files outside `touched paths`** → halt, ask the user whether to extend the session scope or revert the drift.

## User action

After close is complete, **you run the commit blocks**. The agent never commits.
