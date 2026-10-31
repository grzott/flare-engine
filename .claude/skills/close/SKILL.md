---
name: close
description: Finish hand-started work as a PR. Runs the gate (.claude/hooks/verify.sh), moves the work to a claude/* branch if it is on main, commits, pushes, and opens the PR with the frictions self-report in its body. Issue-driven work uses /start instead.
argument-hint: "[\"subject\"] [scope=engine|game|mixed]"
---

# /close

End a piece of work that did not start from `/start` — an ad-hoc fix, a doc pass, a spike being
kept. The result is a PR; the PR description is the session record (SESSION_LOG.md is frozen).

## Step 1 — Subject and scope

If the user passed both, use them. Otherwise:
- **Subject:** a Conventional Commit subject for the change, at most 72 characters.
- **Scope:** from `git diff --name-only`: all `packages/**` → `engine`; all `apps/<game>/**` →
  `game`; both → `mixed`.

Confirm subject and scope with the user before running the gate.

## Step 2 — Compose the frictions line

One honest line, self-reported. Categories:

| Tag | Meaning |
|---|---|
| `corr:N` | user corrected the approach/plan mid-session |
| `deny:N` | permission prompts denied or guard-hook blocks hit |
| `gate:N` | verify gate failures fixed before green |
| `fixup:N` | user manually edited files mid-session |
| `drift:N` | files touched beyond the approved plan |

Format: `corr:1 (asked for X not Y); gate:2 (lint, test)` — or `none`. Be honest; it goes into the
PR body, feeds `/retro`, and is the only record of these events.

## Step 3 — Gate

```bash
bash .claude/hooks/verify.sh <engine|game|mixed>
```

`.claude/hooks/verify.sh` holds the authoritative, order-accurate gate list. On failure fix and
re-run; count each failure in `gate:N`.

## Step 4 — Branch, commit, push, PR

1. If on `main`: `git switch -c claude/<slug>` (slug from the subject, kebab case, at most 40
   characters). The work moves with you.
2. `git add <files>`, then `git commit -m "<subject>"` — no body, no `Co-Authored-By` trailer.
3. `git push -u origin claude/<slug>`.
4. Fill `.github/PULL_REQUEST_TEMPLATE.md` into a temp file (summary, verification with results,
   expected risk class, frictions line), then:

   ```bash
   gh api repos/{owner}/{repo}/pulls -f title="<subject>" -f head="claude/<slug>" -f base=main -F body=@<file>
   ```

5. Print the PR URL. Never merge, approve or label it.
