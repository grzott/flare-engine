# A3 — Backlog Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The queue moves from `docs/plans/todo.md` to GitHub issues. Every live, deduplicated
engine item gets one issue in a milestone, stale rows are closed with evidence, `todo.md` is retired,
and no doc still points at it.

**Architecture:** A pure, tested import planner (`scripts/github/import-issues.mjs`, the
`sync-labels.mjs` pattern) turns a hand-built manifest into milestones and issues, idempotently. Each
issue body carries a `backlog-id` marker, so a re-run skips what exists. The manifest is transient and
gitignored: after the import, the issues are the single source. Doc and harness pointers then move to
the issues in held PRs.

**Tech Stack:** Bun 1.3.11 scripts + `bun:test`, `gh api` (REST), GitHub issues and milestones.

**Spec:** `docs/plans/_local/roadmap-design-2026-10-30.md` §5 item A3, decisions D15,
D20, D22 (private). Owner choices of 2026-11-03: one issue per live item, milestones by
theme, later work as a few epic issues without `status:ready`. Audit inputs:
`docs/plans/_local/post-flip-audit-2026-10/audit-engine-backlog.md` and the 2026-11-03 backlog
audit (todo.md: ≈91 rows, ≈59 live; an estimated 85–100 issues).

## Global Constraints

- The repo is public. Issues and committed docs carry engine work only, and nothing from
  `docs/plans/_local/` (D22). Cross-repo items (PT, Berek, page, portfolio) are not filed here.
- Issues are created **without** any `status:*` label. The owner approves a phase by applying
  `status:ready` to a milestone's issues (A2 Task 6 Step 2).
- Labels come only from `.github/labels.json`. Each issue carries one `type:*`, one `scope:*`, one
  `size:*` and one `priority:*`.
- A `size:l` issue carries a `Design:` line naming an existing repo path (or `/start` blocks it).
- Issue body shape (the pilot's): a context paragraph; `**Do:**`; `**Done when:**`;
  `Source: docs/plans/todo.md row <ID>`; `Expected risk: risk:auto|risk:held (<why>)`.
- The `0.4.x` line is patch-only (D20). Breaking halves go to milestone `0.5.0` and are not
  approved before it.
- A stale claim is verified at HEAD before a row is closed (AGENTS.md: findings are arguments).
- Commits: Conventional Commits ≤72, no body, no `Co-Authored-By`. Every PR from an owner session is
  held; harness, workflow, `CLAUDE.md` and `README.md` files are held paths anyway.

## Review Focus

1. **An import interrupted after some issues were created** and run again. Expected: no duplicates;
   the second run creates only the missing ones. Pinned in Task 1 (marker test).
2. **One row ID entered twice in the manifest** (two rows merged by dedup, then both listed).
   Expected: validation refuses before any write. Pinned in Task 1.
3. **A label or milestone that does not exist**, or a `status:*` label in the manifest. Expected:
   refused before any write. Pinned in Task 1.
4. **A `size:l` entry with no `Design:` path, or a path that does not exist.** Expected: refused.
   Pinned in Task 1.
5. **Private material in a public issue body** (a `_local/` path, `roadmap-design`). Expected:
   refused. Pinned in Task 1.

---

### Task 1: Issue import tool

**Files:**
- Create: `scripts/github/import-issues.mjs`, `scripts/github/import-issues.d.mts`
- Create: `scripts/tests/import-issues.test.ts`

**Interfaces:**
- Produces:

```ts
export type BacklogMilestone = { title: string; description: string; due_on: string | null };
export type BacklogIssue = {
  id: string; title: string; body: string; labels: string[]; milestone: string | null;
};
export type BacklogManifest = { milestones: BacklogMilestone[]; issues: BacklogIssue[] };
export type ExistingIssue = { number: number; body: string | null };
export function backlogMarker(id: string): string; // `<!-- backlog-id: ${id} -->`
export function validateManifest(
  m: BacklogManifest, knownLabels: readonly string[], pathExists: (p: string) => boolean,
): string[]; // one message per problem; [] = valid
export function planIssueImport(
  m: BacklogManifest, existingIssues: readonly ExistingIssue[], existingMilestones: readonly string[],
): { createMilestones: BacklogMilestone[]; createIssues: BacklogIssue[]; skipped: string[] };
```

CLI: `bun scripts/github/import-issues.mjs <owner/repo> <manifest.json> [--apply]`. Exit 2 on bad
arguments; exit 1 with every validation message printed; without `--apply`, print the plan as a
table (id, milestone, labels, title) and the counts, and write nothing. With `--apply`, create the
missing milestones, then the issues; the body gets `\n\n` plus the marker appended.

- [ ] **Step 1: Write the failing tests** (`describe`/`it` from `bun:test`, the `sync-labels.test.ts`
  style). Fixture: two milestones and three issues using labels from `.github/labels.json`.
  - `backlogMarker('HYG14')` → `'<!-- backlog-id: HYG14 -->'`
  - `skips an issue whose marker is already in an existing body` → `skipped: ['HYG14']`, it is not in
    `createIssues`
  - `creates only milestones that do not exist yet`
  - `refuses a duplicate id` → a message containing `duplicate id HYG14`
  - `refuses an unknown label` and `refuses a status label` (`status:ready`) → messages naming them
  - `refuses a milestone the manifest does not declare`
  - `refuses size:l without a Design line` and `refuses a Design path that does not exist`
    (`pathExists` stub returning false)
  - `refuses private material` for a body containing `docs/plans/_local/` and one containing
    `roadmap-design`
  - `refuses an issue without exactly one type, scope, size and priority label`
- [ ] **Step 2: Run** `bun test scripts/tests/import-issues.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** the three functions and the CLI in `scripts/github/import-issues.mjs`,
  I/O behind `import.meta.main`. Existing issues come from
  `gh api --paginate "repos/<r>/issues?state=all&per_page=100"` with pull requests filtered out;
  milestones from `.../milestones?state=all`. Create a milestone with
  `gh api -X POST repos/<r>/milestones -f title=… -f description=… [-f due_on=…]`, and an issue with
  `-f title=… -f body=… -f milestone=<number> -f 'labels[]=…'`. Write the `.d.mts`.
- [ ] **Step 4: Run** the test file → PASS; `bun run test:scripts` → all pass; `bun run lint` clean.
- [ ] **Step 5: Gate and PR** — `/close` with subject `feat(scripts): idempotent backlog issue
  import` (scope `engine`). It is held as an owner PR.

---

### Task 2: The manifest and the stale list

**Files:** `.superpowers/a3/backlog.json` and `.superpowers/a3/stale.md` (both gitignored, never
committed).

**Interfaces:**
- Consumes: Task 1's `BacklogManifest` shape.
- Produces: a manifest the Task 1 CLI dry-runs with exit 0.

- [ ] **Step 1: Stale rows** — for every row the 2026-11-03 audit marks stale (CREATE-TMP-1,
  CLI-TMX-1, RELEASE-OIDC-1, XR-7, OSS-I1, OSS-I2, the S7 closed-arc row, and the half-fixed HYG2,
  HYG5, HYG15 F080, PERF-9 premises), confirm the claim at HEAD and write one line per row to
  `stale.md`: ID, verdict (`done` / `half: <live residue>` / `still live`), and the evidence (a
  commit or `file:line`). A half-fixed row files only its live residue.
- [ ] **Step 2: Milestones** — declare these in the manifest. The due dates are targets the owner
  may move at Step 5:

| Title | Due | Holds |
| --- | --- | --- |
| `Release health` | 2026-11-19 | token teardown residue, the perf recapture before the 30-day refusal |
| `Deferred defects` | 2026-12-18 | the defect rows (colour grade, postfx on web under `GameView`, RW-WASM-1, HYG14, CW7-Q10, CREATE-HINT-1, HAPTICS-ANDROID-1, ECS per-World additive half, CI gaps, rigid-body ADR) |
| `Post-release verification` | 2027-01-15 | npm-path manual protocol, XR-1(b), fresh-machine scaffold, Expo 58 templates, the README dev-build note |
| `Hygiene` | 2027-01-29 | the HYG rows still live after Step 1, one issue per finding |
| `Consumer asks` | 2027-02-12 | CW7-Q rows, DYN-3 |
| `Perf` | 2027-02-12 | PERF-4b, PERF-7, PERF-14b, PERF-17, P1 (conditional) |
| `Adoption basics` | 2027-02-26 | README GIF and quickstart, recipes, `good first issue`, Discussions seeding |
| `0.5.0` | 2027-03-31 | `_resetComponentIds` removal, the 128-component mask, ADR posting obligations |

  Later work (the DESK arc, inspector, playground and the remaining module proposals) becomes **three
  epic issues** with `milestone: null`, `size:l`, a `Design:` line pointing at the existing doc
  (for example `docs/plans/desktop-steam-2026-09.md`), and a checklist of the row IDs.
- [ ] **Step 3: Issues** — one entry per live item, `id` = the todo.md row ID (with a suffix for a
  split HYG finding, e.g. `HYG15-F081`). Re-verify each row's `file:line` at HEAD and write the body
  in the pilot's shape. Priority: `p1` for a deadline or a defect a consumer hits, `p2` by default,
  `p3` for hygiene. Owner-only items get `type:owner-action`. Skip cross-repo rows and rows the audit
  dedup merged into another.
- [ ] **Step 4: Validate** — `bun scripts/github/import-issues.mjs grzott/flare-engine
  .superpowers/a3/backlog.json` → exit 0, and a plan of about 85–100 issues and 8 milestones. Paste
  the plan table and the counts into the session for the owner.
- [ ] **Step 5: Owner review** — the owner reads the dry-run table and `stale.md`, then edits or
  approves. Filing about 90 public issues is outward-facing; nothing is created before this approval.

---

### Task 3: Import (owner-approved)

**Files:** none in the repo.

- [ ] **Step 1: Apply** — `bun scripts/github/import-issues.mjs grzott/flare-engine
  .superpowers/a3/backlog.json --apply`.
- [ ] **Step 2: Idempotency check** — run the same command again without `--apply` → `createIssues: 0`,
  `createMilestones: 0`.
- [ ] **Step 3: Verify** — `gh api "repos/grzott/flare-engine/issues?state=open&per_page=100"
  --paginate --jq '[.[] | select(.pull_request == null)] | length'` equals the plan's count, and no
  open issue carries a `status:*` label.
- [ ] **Step 4: Pilot residue** — remove `status:in-review` from closed #23–#26
  (`gh api -X DELETE repos/grzott/flare-engine/issues/<n>/labels/status:in-review`).

---

### Task 4: Retire `todo.md` as the queue

**Files:**
- Modify: `docs/plans/todo.md` (replaced by a stub)
- Modify: `CLAUDE.md:5,9,26`, `.claude/agents/engine-builder.md:10,26`,
  `.claude/agents/game-builder.md:10,25`, `.claude/hooks/session-start.sh:18-21`

**Interfaces:**
- Consumes: Task 3's issues (the stub and the pointers name them).

- [ ] **Step 1: Stub** — `todo.md` becomes about 8 lines: retired on `<date>`; the queue is open
  issues labelled `status:ready`, ordered by milestone due date (link to the milestones page); the
  last full version is `<sha>` (`git show <sha>:docs/plans/todo.md`); its `## Done` section is the
  pre-2026-11 history.
- [ ] **Step 2: Pointers** — `CLAUDE.md:5` "Next-up" → the issues link; `CLAUDE.md:9` → "`/start`
  takes the next approved issue"; `CLAUDE.md:26` → "edit `roadmap.md` or the issue". In both builder
  files, line 10 points at the issues and the first workflow step reads "the issue `/start` handed
  you". `session-start.sh`: drop the todo.md block; print
  `Queue:       GitHub issues labelled status:ready (/start next)`.
- [ ] **Step 3: Verify** — `grep -rn "todo.md" CLAUDE.md AGENTS.md .claude README.md CONTRIBUTING.md
  docs/design` → no line that tells anyone to take work from `todo.md`. Historical mentions in
  `docs/plans/*` stay. `bash .claude/hooks/session-start.sh` prints the new line.
- [ ] **Step 4: Gate and PR** — `/close`, subject `docs: retire todo.md as the queue`, scope `mixed`.

---

### Task 5: Closed issues drop their status label

**Files:**
- Create: `.github/workflows/issue-closed.yml`

- [ ] **Step 1: Workflow** — `on: issues: [closed]`; one job, `permissions: issues: write`, the
  default `GITHUB_TOKEN`; for each label on the issue that starts with `status:`,
  `gh api -X DELETE repos/${{ github.repository }}/issues/<n>/labels/<label>` (URL-encode the colon).
- [ ] **Step 2: Parse check** — `bun -e` YAML parse over `.github/workflows/*` → ok.
- [ ] **Step 3: Gate and PR** — `/close`, subject `ci: drop status labels when an issue closes`.
  The push needs the owner's `workflow` credential.
- [ ] **Step 4: Prove** — the next issue closed by a merged PR has no `status:*` label (record it in
  the PR that closed it).

---

### Task 6: Engine doc drift

**Files:**
- Modify: `docs/plans/roadmap.md` (rewrite), `docs/design/architecture.md:227`,
  `.changeset/README.md:20-25`, `README.md:19`

- [ ] **Step 1: `roadmap.md`** — rewrite to at most 80 lines: the current state (the `0.4.x` line;
  42 scoped packages; public since 2026-10-26; read `CHANGELOG.md` for the version), how work is
  tracked (issues and milestones), the milestones from Task 2 one line each with links, the `0.5.0`
  pointer to `versioning-and-announcements.md`, and the epics. Engine work only; no private phase names
  and no aims beyond the current positioning (D3, D22).
- [ ] **Step 2: Small fixes** — `architecture.md:227` "41 scoped packages" → 42.
  `.changeset/README.md`: the publishing prerequisites describe Trusted Publishing through
  `release.yml` (OIDC, no `NPM_TOKEN`), public access, and `ENABLE_RELEASE`.
- [ ] **Step 3: `README.md:19`** — first establish what flareengine.dev runs today (the page repo's
  routes and demos at its HEAD, and the live site). Then reword the "three games and five
  animations" claim to exactly that. If the facts are unclear, leave the line and ask the owner.
- [ ] **Step 4: Gate and PR** — `/close`, subject `docs: bring the roadmap and readmes up to date`,
  scope `mixed`.

---

### Task 7: Drift outside the engine repo (owner or that repo's session)

**Files (no engine PR):**
- `C:\_PROG\flare-engine-workspace\WORKSPACE.md` (not a git repo): line 9 → 42 scoped packages, the
  `0.4.x` line, public; line 10 drop "canonical showcase"; lines 11–12 Berek and lore have origins;
  add the `flare-engine-page/` row; lines 44–46 the expired 2026-06-17 deletion note → an A9 owner
  item.
- Pan-Tvardowski `AGENTS.md:3`, `package.json:5`, `README.md:3`: "canonical showcase" → the private
  alpha wording.
- Berek `AGENTS.md` and `README.md:26-28`: the freeze dates and the "restricted scope … token" line.
- flare-engine-page: the "3 games" claim, the same fact as Task 6 Step 3.

- [ ] **Step 1:** hand the owner one block per repo with the exact old and new lines; each repo's
  own session ships it under that repo's rules. Note that PT's and Berek's guards refuse
  `Co-Authored-By` and `Claude-Session` lines in commit messages.
