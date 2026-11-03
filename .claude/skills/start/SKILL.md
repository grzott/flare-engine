---
name: start
description: Turn one GitHub issue into one PR on a claude/* branch. `next` is runner mode (takes the next approved issue, no approval stop); an issue number is interactive (presents the plan, waits for approval). Routes to engine-builder or game-builder, gates with verify.sh, commits, pushes and opens the PR.
argument-hint: "next | <issue-number>"
---

# /start

One issue in, one pull request out. The queue is GitHub Issues: an issue is approved when the owner
gives it `status:ready` (a phase is approved by labelling its milestone's issues) — never add that
label yourself.

Use `gh api` for every GitHub read and write: cloud sessions block `gh pr` and `gh issue`.
`{owner}/{repo}` placeholders are filled from the git remote by `gh api` itself. `BOT_LOGIN` comes
from the environment (`scripts/runner/claude-as-bot.sh` or `runner.yml`); use it only inside a
`--jq` filter as `env.BOT_LOGIN` — never echo or print the environment. Run git commands bare: no
`2>&1`, `> file` or other redirects (the guard reads a redirect's `&` as a command separator and
refuses the command); pipe to `tail` if output is long.

One command per Bash call. The allow list in `.claude/settings.json` is checked against every part
of a compound command, so `a; echo ---; b` or a pipe into an unlisted tool is denied as a whole.
Read files with Read, Grep or `cat` (a dependency's version and engines: Read
`node_modules/<name>/package.json`), not `node -e`.

In runner mode (`next`) nobody reads a question. Never end a turn asking for permission or for a
decision: a denied command you cannot replace with an allowed one is a stop, handled as in Step 5.

Runner sentinels — print exactly one, as the last line, so `scripts/runner/loop.sh` can branch on it:
`RUNNER: PR OPENED #<pr>` · `RUNNER: QUEUE EMPTY` · `RUNNER: PR IN FLIGHT #<pr>` · `RUNNER: BLOCKED #<issue>`.

## Step 1 — One issue at a time

1. **An open bot PR on a `claude/*` branch** — `gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100"
   --jq '.[] | select(.user.login == env.BOT_LOGIN and (.head.ref | startswith("claude/"))) |
   [.number, .head.sha] | @tsv'`. The release PR (`changeset-release/main`) is the bot's too but
   waits for the owner's release, so it never counts. For the claude/* PR, list failed checks:
   `gh api "repos/{owner}/{repo}/commits/<sha>/check-runs" --jq '.check_runs[] | select(.conclusion
   == "failure") | .name'`.
   - `ci` failed, or `risk-gate` failed while the PR carries `risk:auto` (the review asked for
     changes or gave no verdict) → it will not merge on its own. Unless the PR's latest comment
     already says so, comment `@grzott blocked: <check> failed`. Print `RUNNER: BLOCKED #<pr>`, stop.
   - Otherwise (checks running, or `risk:held` waiting for the owner) → print
     `RUNNER: PR IN FLIGHT #<pr>`, stop.
2. **An open issue labelled `status:in-progress` with no open PR** — read when that label was added:
   `gh api "repos/{owner}/{repo}/issues/<n>/events" --jq '[.[] | select(.event == "labeled" and
   .label.name == "status:in-progress")] | last | .created_at'`.
   - **Less than 2 hours ago** → another runner is working on it right now. Print
     `RUNNER: PR IN FLIGHT #<n>`, stop. Never take over a fresh claim.
   - **2 hours or more** (longer than any run's timeout) → that run was interrupted. Resume the issue:
     skip Steps 2–3 and take the resume path in Step 4.

## Step 2 — Pick the issue

- **A number** → that issue; interactive mode.
- **`next`** → open issues labelled `status:ready`
  (`gh api "repos/{owner}/{repo}/issues?state=open&labels=status:ready&per_page=100"`, skipping
  entries that carry a `pull_request` key). Order by milestone `due_on` ascending (no milestone last),
  then `priority:p1` < `p2` < `p3` (none last), then issue number. Take the first and **claim it at
  once**: swap its `status:ready` for `status:in-progress` before anything else, so a second runner
  sees it as taken.
- **None ready** → if a milestone now has no open issue other than its `type:phase` issue, comment on
  that issue `@grzott phase <milestone title> complete` and close it. Print `RUNNER: QUEUE EMPTY`.

## Step 3 — Large work needs a design first

A `size:l` issue must carry a line `Design: <repo path>` naming a file that exists. Otherwise: swap
`status:in-progress` for `status:blocked`, comment `@grzott needs a brainstorm and design doc before
work starts`, print `RUNNER: BLOCKED #<n>`, stop.

## Step 4 — Branch

`git status --porcelain` must print nothing. If it does, a previous run left edits behind: comment
`@grzott blocked: the working tree is dirty` on the issue, print `RUNNER: BLOCKED #<n>`, stop — never
carry one issue's edits into another's branch.

Then `git fetch origin` and look for an existing branch with
`git ls-remote --heads origin "claude/issue-<n>-*"`:

- **Resume** (a branch exists on origin): switch to it with `-c <branch> origin/<branch>`, then
  continue from what its commits already did.
- **Fresh**: switch with `-c claude/issue-<n>-<slug> origin/main`, where `<slug>` is the issue title
  in lowercase kebab case, at most 40 characters.

## Step 5 — Plan and implement

Scope from the issue's `scope:` label or the paths it names: `packages/**` → **engine-builder**;
`apps/<game>/**` → **game-builder**; both → mixed, engine half first. The builder:

1. Reads `docs/plans/roadmap.md`, the issue, and its design doc if it has one.
2. **Verifies every path the issue names exists** (Glob) — name the real file, not the issue's guess.
3. If the change adds a user-facing string, declares the localization cascade upfront:
   `src/localization/keys.ts` + `locales/en.json` + `locales/pl.json`.
4. If it adds or renames an export in `packages/render` or `packages/react`, includes the mock-stub
   updates in `packages/react/tests/{game-view,safe-area}.test.ts`.
5. Implements test-first, exactly the plan, no drive-by changes.

**Interactive mode only:** present the plan and stop for the owner's approval before implementing.

Gate: `bash .claude/hooks/verify.sh <engine|game|mixed>`, in the foreground with the Bash tool's
`timeout` at 900000 (15 minutes; the runners raise the cap). A command that outlives its timeout
moves to the background. Then wait for its completion notice and read its output. Never end the
turn while a command still runs: in a headless run, ending the turn ends the session and kills the
gate. On failure fix and re-run — at most two fix
attempts. Still red → swap to `status:blocked`, comment the failing gate's last 30 lines mentioning
`@grzott`, print `RUNNER: BLOCKED #<n>`, stop.

Any other stop is blocked too: a denied command, a claim the issue asks you to verify that you
cannot, a plan that does not fit the issue. Swap `status:in-progress` for `status:blocked`, comment
`@grzott blocked: <what stopped you>` on the issue (quote a denied command exactly), print
`RUNNER: BLOCKED #<n>`, stop. A run never ends with the issue claimed and no PR, comment or sentinel.

## Step 6 — Commit, push, open the PR

1. Commit: a Conventional Commit subject, at most 72 characters, no body, no `Co-Authored-By`
   trailer. `git add <files>`, then `git commit -m "<subject>"`.
2. `git push -u origin claude/issue-<n>-<slug>`.
3. Write the PR body from `.github/PULL_REQUEST_TEMPLATE.md` to `.superpowers/pr-body.md` (inside
   the repo and gitignored, so writing it needs no permission and it is never committed) with the
   Write tool — `Closes #<n>`, a summary, the verification you ran with its results, the expected
   risk class and why, and the frictions line (grammar in the `/close` skill) — then:

   ```bash
   gh api repos/{owner}/{repo}/pulls -f title="<subject>" -f head="claude/issue-<n>-<slug>" -f base=main -F body=@.superpowers/pr-body.md
   ```

4. Swap the issue's `status:in-progress` for `status:in-review`.
5. Print `RUNNER: PR OPENED #<pr>`.

Never merge, approve or label a PR: `risk-gate`, `review` and `auto-merge` own that.
