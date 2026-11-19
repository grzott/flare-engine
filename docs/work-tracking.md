Standard version: 1 (2026-11-18)

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
- **`status:ready`:** approved and pickable. Only the owner applies it, by hand or by setting
  the `reviewed` flag of an import manifest.
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

- **Epics.** A `type:epic` issue with native sub-issues. The body states the outcome; "all
  sub-issues closed" is not an outcome. Epics carry no status and no size. Their progress is
  the sub-issue bar. A parent and its sub-issues share an owner.
- **Dependencies.** A native blocked-by link, plus a `**Depends on:**` line in the body. A
  dependency on an issue under another owner is body text only.

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

Each repo carries its own copy of the tooling. Copies are kept in step by hand, and the first
line of this file records the version of the standard the repo carries.

- **`.github/labels.json`:** the repo's full label set.
- **`scripts/github/sync-labels.mjs`:** creates and updates labels to match the file. It deletes
  undeclared labels only with `--prune`, and never deletes a label that open issues use.
- **`scripts/github/import-issues.mjs`:**
  - reads a JSON manifest and files milestones and issues, then sub-issue links, then
    blocked-by links;
  - renders the §7 body and is idempotent by `backlog-id`;
  - validates the §1 families;
  - lints every rendered string with `scripts/github/terms.mjs`;
  - writes a readable dry-run report, which is what the owner reviews.

  It applies `status:*` only from a manifest whose `reviewed` flag is `true`; otherwise it
  rejects status labels.
- **The importer only creates; it never reconciles.**
  - Within one `--apply` run it creates the missing issues. It then fills the `**Depends on:**`
    numbers and adds the sub-issue and blocked-by links, but only on issues it created in that
    run.
  - It never edits an issue it did not create in the current run, never edits a closed issue,
    and never touches an issue without a marker.
  - A re-run creates only what is missing, so "zero changes" means nothing is missing.
  - After a successful import, GitHub is the only source of truth. The manifest is archived and
    not edited again, which keeps status in one place.
- **`scripts/github/terms.mjs`:** the wording lint. Every title, body, label, milestone and
  comment written to GitHub passes it first.
- **`.github/workflows/issue-closed.yml`:** strips `status:*` from an issue when it closes and
  from a PR when it merges.
- **Issue forms:** `task.yml` and `defect.yml`, whose default labels come from this taxonomy;
  blank issues stay enabled. No PR template in repos that commit to main.

Scripts that write to GitHub are dry-run by default and write only with `--apply`.
