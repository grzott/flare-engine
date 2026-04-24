---
description: Build the next game milestone — auto-detects game from apps/<game>/, reads its build plan, plans with user approval, implements, gates, emits commit blocks. Thin wrapper over the game-builder workflow; prefer /session-start for session-sized work.
argument-hint: "[<game-name>]"
---

# /build-next-milestone

Execute one milestone end-to-end for a Flare game app via the `game-builder` agent.

Full protocol lives in [.github/prompts/build-next-milestone.prompt.md](../../.github/prompts/build-next-milestone.prompt.md) — this command loads it and dispatches.

## When to use this vs. /session-start

- `/build-next-milestone` — full milestone delivery (one whole zone / boss / cross-cutting pass). Larger than one session.
- `/session-start` — one session from `docs/plans/sessions.md`. **Preferred for day-to-day work.**

## Protocol

1. Detect the game (arg override, else auto-pick from `apps/*/` + recent git activity; if ambiguous, ask).
2. Verify state per [.github/instructions/status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md).
3. Identify lowest `M<n>` with unticked engine-coverage boxes.
4. Present plan (files, tests, checkboxes, deps). STOP. Wait for approval.
5. Implement.
6. Tests (deterministic concerns only).
7. Gates (typecheck → lint → tests → build, per [game-builder.md](../agents/game-builder.md)). Device smoke is user step.
8. Sync docs: game plan §17 ticks + Change log, `builder-reference.md` mirror row, `release-readiness-checklist.md`.
9. Emit commit blocks. Never commit.
