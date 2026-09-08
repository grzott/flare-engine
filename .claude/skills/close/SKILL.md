---
name: close
description: Close the current session (or current batch row). Runs verify.sh, the full gate script (lint, typecheck, test, build, and more — see the script for the authoritative list), appends a SESSION_LOG block with a frictions self-report, and emits paste-ready commit bash blocks.
argument-hint: "[\"goal\"] [scope=engine|game|mixed]"
---

# /close

End the current session (or close one row of a `/start` batch).

## Step 1 — Determine goal + scope

If the user passed both arguments, use them. Otherwise:
- **Goal:** read the active row from `docs/plans/todo.md` and use its title.
- **Scope:** infer from `git diff --name-only`:
  - All changes under `packages/**` → `engine`
  - All changes under `apps/<game>/**` → `game`
  - Both → `mixed`

Confirm goal + scope with the user before running the gate (skip this confirmation inside
an approved `/start` batch — the batch approval covered it).

## Step 2 — Compose the frictions line

One honest line, self-reported, before running the gate. Categories:

| Tag | Meaning |
|---|---|
| `corr:N` | user corrected the approach/plan mid-session |
| `deny:N` | permission prompts denied or guard-hook blocks hit |
| `gate:N` | verify gate failures fixed before green |
| `fixup:N` | user manually edited files mid-session |
| `drift:N` | files touched beyond the approved plan |

Format: `corr:1 (asked for X not Y); gate:2 (lint, test)` — or `none`. Be honest; this
feeds `/retro` and is the only record of these events.

## Step 3 — Run verify.sh

```bash
bash .claude/hooks/verify.sh "<goal>" "<scope>" "<frictions>"
```

The script runs, in order (engine/mixed scope; `game` scope skips the build-dependent gates marked *):
1. `bun run lint` (zero errors required)
2. `bun run typecheck` (zero errors required)
3. `bun run test` (all pass)
4. `bun run build`* — engine + mixed only
5. `bun run typecheck:tests`* — engine + mixed only
6. `bun run check:deps`
7. `bun run check:changeset`
8. `bun run check:peers`
9. `bun run check:bump`
10. `bash .claude/hooks/pre-bash-guard.test.sh`
11. `bun run check:perf`* — engine + mixed only
12. `bun run check:perf-freshness`* — engine + mixed only

`.claude/hooks/verify.sh` is the authoritative, order-accurate list — re-check it if this drifts.

On gate failure, the script halts and exits non-zero. Fix the failure and re-run `/close`.
The session block is **not** appended on failure (count the failure in `gate:N`).

## Step 4 — Post-close

The script appends a session block to `SESSION_LOG.md` and prints a paste-ready commit
block to stdout. The user runs the commit. If splitting into multiple commits is
appropriate (e.g., feat + test + docs), the user edits the block before running it.

## Step 5 — Update todo.md

Move the closed row from `## Active` to `## Done` (or delete it if uninteresting). Add the
next active row if known. No supersession ceremony — just edit the file.
