---
description: "Canonical session-close summary format written to SESSION_LOG.md by the verifier agent at the end of every /session-close. Shared contract between Claude Code and GitHub Copilot."
applyTo: "SESSION_LOG.md,docs/plans/sessions.md"
---

# Session close — canonical format

Every `/session-close` run, after all gates green and doc-sync checked, appends one block to [../../SESSION_LOG.md](../../SESSION_LOG.md) in the exact shape below.

Written by the `verifier` agent. Never edit prior blocks.

## Block template

```markdown
## Session N — YYYY-MM-DD (scope: [engine|game|mixed])

**Goal (from sessions.md row #N):** <goal text verbatim from the session row>

**Touched files**
- `<repo-root-relative path 1>`
- `<repo-root-relative path 2>`
- …

**Gates**
- lint: ✅ (or ❌ + trimmed error)
- typecheck: ✅
- test: ✅ (+<N> new, total <total>)
- build: ✅
- device smoke: ✅ (user-confirmed YYYY-MM-DD) — omit line if scope=[engine]

**Docs synced**
- `docs/references/builder-reference.md` — <specific row/section updated>
- `docs/plans/build-plan.md` — <phase note appended, or "no change">
- `docs/plans/<game>-build-plan.md` §17 — <boxes ticked> — omit if scope=[engine]
- `docs/plans/release-readiness-checklist.md` — <items ticked, or "no new ticks"> — omit if scope=[engine]

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(<scope>): <subject>`
2. `test(<scope>): <subject>`
3. `docs(<scope>): <subject>`

**Next session:** #<N+1> "<title from sessions.md>" — or "no next session, run /plan-sessions."

---
```

## Invariants

- Heading is `## Session N — YYYY-MM-DD` exactly. The hook and the planner both grep for this format.
- Scope tag in the heading must match the `sessions.md` row exactly.
- `Goal` text is copied verbatim from the session row. Do not rephrase.
- `Touched files` lists only files in the diff. If a file was touched outside the session's declared `touched paths`, that's a drift — the verifier refuses to close until surfaced.
- `Gates` lists all four (plus device smoke for game/mixed). A ❌ in any slot means the session is not closed.
- `Docs synced` is evidence, not a promise. Every bullet must reference an actual edit.
- `Commits` is subject-only; the full `git add` + `git commit -m` blocks live higher in chat.
- `Next session` is copied from `sessions.md`. If the next row is `blocked`, include the `depends on` reference.

## Anti-patterns

- Vague gate status ("all green" instead of each gate listed) — reject.
- "Docs synced: yes" — reject. Name the file and the specific update.
- Session block appended without flipping the `sessions.md` row to `done` — reject. Both writes happen in the same verifier turn.
- Editing a prior session block to "fix" something — reject. Append a new correction block instead.

## Scope interactions

- `[engine]` — skip device smoke line, skip game-plan doc-sync line.
- `[game]` — include device smoke line; the game-plan §17 line is mandatory.
- `[mixed]` — include all lines. Two commit-subject groups may appear (engine scope + game scope). Both builders' gates must have run.
