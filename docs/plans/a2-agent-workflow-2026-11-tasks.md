# A2 — Agent PR Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents take GitHub issues one at a time and turn each into a PR as a bot account; checks and
an independent reviewer gate every PR; low-risk PRs merge themselves; held PRs wait for one owner tap
from GitHub mobile — with or without the workstation running.

**Architecture:** A risk classifier plus three workflows (`risk-gate`, `review`, `auto-merge`) enforce
the policy in GitHub, behind a ruleset that requires the `ci`, `risk-gate` and `review` statuses. The
local harness lets agents commit and push only `claude/*` branches. Two runners feed the queue: a local
`claude -p` loop (workstation on) and a `runner.yml` workflow chained on merges (workstation off).

**Tech Stack:** GitHub rulesets / REST API, GitHub Actions, `anthropics/claude-code-action@v1`
(subscription OAuth token), Bun 1.3.11 scripts + `bun:test`, the existing Python-in-bash guard.

**Spec:** `docs/plans/_local/roadmap-design-2026-10-30.md` §6 and decisions D11–D16, D18, D22, D23
(private). Mechanics verified against code.claude.com docs on 2026-10-30 (design §6.7).

## Global Constraints

- Every agent push, commit and PR acts as the bot account (D18); the owner approves as `@grzott`.
- Agent branches are `claude/<…>` only. Merges are squash, PR title = commit subject, empty body.
- Required checks, exactly: `ci` and `risk-gate`, both pinned to the GitHub Actions app
  (integration 15368) so no personal token can forge them. *(Final-review fix: the plan's original
  three commit statuses could be posted by the bot's own token — see `gate.yml`.)*
- Held classes follow design §6.3; harness, workflow and agent-rule files are always held (D12).
- The engine repo is public: committed files carry nothing from the private design beyond engine work (D22).
- Tasks 2–6 change the harness that forbids agent commits, so the owner commits them; from Task 7 on,
  work goes through the new flow.
- Builders run on `model: fable`; the reviewer runs on `opus` (independence from the builder).
- Bun `1.3.11` in every workflow and setup script. Commits: Conventional Commits ≤72, no body, no
  `Co-Authored-By`.

## Review Focus

1. **A PR from a fork** (a stranger) gets no secrets, so `risk-gate` and `review` never post and the
   PR can't satisfy the ruleset. Expected: workflows skip forks silently and the owner merges with the
   admin bypass. Pinned in Task 9 Step 6 (the bot opens a PR from its own fork).
2. **Two runners at once** (the local loop and `runner.yml`) opening two PRs. Expected: `/start next`
   refuses while a bot PR is open; `runner.yml` has a concurrency group. Pinned in Task 8 Step 2 and
   Task 9 Step 4.
3. **A breaking change with no `export` on the changed line** (an interface member) passes the
   classifier as auto. Expected: the reviewer flags it held. Pinned in Task 2 Step 1 (a test documents
   the limit) and the reviewer prompt in Task 3.
4. **A usage limit mid-issue.** Expected: the loop pauses and retries, never leaves two branches for one
   issue. Pinned in Task 8 Step 2.
5. **A push to `main` or a force-push** by an agent. Expected: blocked locally by the guard and remotely
   by the ruleset. Pinned in Task 5 Step 1 and Task 9 Step 7.

---

### Task 1: Accounts, tokens and settings (owner)

**Files:** none (creates the untracked `~/.config/flare-bot/env`).

- [ ] **Step 1: GitHub Pro** — upgrade the `grzott` account.
  Verify: `gh api user --jq .plan.name` prints `pro`.
- [ ] **Step 2: Bot account** — create a new GitHub user (login your choice, e.g. `grzott-agent`), turn
  on 2FA, invite it with Write to `flare-engine`, `Pan-Tvardowski`, `berekthegame`, `flare-engine-page`,
  `grzott-portfolio`; accept from the bot.
  Verify: `gh api repos/grzott/flare-engine/collaborators/<bot> -i | head -1` prints `HTTP/2.0 204` (repeat
  per repo).
- [ ] **Step 3: Bot token** — as the bot, a classic PAT with scope `repo` only — **never `workflow`**:
  without it GitHub rejects any bot push that touches `.github/workflows/`, which is what stops an
  agent PR from rewriting the gate that judges it. 1-year expiry (fine-grained tokens cannot target
  another user's repos).
- [ ] **Step 4: Secrets and variables on the engine repo** — Actions secret `BOT_TOKEN` and Dependabot
  secret `BOT_TOKEN` (same PAT); Actions secret `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`;
  Actions variables `BOT_LOGIN` = the bot login and `BOT_ID` = `gh api users/<bot> --jq .id`. Install
  the Claude GitHub App on the five repos.
  Verify: `gh secret list` shows `BOT_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`; `gh variable list` shows
  `BOT_LOGIN`, `BOT_ID`.
- [ ] **Step 5: Local bot identity** — `GH_CONFIG_DIR=~/.config/gh-bot gh auth login --with-token <
  <pat-file>`, then create `~/.config/flare-bot/env` with `BOT_LOGIN=…`, `BOT_NAME=…`,
  `BOT_EMAIL=<id>+<login>@users.noreply.github.com`, `GH_CONFIG_DIR=$HOME/.config/gh-bot`.
  Verify: `GH_CONFIG_DIR=~/.config/gh-bot gh api user --jq .login` prints the bot login.
- [ ] **Step 6: Phone** — GitHub mobile signed in as `grzott`, push on for review requests and mentions.
- [ ] **Step 7: Default token read-only** — Settings → Actions → General → Workflow permissions →
  "Read repository contents and packages permissions", and leave "Allow GitHub Actions to create and
  approve pull requests" off. Workflows that need more ask for it per job.

---

### Task 2: Risk classifier

**Files:**
- Create: `scripts/classify-pr-risk.mjs`, `scripts/classify-pr-risk.d.mts`
- Create: `.github/risk-policy.json`
- Create: `scripts/tests/classify-pr-risk.test.ts`
- Modify: `package.json` (script `test:scripts`), `.github/workflows/ci.yml` (step after `bun run test`)

**Interfaces:**
- Produces:

```ts
export type ChangedFile = { path: string; status: 'A' | 'M' | 'D' | 'R'; added: string[]; removed: string[] };
export type DepChange = { manifest: string; name: string; from: string; to: string };
export type ClassifyInput = {
  files: ChangedFile[];
  changesetLevels: Array<'patch' | 'minor' | 'major'>;
  depChanges: DepChange[];
  labels: string[];
};
export type RiskPolicy = { heldGlobs: string[]; exportScopeGlobs: string[] };
export type RiskVerdict = { risk: 'auto' | 'held'; reasons: string[] };
export function classifyPrRisk(input: ClassifyInput, policy: RiskPolicy): RiskVerdict;
export function isMajorBump(from: string, to: string): boolean;
```

CLI: `bun scripts/classify-pr-risk.mjs --base <sha> --head <sha> [--labels a,b] [--policy <path>]`
prints the `RiskVerdict` as JSON and exits 0 (held is a verdict, not an error); exit 2 on bad arguments.

- [ ] **Step 1: Write the failing tests** — `scripts/tests/classify-pr-risk.test.ts`, `describe`/`it`
  from `bun:test` (the style of `scan-history.test.ts`; do not mix `test` and `it`). Policy fixture =
  `.github/risk-policy.json`. Cases:
  - `auto for a src fix with no export line` — `packages/math/src/vec2.ts` M, added `'  return a * t;'`
    → `{ risk: 'auto', reasons: [] }`
  - `held when a file is deleted` — D `packages/x/src/a.ts` → reasons contain `'deletes packages/x/src/a.ts'`
  - `held when a rename removes a path` — R → reasons contain `'renames packages/x/src/a.ts'`
  - `held for a held path` — M `.claude/hooks/pre-bash-guard.sh` → reasons contain
    `'held path .claude/hooks/pre-bash-guard.sh'`
  - `held when an export line changes in package src` — added
    `'export function lerp(a: number, b: number, t: number): number {'` in `packages/math/src/vec2.ts` →
    a reason starting `'export change'`
  - `auto when export text changes outside src scope` — `docs/recipes/x.md` added `'export const a = 1'`
    → auto
  - `interface member change without export stays auto (reviewer must catch)` — added `'  readonly
    mask: Int32Array;'` in `packages/ecs/src/query.ts` → auto (documents the limit)
  - `held for a minor changeset` → reasons contain `'changeset level minor'`
  - `held for a major dependency bump` — `sharp` `^0.34.5`→`^0.35.5` → reasons contain
    `'major bump sharp ^0.34.5 -> ^0.35.5'`
  - `held stays held when the risk:held label is present` → reasons contain `'risk:held label'`
  - `isMajorBump` table: `('^0.34.5','^0.35.5')` true; `('^1.2.0','^1.3.0')` false; `('^1.2.0','^2.0.0')`
    true; `('~57.0.0','~58.0.0')` true; `('0.4.5','0.4.6')` false; `('workspace:*','workspace:*')` false;
    `('github:a/b','github:a/c')` true (non-semver is treated as major).
- [ ] **Step 2: Run to see them fail** — `bun test scripts/tests/classify-pr-risk.test.ts` → FAIL, module
  not found.
- [ ] **Step 3: Implement** `classifyPrRisk` and `isMajorBump` in `scripts/classify-pr-risk.mjs`. Glob
  matching with `new Bun.Glob(pattern).match(path)`. Export-line rule: a changed line matching
  `/^\s*export\b/` in a file matching `exportScopeGlobs`. For `0.x` ranges a minor change counts as
  major. The CLI reads `git diff --name-status -M <base>...<head>`, `git diff -U0 <base>...<head> -- <path>`
  per file, changeset levels from added/modified `.changeset/*.md` frontmatter (skip `README.md`), and
  dependency changes by parsing `git show <base>:<manifest>` vs `<head>` for every changed
  `package.json` (all four dependency fields). Write the `.d.mts` for the test's typecheck.
- [ ] **Step 4: Policy** — `.github/risk-policy.json`:

```json
{
  "heldGlobs": [".claude/**", "AGENTS.md", "CLAUDE.md", ".github/**", ".husky/**",
    "docs/design/adr-*.md", ".changeset/config.json", "LICENSE", "**/LICENSE", "NOTICE", "**/NOTICE",
    "TRADEMARK.md", "README.md", "SECURITY.md", "**/CHANGELOG.md", "package.json", "biome.json",
    "tsconfig.json", "turbo.json", ".perf-baseline.json", "scripts/check-*.mjs",
    "scripts/classify-pr-risk.mjs", "scripts/audit-tarballs.mjs", "scripts/scan-history.mjs"],
  "exportScopeGlobs": ["packages/*/src/**"]
}
```

- [ ] **Step 5: Run the tests** — `bun test scripts/tests/classify-pr-risk.test.ts` → PASS.
- [ ] **Step 6: Wire `scripts/tests` into CI** — root script `"test:scripts": "bun test scripts/tests"`;
  in `ci.yml` add `- run: bun run test:scripts` after `bun run test`. Run `bun run test:scripts` → all
  pass (56 existing + the new file). This also closes the "scripts/tests run by nothing" audit item.
- [ ] **Step 7: CLI smoke** — `bun scripts/classify-pr-risk.mjs --base HEAD~5 --head HEAD` → valid JSON
  with `risk` and `reasons`.
- [ ] **Step 8: Gate + commit (owner)** — `bash .claude/hooks/verify.sh "feat(scripts): pr risk classifier" mixed "none"`, then:

```bash
git add scripts/classify-pr-risk.mjs scripts/classify-pr-risk.d.mts .github/risk-policy.json
git add scripts/tests/classify-pr-risk.test.ts package.json .github/workflows/ci.yml SESSION_LOG.md
git commit -m "chore(scripts): add pr risk classifier and run script tests in ci"
```

---

### Task 3: Gate, review and auto-merge workflows

**Files:**
- Create: `.github/workflows/risk-gate.yml`, `.github/workflows/review.yml`,
  `.github/workflows/auto-merge.yml`, `.github/review-prompt.md`
- Modify: `.github/workflows/ci.yml` (the `check:perf-freshness` step)

**Interfaces:**
- Consumes: Task 2's CLI; secrets/variable from Task 1.
- Produces: commit statuses `risk-gate` and `review` on each PR head SHA; labels `risk:auto` /
  `risk:held`.

- [ ] **Step 1: Confirm action inputs** — read the `anthropics/claude-code-action` v1 README and note
  the exact input names for the OAuth token, the GitHub token, the prompt, and extra CLI args (model,
  allowed tools). Use those names below.
- [ ] **Step 2: `risk-gate.yml`**
  - `on:` `pull_request` [opened, synchronize, reopened, labeled, unlabeled, ready_for_review];
    `pull_request_review` [submitted, dismissed].
  - Job `if`: the PR head repo equals `github.repository` (forks skip — Review Focus 1).
  - `GH_TOKEN: ${{ secrets.BOT_TOKEN }}` for every API write (works on Dependabot PRs via the
    Dependabot secret).
  - Steps: checkout `fetch-depth: 0`; setup-bun `1.3.11`; run the classifier with the PR's base and
    head SHAs and current labels; if the PR author is neither `vars.BOT_LOGIN` nor `dependabot[bot]`,
    force `held` with reason `not authored by the agent bot`; set label `risk:auto` or `risk:held` only
    if it differs from the current one; when held and `grzott` has neither a pending request nor an
    approval, request `grzott`'s review.
  - Status `risk-gate` on the head SHA: `success` "auto" when auto; `success` "held — approved by owner"
    when the latest `grzott` review on this head SHA is `APPROVED`; otherwise `pending` with the
    reasons joined, truncated to 140 chars. When the owner approved, also set `review` to `success`
    "owner approval overrides reviewer".
- [ ] **Step 3: `review.yml` + `review-prompt.md`**
  - `on:` `pull_request` [opened, synchronize, reopened, ready_for_review]; skip drafts and forks.
  - Job `dependabot` (author `dependabot[bot]`): set `review` = `success` "dependabot — CI is the check".
  - Job `review` (otherwise): permissions `contents: read`, `pull-requests: write`, `issues: write`,
    `statuses: write`, `id-token: write`; run the action with the OAuth token, model `opus`, read-only
    tools plus `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git show:*)`, `Write`, and the prompt file.
  - The prompt (`review-prompt.md`): review the diff for correctness against `AGENTS.md`; verify any
    claim the PR body makes at HEAD before repeating it; decide whether the change is breaking (an
    exported type, member, signature or documented contract changed — including interface members the
    classifier cannot see); post one PR comment with findings; write `review-verdict.json` at the
    workspace root as `{ "verdict": "pass" | "changes" | "held", "summary": string }`.
  - Final step (always runs, `BOT_TOKEN`): missing file → `changes` "reviewer produced no verdict";
    `pass` → `review` `success`; `changes` → `failure` with the summary; `held` → `pending` "breaking
    suspected — owner review requested" and add label `risk:held` (that re-runs `risk-gate`).
- [ ] **Step 4: `auto-merge.yml`** — `on: pull_request` [opened, reopened, ready_for_review]; when the
  author is `vars.BOT_LOGIN` or `dependabot[bot]` and the head repo is this repo, run
  `gh pr merge <number> --auto --squash` with `GH_TOKEN: ${{ secrets.BOT_TOKEN }}`.
- [ ] **Step 5: Perf freshness leaves the PR path** — in `ci.yml`, give the `check:perf-freshness`
  step `if: github.event_name == 'push'` and `continue-on-error: true`, with a comment: release-time
  gate is `release.yml`; on `main` it is informational.
- [ ] **Step 6: Parse check** — run
  `bun -e 'const fs=require("fs");for(const f of fs.readdirSync(".github/workflows"))Bun.YAML.parse(fs.readFileSync(".github/workflows/"+f,"utf8"));console.log("ok")'`
  → `ok`.
- [ ] **Step 7: Commit (owner)**

```bash
git add .github/workflows/risk-gate.yml .github/workflows/review.yml .github/review-prompt.md
git add .github/workflows/auto-merge.yml .github/workflows/ci.yml
git commit -m "ci: add risk gate, agent review and auto-merge workflows"
```

---

### Task 4: Ruleset, repo settings, CODEOWNERS, labels

**Files:**
- Create: `.github/rulesets/main.json`, `.github/labels.json`, `scripts/github/sync-labels.mjs`,
  `scripts/tests/sync-labels.test.ts`
- Modify: `.github/CODEOWNERS`

**Interfaces:**
- Produces: `planLabelChanges(existing: Label[], desired: Label[]): { create: Label[]; update: Label[] }`
  with `type Label = { name: string; color: string; description: string }`.

- [ ] **Step 1: Failing test** — `sync-labels.test.ts`: `creates a missing label`, `updates a label whose
  color or description differs`, `leaves an identical label alone`, `never deletes labels it does not
  know` (existing extra label → absent from both lists).
- [ ] **Step 2: Run** — `bun test scripts/tests/sync-labels.test.ts` → FAIL.
- [ ] **Step 3: Implement** `planLabelChanges` and a CLI `bun scripts/github/sync-labels.mjs <owner/repo>`
  that reads `.github/labels.json`, lists labels via `gh api --paginate`, and applies the plan via
  `gh api` POST/PATCH.
- [ ] **Step 4: Labels** — `.github/labels.json`: `status:ready`, `status:in-progress`,
  `status:in-review`, `status:blocked`; `risk:auto`, `risk:held`; `size:s`, `size:m`, `size:l`;
  `priority:p1`, `priority:p2`, `priority:p3`; `type:phase`, `type:deadline`, `type:defect`,
  `type:verification`, `type:hygiene`, `type:feature`, `type:owner-action`, `type:perf`;
  `scope:engine`, `scope:demo`, `scope:harness`, `scope:docs`. One color per family.
- [ ] **Step 5: Run** — `bun test scripts/tests/sync-labels.test.ts` → PASS.
- [ ] **Step 6: Ruleset file** — `.github/rulesets/main.json`: target `branch`, enforcement `active`,
  include `~DEFAULT_BRANCH`; rules `deletion`, `non_fast_forward`, `pull_request`
  (`required_approving_review_count: 0`, `require_code_owner_review: false`,
  `dismiss_stale_reviews_on_push: false`, `require_last_push_approval: false`,
  `required_review_thread_resolution: false`), `required_status_checks`
  (`strict_required_status_checks_policy: false`; contexts `ci`, `risk-gate`, `review`); bypass actor
  RepositoryRole admin (`actor_id: 5`), `bypass_mode: "always"`.
- [ ] **Step 7: CODEOWNERS** — replace `* @grzott` with the held globs from `.github/risk-policy.json`,
  each mapped to `@grzott`, so review requests arrive only where a tap is needed.
- [ ] **Step 8: Gate + commit (owner)** — `bun run test:scripts && bun run lint` → green, then:

```bash
git add .github/rulesets/main.json .github/labels.json .github/CODEOWNERS
git add scripts/github/sync-labels.mjs scripts/tests/sync-labels.test.ts
git commit -m "chore(github): ruleset, labels and held-path codeowners"
```

- [ ] **Step 9: Apply (owner, admin)** —
  `gh api repos/grzott/flare-engine/rulesets --jq '.[] | [.id,.name] | @tsv'` to find the existing
  `main` ruleset, then `gh api -X PUT repos/grzott/flare-engine/rulesets/<id> --input .github/rulesets/main.json`;
  `gh api -X PATCH repos/grzott/flare-engine -F allow_auto_merge=true -F delete_branch_on_merge=true -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK`;
  `bun scripts/github/sync-labels.mjs grzott/flare-engine`.
  Verify: `gh api repos/grzott/flare-engine/rulesets/<id> --jq '.rules[].type'` lists the four rule
  types; `gh label list | grep -c "status:"` prints 4.

---

### Task 5: Guard and permissions let agents commit and push `claude/*` only

**Files:**
- Modify: `.claude/hooks/pre-bash-guard.sh` (`check_git`, the closing rationale lines)
- Modify: `.claude/hooks/pre-bash-guard.test.sh`
- Modify: `.claude/settings.json` (`permissions.allow`, `permissions.deny`)

- [ ] **Step 1: Write the new contract cases first** in `pre-bash-guard.test.sh`.
  - Move to `expect_allow` (they were blocks): `git commit -m x`, `git add .`, `git -C . commit -m x`,
    `git -C packages add .`, `git -c user.name=x commit -m y`, `git --git-dir=.git commit -m x`,
    `bash -c "git commit -m x"`, `bash -c 'cd packages; git add .'`, `eval "git commit -m x"`,
    `xargs git add`, `cd packages && git add .`, `echo hi; git add .`, `true && git commit -m x`.
  - New `expect_allow`: `git fetch origin`, `git fetch origin main`,
    `git switch -c claude/issue-12-clamp-lerp origin/main`,
    `git checkout -b claude/issue-12-clamp-lerp origin/main`, `git switch claude/issue-12-clamp-lerp`,
    `git push -u origin claude/issue-12-clamp-lerp`, `git push origin HEAD:claude/issue-12-clamp-lerp`.
  - New `expect_block`: `git push`, `git push origin`, `git push origin HEAD:main`,
    `git push origin claude/x:main`, `git push --force origin claude/x`, `git push -f origin claude/x`,
    `git push --force-with-lease origin claude/x`, `git push origin +claude/x`,
    `git push origin --delete claude/x`, `git push --all origin`, `git push --tags origin`,
    `git commit --amend -m x`, `git commit --no-verify -m x`, `git commit -n -m x`, `git switch main`,
    `git switch -c feature/x`, `git checkout -b feature/x`, `git checkout -- src/a.ts`, `git checkout .`.
  - Keep every other existing case unchanged (`git push origin main`, `git checkout main`,
    `git reset --hard HEAD`, `git rebase main`, `git merge feature`, `sh -c "git push"`, the interpreter
    payload cases, `git fetch`, `git fetch --prune`, …).
- [ ] **Step 2: Run** — `bash .claude/hooks/pre-bash-guard.test.sh` → FAILED with the moved/new cases.
- [ ] **Step 3: Implement in `check_git`**
  - `add` → allowed.
  - `commit` → allowed unless `--amend`, `--no-verify` or a standalone `-n` is present.
  - `switch` / `checkout` → allowed only as `(-c|-b) claude/<name>( origin/main)?` or a bare
    `claude/<name>`, with `<name>` matching `[A-Za-z0-9._/-]+`.
  - `fetch` → also allowed as `origin` or `origin main`.
  - `push` → allowed only with options from {`-u`, `--set-upstream`} and positionals exactly `origin`
    plus a refspec matching `^(HEAD:)?claude/[A-Za-z0-9._/-]+$`.
  - Change the rationale lines to: "Repo contract — agents commit on claude/* branches and open PRs;
    main is protected by a ruleset." Keep the file free of apostrophes (the docstring warns why).
- [ ] **Step 4: Run** — `bash .claude/hooks/pre-bash-guard.test.sh` → `OK n/n`.
- [ ] **Step 5: Permissions** — in `.claude/settings.json` remove `Bash(git push:*)`,
  `Bash(git commit:*)`, `Bash(git add:*)`, `Bash(git checkout:*)` from `deny`; add to `allow`:
  `Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git push:*)`, `Bash(git switch:*)`,
  `Bash(git checkout -b:*)`, `Bash(git fetch:*)`, `Bash(gh api:*)`, `Bash(bun run test:scripts)`,
  `Edit(scripts/**)`, `Edit(.changeset/**)`. The guard remains the fine-grained gate.
- [ ] **Step 6: Commit (owner)**

```bash
git add .claude/hooks/pre-bash-guard.sh .claude/hooks/pre-bash-guard.test.sh .claude/settings.json
git commit -m "chore(harness): let agents commit and push claude branches"
```

---

### Task 6: Gate script, skills, PR template, builders

**Files:**
- Modify: `.claude/hooks/verify.sh` (becomes gate-only)
- Modify: `.claude/skills/start/SKILL.md`, `.claude/skills/close/SKILL.md`, `.claude/skills/retro/SKILL.md`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `.claude/agents/engine-builder.md:4`, `.claude/agents/game-builder.md:4` (`model: fable`)
- Modify: `SESSION_LOG.md` (append a freeze note), `docs/plans/todo.md` (header note)

**Interfaces:**
- Produces: `bash .claude/hooks/verify.sh <engine|game|mixed>` — exit 0 all green, 1 gate failed, 2 bad
  argument. Runner sentinels printed by `/start next`: `RUNNER: PR OPENED #<n>`,
  `RUNNER: QUEUE EMPTY`, `RUNNER: PR IN FLIGHT #<n>`, `RUNNER: BLOCKED #<issue>`.

- [ ] **Step 1: `verify.sh` gate-only** — one argument (scope); keep the gate sequence; drop
  `check:perf-freshness` (release-time only), the SESSION_LOG upsert, the batch baseline and the commit
  blocks. Update the header comment and the stale `0.4.0` comment near the `bump` gate.
  Verify: `bash .claude/hooks/verify.sh bogus; echo $?` → `2`; `bash .claude/hooks/verify.sh engine` → all
  gates green, exit 0, and `git status --porcelain SESSION_LOG.md` empty.
- [ ] **Step 2: `/start`** — argument `next` (runner mode, no approval stop) or an issue number
  (interactive: present the plan, wait for approval). Phase approval is the `status:ready` label:
  issues are created without it, and the owner approves a phase by applying it to that milestone's
  issues (one bulk action on the phone). Flow:
  1. Any open PR authored by `$BOT_LOGIN` → print `RUNNER: PR IN FLIGHT #<n>`, stop.
  2. Pick: open issues labelled `status:ready`, ordered by milestone `due_on` ascending (none last),
     then `priority:p1` < `p2` < `p3`, then number — all via `gh api` (cloud sessions block `gh pr`/`gh issue`).
     None → print `RUNNER: QUEUE EMPTY`; if the issue that just closed emptied its milestone, comment
     on that milestone's `type:phase` issue `@grzott phase <title> complete`.
  3. `size:l` without a `Design:` line naming an existing repo path → label `status:blocked`,
     comment `@grzott needs a brainstorm and design doc`, print `RUNNER: BLOCKED #<n>`, stop.
  4. `git fetch origin main`; `git switch -c claude/issue-<n>-<slug> origin/main` (slug ≤40 chars,
     kebab); relabel `status:in-progress`.
  5. Route to the builder (unchanged scope rules), implement, run `verify.sh <scope>`; two failed fix
     attempts → `status:blocked`, comment the failing gate's last 30 lines mentioning `@grzott`,
     print `RUNNER: BLOCKED #<n>`, stop.
  6. Commit (Conventional Commit subject, no body), `git push -u origin <branch>`, open the PR with
     `gh api repos/{owner}/{repo}/pulls -f title=… -f head=… -f base=main -f body=…` using the template
     and `Closes #<n>`, relabel the issue `status:in-review`, print `RUNNER: PR OPENED #<pr>`.
- [ ] **Step 3: `/close`** — for ad-hoc interactive work: gate, branch to `claude/<slug>` if on `main`,
  commit, push, open the PR via `gh api`, print the URL. The frictions line (same grammar) goes into the
  PR body instead of SESSION_LOG.
- [ ] **Step 4: `/retro`** — mine the `## Frictions` sections of the last N merged PRs
  (`gh api "repos/{owner}/{repo}/pulls?state=closed&per_page=100"`, merged only) plus SESSION_LOG as
  history.
- [ ] **Step 5: PR template** — add `Closes #`, `## Verification` (commands run and their results),
  `## Risk` (expected classifier verdict and why), `## Frictions` (`corr:N deny:N gate:N fixup:N
  drift:N`); keep the existing checklists.
- [ ] **Step 6: Builders and freeze notes** — `model: fable` in both agent files; append to
  `SESSION_LOG.md`: "Frozen on <date>. History continues in merged PR descriptions."; at the top of
  `todo.md`: "The queue moves to GitHub Issues (the backlog reset); until then, rows here."
- [ ] **Step 7: Gate + commit (owner)** — `bash .claude/hooks/verify.sh mixed` → green, then:

```bash
git add .claude/hooks/verify.sh .claude/skills/start/SKILL.md .claude/skills/close/SKILL.md
git add .claude/skills/retro/SKILL.md .github/PULL_REQUEST_TEMPLATE.md .claude/agents
git add SESSION_LOG.md docs/plans/todo.md
git commit -m "chore(harness): issue-driven start, pr-based close, gate-only verify"
```

---

### Task 7: Spikes S1, S3, S5

**Files:**
- Create: `docs/plans/workflow-spikes-2026-11.md` (one section per spike: setup, observed, verdict)

- [ ] **Step 1: S1 — Bun in a cloud session (owner + agent)** — owner creates a cloud environment
  `flare-engine` (network: Trusted) with setup script:

```bash
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.11"
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
```

  From the phone, start a session on `grzott/flare-engine` and run `bun run lint && bun run typecheck &&
  bun run test && bun run build`. Record pass/fail and time. Verdict rule: pass → cloud sessions may run
  gates; fail → cloud sessions do planning and docs only, gates run in CI.
- [ ] **Step 2: S3 — phone approval under Remote Control** — run `claude remote-control` on the
  workstation; from the phone, ask for a command outside the allow list (`curl -I https://example.com`).
  Record whether the phone can approve or deny it. Verdict rule: no → interactive phone work with the
  workstation on uses pre-approved commands only.
- [ ] **Step 3: S5 — identity of a cloud-session PR** — in a cloud session, commit a one-line change to
  `docs/plans/workflow-spikes-2026-11.md` on `claude/spike-identity`, push, open a PR via `gh api`.
  Record the commit author and PR author. Verdict rule: not the bot → `risk-gate` holds it (Task 3 Step
  2's author rule) and the owner merges cloud-session PRs by hand; the station-off runner is `runner.yml`
  either way.
- [ ] **Step 4: Commit** — this is the first change through the new flow: `/close` opens the PR; expected
  `risk:auto` (a docs file), merges itself after `ci` and `review`.

---

### Task 8: Runners

**Files:**
- Create: `scripts/runner/claude-as-bot.sh`, `scripts/runner/loop.sh`, `scripts/runner/loop.test.sh`
- Create: `.github/workflows/runner.yml`

**Interfaces:**
- Consumes: Task 6's sentinels; Task 1's `~/.config/flare-bot/env`.
- Produces: `scripts/runner/loop.sh [max-issues=20]`; environment overrides `RUNNER_CLAUDE`
  (default `scripts/runner/claude-as-bot.sh`), `RUNNER_SLEEP` (default `600`),
  `RUNNER_LIMIT_SLEEP` (default `1800`), `RUNNER_LIMIT_RETRIES` (default `12`).

- [ ] **Step 1: Failing test** — `loop.test.sh` puts a stub on `RUNNER_CLAUDE` that replays scripted
  outputs, sets both sleeps to `0`, and asserts:
  - `QUEUE EMPTY` → exit 0 after 1 call
  - `PR OPENED` → `PR IN FLIGHT` ×2 → `QUEUE EMPTY` → 4 calls, exit 0
  - `BLOCKED #7` → exit 3, message names #7
  - "usage limit reached" ×2 then `QUEUE EMPTY` → 3 calls, exit 0
  - 13 usage-limit outputs → exit 4 after 13 calls
  - `max-issues=2` with `PR OPENED` every time → stops after 2 opened PRs, exit 0
- [ ] **Step 2: Run** — `bash scripts/runner/loop.test.sh` → FAIL (no loop.sh).
- [ ] **Step 3: Implement** — `claude-as-bot.sh` sources `~/.config/flare-bot/env`, exports
  `GIT_AUTHOR_NAME`/`GIT_COMMITTER_NAME`=`$BOT_NAME`, `GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_EMAIL`=`$BOT_EMAIL`,
  `GH_CONFIG_DIR`, and `GIT_CONFIG_COUNT=2` with `credential.helper` reset then
  `!gh auth git-credential`, then `exec claude "$@"`. `loop.sh` calls
  `$RUNNER_CLAUDE -p "/start next" --permission-mode acceptEdits` and branches on the sentinels:
  in-flight → sleep `RUNNER_SLEEP` and retry; usage limit (case-insensitive `usage limit|limit reached`)
  → sleep `RUNNER_LIMIT_SLEEP`, at most `RUNNER_LIMIT_RETRIES` times.
- [ ] **Step 4: Run** — `bash scripts/runner/loop.test.sh` → all assertions pass.
- [ ] **Step 5: `runner.yml` (workstation off)**
  - `on:` `pull_request` [closed] when `merged == true` and the head ref starts with `claude/`;
    `workflow_dispatch`; `schedule` cron `0 */6 * * *` (resumes after a usage limit).
  - `concurrency: { group: runner, cancel-in-progress: false }`; `timeout-minutes: 90`.
  - First step: if an open PR by `vars.BOT_LOGIN` exists, exit 0 (one in flight).
  - Then: checkout `main`; setup-bun `1.3.11`; `bun install --frozen-lockfile`; git identity from the
    bot; `gh auth setup-git` with `BOT_TOKEN`; run the action with the OAuth token, `BOT_TOKEN` as its
    GitHub token, model `fable`, the allow list from `.claude/settings.json`, prompt `Run /start next`.
  - The engine repo is public, so Actions minutes are free here.
- [ ] **Step 6: Parse check** — same command as Task 3 Step 6 → `ok`.
- [ ] **Step 7: Commit** — through the new flow with `/close`; expected `risk:held`
  (`.github/workflows/runner.yml` is a held path), so the owner taps.

---

### Task 9: Pilot

**Files:** none in the repo (GitHub issues, milestone; results appended to
`docs/plans/workflow-spikes-2026-11.md`).

- [ ] **Step 1: Pilot milestone** — milestone `Workflow pilot` with due date one week out; a
  `type:phase` tracking issue; three issues labelled `status:ready`:
  - P1 CREATE-TMP-1 — `packages/create/tests/scaffold.test.ts` deletes its temp dirs (`afterEach`); `size:s`,
    tests only → expect `risk:auto`.
  - P2 CLI-TMX-1 — `flare tiled-to-flare` names a TMX (XML) input instead of failing in the JSON parser;
    `size:s`, a bug fix → expect `risk:auto`.
  - P3 Reword `CLAUDE.md` "Workflow" and "Boundaries" for the PR flow (agents commit on `claude/*`
    branches as the bot; held classes need the owner); `size:s` → expect `risk:held`.
- [ ] **Step 2: P1 with the workstation on** — `bash scripts/runner/loop.sh 1`. Check: the PR author is the
  bot; the `ci` and `risk-gate` checks ran and the github-actions review comment carries a verdict
  marker; label `risk:auto`; it merges by itself; the branch is
  deleted.
- [ ] **Step 3: P2 with the workstation off** — P1's merge triggers `runner.yml`; P2's PR is opened by the
  bot from Actions and merges by itself.
- [ ] **Step 4: Concurrency** — while P3's PR is open, run `bash scripts/runner/loop.sh 1` locally →
  prints the in-flight sentinel and opens nothing (Review Focus 2).
- [ ] **Step 5: Held tap** — P3's PR gets `risk:held` and a review request on the phone; approve in
  GitHub mobile → `risk-gate` turns green → auto-merge → `runner.yml` runs → `QUEUE EMPTY` → the phase
  issue gets the `@grzott phase Workflow pilot complete` comment.
- [ ] **Step 6: Fork PR** — the bot forks the repo and opens a one-line docs PR from the fork → no
  `risk-gate`/`review` statuses, nothing fails loudly; the owner closes it (Review Focus 1).
- [ ] **Step 7: Main is closed** — as the bot, outside Claude:
  `GH_CONFIG_DIR=~/.config/gh-bot git push origin HEAD:main` from a scratch commit → rejected by the
  ruleset (Review Focus 5).
- [ ] **Step 8: Record** — append a Pilot section to `docs/plans/workflow-spikes-2026-11.md` with each
  check's result and any fix made; ship it through `/close`.

---

### Task 10: Roll out to the other four repos

**Files (per repo, one PR each, all held):** the Task 2–8 artifacts adapted to that repo.

- [ ] **Step 1: Owner prerequisites per repo** — secrets `BOT_TOKEN` (Actions + Dependabot) and
  `CLAUDE_CODE_OAUTH_TOKEN`, variable `BOT_LOGIN`, a cloud environment with that repo's setup script.
  Private repos get 3,000 Actions minutes a month on Pro; after one week, record the minutes used.
- [ ] **Step 2: Port, per repo**
  - Classifier, its tests and the workflows; the package manager in workflows is `bun`, except
    `grzott-portfolio`, which uses `pnpm`.
  - A repo-specific `.github/risk-policy.json`:
    - all repos: their `.claude/**`, `AGENTS.md`, `CLAUDE.md`, `.github/**`, licence files;
    - `berekthegame`: also `docs/design-refs/**` (owner-only);
    - `flare-engine-page`: also news/FAQ/home content (public claims);
    - `grzott-portfolio`: also `docs/blog/**` and post content.
  - Ruleset, labels, CODEOWNERS, repo settings, PR template.
- [ ] **Step 3: Adapt each harness** (read the repo's guard first):
  - `Pan-Tvardowski` and `berekthegame` already let agents commit, so add the `claude/*` push rule and
    issue-driven `/start`/`/close`.
  - `flare-engine-page` already commits and asks before push; replace the ask with the push rule.
  - `grzott-portfolio` has no hook; add the engine guard with `pnpm` allowed instead of forbidden.
- [ ] **Step 4: Prove each** — one `size:s` issue per repo through the chain (Task 9 Steps 2 and 5).
