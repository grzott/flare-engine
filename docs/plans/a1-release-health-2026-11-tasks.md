# A1 — Release Health and Deadlines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep releases possible after the `NPM_TOKEN` dies on 2026-12-01, unblock Dependabot, ship the
one runtime CVE fix, and replace the pre-flip versioning posture with the post-flip one.

**Architecture:** Configuration and documentation changes on the current harness (agents edit, the
owner commits — the A2 workflow has not landed yet). The `sharp` CVE fix doubles as the proof release
for Trusted Publishing.

**Tech Stack:** GitHub Actions, `changesets/action@v1` (resolves to v1.9.0, which has an OIDC branch:
with `NPM_TOKEN` unset and `ACTIONS_ID_TOKEN_REQUEST_*` present it logs "No NPM_TOKEN found, but OIDC is
available - using npm trusted publishing" and writes no token — `maintenance/v1` `src/index.ts`), npm
CLI 11, Biome 2.5/2.6, Dependabot.

**Spec:** `docs/plans/_local/roadmap-design-2026-10-30.md` §5, item A1 (private; decisions
D19, D20). Evidence: `docs/plans/_local/post-flip-audit-2026-10/audit-engine-health.md` §2.3, §3.

## Global Constraints

- Every changeset is `patch` — the current line is `0.4.x` only (D20).
- Agents do not run `git add` / `git commit` / `git push` in this plan; each task ends in a commit block
  the owner runs (`AGENTS.md`; the A2 harness change has not landed).
- Commits: Conventional Commits, ≤72 chars, no body, no `Co-Authored-By` trailer.
- Bun only on the command line; npmjs.com steps are owner actions in a browser.
- A release never runs with `FLARE_PERF_ALLOW_STALE=1`; `release.yml` and `bun run release` both run
  `check:perf-freshness`.
- Order: Task 1 before Monday 2026-11-02 (Dependabot's next run); Task 4 before ~2026-11-19 (perf
  baselines go stale); everything before 2026-12-01.
- Every backticked name in a changeset must resolve to a real exported symbol (`check:changeset-symbols`);
  write dependency names as plain text.

## Review Focus

1. **A package missing its trusted-publisher entry** publishes half a release (some packages at
   `0.4.6`, the rest at `0.4.5`). Expected: all 42 configured before the proof release; the run log lists
   42 published packages. Pinned in Task 2 Step 1 and Task 4 Step 6.
2. **Perf lanes stale at release time** make `release.yml` fail at `check:perf-freshness` and publish
   nothing. Expected: the proof release ships before ~11-19 or after a recapture. Pinned in Task 4 Step 4.
3. **`sharp` 0.35 changing an API `pack-atlas.ts` uses** (`metadata()`, the `sharp({ create })`
   pipeline) or its Node floor exceeding the CLI's `engines.node >=20`. Pinned in Task 3 Steps 2–3.
4. **The Biome exclusion silently dropping files Biome lints today.** Expected: the "Checked N files"
   count is identical before and after. Pinned in Task 1 Step 3.
5. **The rewritten versioning docs loosening the bump gate.** Expected: `check:bump` still refuses a
   `minor` without an accepted ADR — the script is untouched; only prose changes. Pinned in Task 5 Step 5.

---

### Task 1: Unblock Dependabot before Monday 2026-11-02

**Files:**
- Modify: `biome.json` (`files.includes`)
- Modify: `.github/dependabot.yml` (bun entry)

- [ ] **Step 1: Record today's lint file count**

Run: `bun run lint 2>&1 | tail -2`
Expected: a line `Checked <N> files`; note N.

- [ ] **Step 2: Exclude Markdown and YAML from Biome**

Append `"!**/*.md"`, `"!**/*.yml"`, `"!**/*.yaml"` to `files.includes` in `biome.json`. Biome 2.5
does not process these types, so today this is a no-op; Biome 2.6 would otherwise reformat 16 `.md` and
2 `.yml` files (the cause of PR #11's 173 errors).

- [ ] **Step 3: Verify nothing Biome lints today was dropped**

Run: `bun run lint 2>&1 | tail -2`
Expected: `Checked <N> files` with the same N as Step 1, no errors.

- [ ] **Step 4: Verify Biome 2.6 is now clean**

Run: `bunx @biomejs/biome@2.6.2 check . 2>&1 | tail -5`
Expected: no "Formatter would have printed" errors for `.md`/`.yml`. Any new 2.6 *lint-rule* findings:
fix them in this task if under ~10 sites; otherwise add a `linter.rules` entry setting that rule to
`"off"` with a one-line comment and record it for the A3 backlog.

- [ ] **Step 5: Hold the TypeScript major**

In `.github/dependabot.yml`, under the `bun` entry, add:

```yaml
    ignore:
      # TypeScript 7 changes the .d.ts output of all 42 packages and every export gate;
      # it is its own evaluated migration later, not a weekly bump.
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
```

- [ ] **Step 6: Commit (owner)**

```bash
git add biome.json .github/dependabot.yml
git commit -m "chore(deps): exclude md/yml from biome, hold typescript major"
```

- [ ] **Step 7: Monday 11-02 decision rule (owner merges)**

When Dependabot reopens its groups: a green group merges. A group red for any reason other than
formatting (expected candidates: `tsdown` 0.22→0.23 changes its default output profile; `canvaskit-wasm`
0.40→0.42 in `bench-web`) gets an `ignore` entry for that dependency's offending update type, with a
comment, plus an A3 backlog issue to migrate it. The `prod-minor-patch` group carries `sharp`; if Task 3
has already landed, Dependabot drops `sharp` from it.

- [ ] **Step 8: Turn on Dependabot security updates (owner)**

Repo Settings → Code security → Dependabot security updates → Enable.
Verify: `gh api repos/grzott/flare-engine/automated-security-fixes --jq .enabled` prints `true`.

---

### Task 2: Trusted publisher on all 42 packages (owner)

**Files:** none.

- [ ] **Step 1: Produce the package list**

Run: `grep -h '"name"' packages/*/package.json | sed -E 's/.*"name": "([^"]+)".*/\1/' | sort`
Expected: exactly 42 names, all `@flare-engine/*`. Paste the list into this step as the owner's tick
list.

- [ ] **Step 2: Enable 2FA on the npm account**

npmjs.com → Account → Two-Factor Authentication (security key). The account had none at the flip
(SESSION_LOG #334).

- [ ] **Step 3: Register the trusted publisher on each package**

For each of the 42: npmjs.com → package → Settings → Trusted Publisher → GitHub Actions, with exactly:
Organization or user `grzott`, Repository `flare-engine`, Workflow filename `release.yml`, Environment
name empty. Tick the package in Step 1's list.

---

### Task 3: Ship the `sharp` CVE fix as the proof payload

**Files:**
- Modify: `packages/cli/package.json:48` (`sharp`)
- Create: `.changeset/cli-sharp-advisory.md`
- Test: `packages/cli/tests/pack-atlas.test.ts` (existing)

- [ ] **Step 1: Capture the advisory ids**

Run: `gh api repos/grzott/flare-engine/dependabot/alerts --jq '.[] | select(.state=="open" and .dependency.package.name=="sharp") | .security_advisory.ghsa_id' | sort -u`
Expected: one or more `GHSA-…` ids (the audit names `GHSA-f88m-g3jw-g9cj`). Use what this prints, not
the audit's prose.

- [ ] **Step 2: Bump and install**

Set `"sharp": "^0.35.5"` in `packages/cli/package.json`, then run `bun install`.
Expected: `bun.lock` updated, install exits 0.

- [ ] **Step 3: Check the Node floor**

Run: `grep -A2 '"engines"' node_modules/sharp/package.json`
Expected: a `node` range satisfied by `>=20` (the CLI's floor, `packages/cli/package.json:50-52`). If it
is not, stop: raising the CLI's Node floor is a breaking change and needs the owner.

- [ ] **Step 4: Run the CLI tests**

Run: `bunx turbo test --filter=@flare-engine/cli`
Expected: PASS, including `pack-atlas.test.ts`.

- [ ] **Step 5: Write the changeset**

`.changeset/cli-sharp-advisory.md`:

```markdown
---
'@flare-engine/cli': patch
---

Bump the sharp dependency of `flare pack-atlas` to 0.35.5, fixing <ids from Step 1>.
```

(`flare pack-atlas` is a command, not a symbol — if `check:changeset-symbols` objects, drop the
backticks.)

- [ ] **Step 6: Gate**

Run: `bash .claude/hooks/verify.sh "fix(cli): bump sharp past open advisories" engine "none"`
Expected: all gates green; commit block emitted.

- [ ] **Step 7: Commit (owner)**

Run the emitted commit block (it lists `packages/cli/package.json`, `bun.lock`, the changeset; add
`SESSION_LOG.md` if verify.sh does not).

---

### Task 4: Switch `release.yml` to Trusted Publishing and prove it

**Files:**
- Modify: `.github/workflows/release.yml:33-35` (comment), `:70` (env)
- Modify: `AGENTS.md:60-62` ("The publish token has a deadline")
- Modify: `docs/plans/todo.md` (RELEASE-OIDC-1 → Done)

**Interfaces:**
- Consumes: Task 2 complete (all 42 ticked); Task 3 merged (the pending changeset).

- [ ] **Step 1: Remove the token**

Delete `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` from the changesets step's `env`. Keep
`id-token: write` (`:20`), `NPM_CONFIG_PROVENANCE: "true"` and the `npm@11` install. Rewrite the
comment at `:33-35` so it no longer refers to "the NPM_TOKEN .npmrc changesets/action writes": the
reason to omit `registry-url` is that setup-node's `.npmrc` would inject a `NODE_AUTH_TOKEN` auth line
and shadow OIDC.

- [ ] **Step 2: Verify no token reference remains**

Run: `grep -n "NPM_TOKEN" .github/workflows/*.yml`
Expected: no output.

- [ ] **Step 3: Commit (owner)**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): publish through npm trusted publishing"
```

- [ ] **Step 4: Pre-release perf check**

Run: `bun run check:perf-freshness`
Expected: green. If red (lanes stale — expected after ~2026-11-19), recapture first per `verify.sh`'s
comment (`bun run bench` ×5 from a clean tree → `bench:promote` → `bench:md`; the Android lane needs the
Pixel 7 at home), then continue.

- [ ] **Step 5: Version and push (owner)**

Run `bun run version` (bumps all 42 to `0.4.6` lockstep), add the root `CHANGELOG.md` entry by hand,
then commit `chore(release): 0.4.6` and push `main`.

- [ ] **Step 6: Verify the publish**

Run: `gh run list --workflow release.yml --limit 1` then `gh run view <id> --log | grep -E "trusted publishing|published"`
Expected: the line "No NPM_TOKEN found, but OIDC is available - using npm trusted publishing", and 42
published packages at `0.4.6`. Spot-check provenance: WebFetch
`https://registry.npmjs.org/@flare-engine/engine/0.4.6` shows a `dist.attestations` entry.

- [ ] **Step 7: Update the release posture and the queue**

`AGENTS.md:60-62`: replace the deadline bullet with "**Publishing uses npm Trusted Publishing.**
`release.yml` authenticates by OIDC (`id-token: write`); there is no publish token. A local
`bun run release` cannot publish." Move RELEASE-OIDC-1 to `## Done` in `todo.md` with the run id.

- [ ] **Step 8: Commit (owner)**

```bash
git add AGENTS.md docs/plans/todo.md
git commit -m "docs: record trusted publishing as the release path"
```

---

### Task 5: Post-flip versioning posture and the ADR rule

**Files:**
- Modify: `AGENTS.md` (Tooling bullets 2–3: "`patch` is the default…" and "Pre-flip, the answer…")
- Modify: `docs/plans/versioning-and-announcements.md` (whole "The posture" section, "Reserved numbers")
- Modify: `docs/design/adr-0000-template.md:20` (the consumer-observable-behaviour paragraph)
- Modify: `scripts/check-bump-level.mjs` (header comment only — "a stray `minor` opens `0.4.0`")

- [ ] **Step 1: Rewrite the AGENTS.md Tooling bullets**

Bullet 2 states: `patch` is the default; a `minor` or `major` is an owner decision because lockstep moves
all 42 packages (a `minor` opens the next `0.x` line, a `major` publishes `1.0.0`); `check:bump`
refuses above-`patch` without an accepted ADR; **ADRs are for breaking changes — a bug fix needs none,
even when it changes observable behaviour.** Bullet 3 replaces the pre-flip posture: the packages are
public with outside consumers, so breaking changes batch into planned minors behind a deprecation
window, and links the versioning doc.

- [ ] **Step 2: Rewrite the versioning doc**

`versioning-and-announcements.md` becomes post-flip:
- **Posture:** public since 2026-10-26; breaking changes batch into the next planned minor (`0.5.0`).
- **Deprecation policy:** a symbol is marked `@deprecated` (JSDoc, with the replacement named) in at
  least one `patch` before its removal in the next minor; the removal's changeset names it.
- **Stability tiers** — one table, all 42 packages, tier per package by these criteria: *stable* = used
  by at least one owner-operated consumer (PT, flare-engine-page, grzott-portfolio, or a `create`
  template) and covered by tests; *beta* = tested, no consumer; *experimental* = interface/Noop-only or
  already labelled beta in `api-specs.md` with no consumer. Consumers come from
  `docs/plans/_local/post-flip-audit-2026-10/audit-engine-health.md` §5, `audit-pt.md` §3,
  `audit-page.md` §3 and `audit-portfolio.md` §2.
- **Reserved numbers:** `0.4.x` = the current line (patch-only); `0.5.0` = the next planned minor, cut
  under an accepted ADR; `1.0.0` = the API-stability milestone, criteria in a future ADR.
- Keep "Obligation when an above-`patch` change lands" unchanged.
- Public wording only: nothing from the private design beyond what this step lists (D22).

- [ ] **Step 3: Reword the ADR template trigger**

Replace the paragraph starting at `adr-0000-template.md:20` with: ADRs are written for breaking changes (an
exported symbol removed or changed, a peer floor raised, a documented contract changed). A bug fix that
makes the code match its documented contract needs no ADR.

- [ ] **Step 4: Fix the stale gate comment**

In `scripts/check-bump-level.mjs`'s header, replace the `0.4.0` freeze-cut wording with "a stray
`minor` opens the next `0.x` line". Comment only — no logic change.

- [ ] **Step 5: Verify the gates still bite**

Create a scratch changeset `.changeset/zz-probe.md` with frontmatter `'@flare-engine/math': minor`, run
`bun run check:bump`, expect exit 1 naming the missing ADR, then delete `zz-probe.md`. Then run
`bun run check:bump && bun run lint && bun run check:readme`.
Expected: refusal on the probe; all green after removing it.

- [ ] **Step 6: Commit (owner)**

```bash
git add AGENTS.md docs/plans/versioning-and-announcements.md docs/design/adr-0000-template.md
git add scripts/check-bump-level.mjs
git commit -m "docs: post-flip versioning posture and adr scope"
```

---

### Task 6: Token and secret teardown (owner)

**Files:** none.

- [ ] **Step 1: Read tokens (packages are public; nothing needs them)**

flare-engine-page Cloudflare build variables: delete `NPM_TOKEN` and `PUBLIC_TURNSTILE_SITE_KEY`
(page audit §9); revoke the GitHub PAT behind `ENGINE_READ_TOKEN`; remove the PT secret and any
`.npmrc` auth line in PT; delete the read token on npmjs.com; unset the local `NPM_TOKEN` environment
variable.

- [ ] **Step 2: Publish token (only after Task 4 Step 6 passed)**

`gh secret delete NPM_TOKEN --repo grzott/flare-engine`; revoke the Bypass-2FA token on npmjs.com; on each
package set Publishing access to "Require two-factor authentication and disallow tokens" (Trusted
Publishing keeps working).

- [ ] **Step 3: Verify**

Run: `gh secret list --repo grzott/flare-engine`
Expected: no `NPM_TOKEN`.
