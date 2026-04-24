---
description: Build the next engine phase — reads current state, identifies next unfinished phase from docs/plans/build-plan.md, implements with per-module verification. Thin wrapper over the engine-builder workflow; prefer /session-start for session-sized work.
---

# /build-next

Implement the next unfinished phase from [docs/plans/build-plan.md](../../docs/plans/build-plan.md) via the `engine-builder` agent.

Full protocol lives in [.github/prompts/build-next.prompt.md](../../.github/prompts/build-next.prompt.md) — this command loads it and dispatches.

## When to use this vs. /session-start

- `/build-next` — full-phase delivery (multiple packages, long run). Use when catching up phases, not for daily development.
- `/session-start` — one session from `docs/plans/sessions.md` (2–6 h unit). **Preferred for day-to-day work.**

## Protocol

1. Verify state per [.github/instructions/status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md).
2. Identify the lowest phase with unfinished packages.
3. Order modules by dependency.
4. Per module: implement → export → test → next.
5. Phase gate: `bun run typecheck && bun run lint && bun run build && bun run test`.
6. Sync docs: update `builder-reference.md` Current State + `build-plan.md` Phase Summary + dated phase note.
7. Emit paste-ready commit blocks. Never commit.
