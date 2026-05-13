---
description: Close the current session. Runs verify.sh which executes lint -> typecheck -> test -> build, appends a SESSION_LOG block, and emits paste-ready commit bash blocks.
argument-hint: "[\"goal\"] [scope=engine|game|mixed]"
---

# /close

End the current session.

## Step 1 — Determine goal + scope

If the user passed both arguments, use them. Otherwise:
- **Goal:** read the active row from `docs/plans/todo.md` and use its title.
- **Scope:** infer from `git diff --name-only`:
  - All changes under `packages/**` → `engine`
  - All changes under `apps/<game>/**` → `game`
  - Both → `mixed`

Confirm goal + scope with the user before running the gate.

## Step 2 — Run verify.sh

```bash
bash .claude/hooks/verify.sh "<goal>" "<scope>"
```

The script runs:
1. `bun run lint` (zero errors required)
2. `bun run typecheck` (zero errors required)
3. `bun run test` (all pass)
4. `bun run build` — engine + mixed only

On gate failure, the script halts and exits non-zero. Fix the failure and re-run `/close`. The session block is **not** appended on failure.

## Step 3 — Post-close

The script appends a session block to `SESSION_LOG.md` and prints a paste-ready commit block to stdout. The user runs the commit. If splitting into multiple commits is appropriate (e.g., feat + test + docs), the user edits the block before running it.

## Step 4 — Update todo.md

Move the closed row from `## Active` to `## Done` (or delete it if uninteresting). Add the next active row if known. No supersession ceremony — just edit the file.
