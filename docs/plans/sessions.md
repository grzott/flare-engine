# Sessions — unified 10–20 session slice

Short-horizon, executable session plan. Sits between the long-horizon roadmaps ([`build-plan.md`](build-plan.md) for the engine, [`pan-tvardowski-build-plan.md`](pan-tvardowski-build-plan.md) for the current game) and daily work.

**Rules of the artifact:**
- One row per session (≈ 2–6 h of implementation, one gate cycle, 1–4 commits).
- Scope tag is exactly one of `[engine]`, `[game]`, `[mixed]`.
- Rows are append-only — statuses move forward (`pending` → `in_progress` → `done` or `blocked`), rows are never deleted or renumbered.
- Row shape and field conventions: [sessions/_template.md](sessions/_template.md).
- Planner protocol: [sessions/_planner-protocol.md](sessions/_planner-protocol.md).

**Owned by:** `engine-planner` (engine rows), `game-planner` (game rows), both planners jointly (mixed rows). Status flips during execution are written by `engine-builder` / `game-builder` via `/session-start` and by `verifier` via `/session-close`.

**Read by:** `engine-builder`, `game-builder`, `verifier`, and the `session-start.sh` hook.

---

## Active slice

| # | status | scope | goal | touched paths | gates | target commits | depends on | opened | closed |
|---|--------|-------|------|---------------|-------|----------------|------------|--------|--------|
| _ | _ | _ | _(run `/plan-sessions` to populate)_ | _ | _ | _ | _ | _ | _ |

## Archive

Closed rows accumulate above as `done`. Leave them in place — they form the executable changelog that mirrors `SESSION_LOG.md`.

## Definitions

| Status | Meaning |
|--------|---------|
| `pending` | Planned, not started. Builder may claim via `/session-start`. |
| `in_progress` | A builder claimed it. Has an `opened` date. |
| `done` | Gates green + docs synced + commit blocks emitted. Has a `closed` date. |
| `blocked` | Waiting on another session (`depends on`) or an external factor. Move back to `pending` once unblocked. |

| Scope | Owner | Touches |
|-------|-------|---------|
| `[engine]` | engine-builder | `packages/**`, engine-reference docs |
| `[game]` | game-builder | `apps/<game>/**`, the game's build plan + mirror row |
| `[mixed]` | both | engine package + game consumer in one session — engine half first, game half second |
