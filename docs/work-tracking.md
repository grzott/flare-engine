Standard version: 2 (2026-11-28)

# Work tracking on GitHub issues

One way to track work on GitHub issues, shared by every repo that carries this file. Anyone
opening an issue should be able to tell what it is, where it lands, how big it is, how urgent it
is and whether it is approved. The approved queue is the same plain query in every repo:

```
gh issue list -l status:ready
```

Labels carry the workflow state. A Project board, if one exists, is a view and never a source of
truth. Each repo holds its own copy of this file; a copy changes only when the version on the
first line changes.

## 1. Label families

Every **open, non-epic** issue carries exactly one `type:`, one `scope:`, one `size:` and one
`priority:`. Epics carry `type:epic` and a `scope:` only. One colour per family.

| Family | Values and descriptions | Colour |
| ------ | ----------------------- | ------ |
| `type:` | §2; each repo declares the subset it uses | `1d76db` |
| `scope:` | §3, per repo | `c5def5` |
| `size:` | `s` "Small: a few hours"; `m` "Medium: about a day"; `l` "Large: several days; needs a design doc first" | `bfdadc` |
| `priority:` | `p1` "Do first"; `p2` "Do next"; `p3` "When there is room" | `5319e7` |
| `status:` | §4 | `0e8a16` |
| `owner-action` | "Only the owner can do it". One unprefixed flag. Automated pickers exclude it | `d93f0b` |
| `risk:` | Optional. Repos that gate pull requests by risk may add a `risk:` family | `d93f0b` |

GitHub's 9 default labels are deleted. Dependabot PRs get `type:hygiene` and the repo's
dependency scope.

## 2. Types

| Label | Description (on GitHub) | Usual commit type |
| ----- | ----------------------- | ----------------- |
| `type:feature` | New capability | `feat` |
| `type:defect` | Something is broken | `fix` |
| `type:hygiene` | Cleanup with no behaviour change | `refactor`, `chore`, `build`, `ci` |
| `type:perf` | Performance or benchmark work | `perf` |
| `type:verification` | Prove something works | `test` |
| `type:docs` | Documentation only | `docs` |
| `type:content` | Posts, news, CMS copy and media | none, or `docs` |
| `type:ops` | Running systems: hosting, DNS, dashboards, backups | none |
| `type:decision` | The outcome is a recorded decision | `docs` |
| `type:admin` | Paperwork and accounts outside any repo | none |
| `type:epic` | Parent issue; progress is its sub-issues | none |

`type:admin` and `type:decision` issues always carry `owner-action` as well.

## 3. Scopes

A scope names the part of the repo that the work lands in. Each repo declares its scopes in
`.github/labels.json`; where the repo enforces commit scopes, the two match one to one.

A scope's description names a path or a surface, so a reader can route an issue without opening
a doc.

## 4. Status lifecycle

- **Open issues only.** A workflow removes `status:*` when an issue closes, and from a PR when
  it merges.
- **No status means backlog,** and the issue is not approved.
- **`status:ready`:** approved and pickable. Only the owner applies it, by hand.
- **`status:in-progress`:** someone has claimed it. It is applied when work starts and removed
  if the work is abandoned.
- **`status:in-review`:** its PR is open. Only in repos that use PRs.
- **`status:blocked`:** waiting on a named person or event. The body or the latest comment
  names it.
- **At most one status per issue.**

## 5. Milestones and queue order

- **A milestone is a goal.** A dated one is a real deadline. Close it when it has no open
  issue.
- **Queue order:** milestone due date (undated last), then priority, then issue number.
- A repo may forbid milestones on some kinds of work, such as content.

## 6. Epics and dependencies

- **Epics.** A `type:epic` issue with native sub-issues, created and linked by hand. The body
  states the outcome; "all sub-issues closed" is not an outcome. Epics carry no status and no
  size. Their progress is the sub-issue bar. A parent and its sub-issues share an owner.
- **Dependencies.** A `**Depends on:**` line in the body names each one. A native blocked-by
  link may be added by hand as well; no tooling adds one. A dependency on an issue under another
  owner is body text only.

## 7. Issue body and title

```
<context: what and why, with file:line or URL evidence; for status:blocked, who or what it waits on>

**Do:** <steps>
**Done when:** <a result someone else can check>
**Depends on:** #n, owner/repo#n          (optional)
**Verify first:** <what to check>          (optional: it may already be done)
**Target:** YYYY-MM-DD                     (optional, when there is no milestone)
Design: <path>                             (required for size:l)
Docs: <permalinks>                         (optional; blob/<sha>/<path> at the importing commit)
Source: <where the item came from>         (optional)

<!-- backlog-id: <key> -->
```

- **Titles:** an imperative phrase of at most 72 characters. A lowercase `<component>:` prefix
  is allowed when it is finer than the scope label. Casing follows the repo's commit
  convention.
- **Amendments:** appended as `## Amended YYYY-MM-DD`; that section wins over what it amends.
- **The marker** on the last line is written by the importer (§9) and identifies an imported
  issue. Issues filed by hand have none.

## 8. Closing

- The change that finishes the work carries a closing keyword: the PR body in repos that use
  PRs, the commit footer in repos that commit to main (`Closes #n`, or `Closes owner/repo#n`
  across repos).
- Owner actions with no repo change close with a comment that says what was done.
- Wrong or duplicate issues close as "not planned" or "duplicate"; no labels are needed for
  that.

## 9. Tooling, copied per repo

Each repo carries its own copy of the tooling, in the repo's own script language, so the paths
below omit the extension. Copies are kept in step by hand, and the first line of this file
records the version of the standard the repo carries.

- **`.github/labels.json`:** the repo's full label set.
- **`scripts/github/sync-labels`:** creates and updates labels to match the file. It never
  deletes a label; one that is no longer wanted is deleted by hand.
- **`scripts/github/import-issues`:**
  - reads a JSON manifest of milestones and issues, each issue with its title, its body
    already written in the §7 form, its labels and its milestone, and files the milestones,
    then the issues;
  - adds the §7 marker to each body and is idempotent by `backlog-id`;
  - validates the manifest before it writes anything: one each of the §1 families on every
    issue, labels that `labels.json` declares, milestones that the manifest declares, and a
    `Design:` line on a `size:l` issue that names a file tracked in the repo;
  - rejects any `status:*` label: the owner applies status by hand once the issues exist;
  - is dry-run by default and prints what it would create; it writes only with `--apply`.
- **The importer only creates; it never reconciles.**
  - It never edits an issue it finds, with a marker or without one.
  - It adds no links. Because every issue needs a `size:` and a `priority:`, it files no epics.
    Sub-issue and blocked-by links are added by hand, and a `**Depends on:**` line that names an
    issue filed in the same run gets its number after the run.
  - A re-run creates only what is missing, so "zero changes" means nothing is missing.
  - After a successful import, GitHub is the only source of truth. The manifest is archived and
    not edited again, which keeps status in one place.
- **`.github/workflows/issue-closed.yml`:** strips `status:*` from an issue when it closes and
  from a PR when it merges.
- **Issue forms** are optional. A repo that has them gives each form its default `type:` label
  from this taxonomy, and blank issues stay enabled. No PR template in repos that commit to main.
