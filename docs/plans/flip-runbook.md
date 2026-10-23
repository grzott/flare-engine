# Flip runbook — public OSS launch (target Oct 26–28, 2026)

> **Dates moved 2026-10-09 (owner):** the Oct 5 freeze did not happen, so the plan's own fallback
> applies — freeze + `0.4.0` restricted publish **Mon Oct 12**, manual window **Oct 12–25**, flip
> **Oct 26–28**. Where this file still says Oct 5 / Oct 18 / Oct 20 in a quoted record, read it as
> the original schedule.

The step-by-step to take Flare from restricted/private to public. Executed in the
**OSS-I1 owner+agent pairing session** (road-to-oss §12); rehearsed end-to-end on
verdaccio in **OSS-F2** before the real thing. Check each box in this file as you go.

> **This is effectively ONE-WAY.** npm package visibility is **retroactive across
> every published version** (0.1.0, 0.2.x, 0.3.x, 0.4.0) and cannot be cleanly undone.
> Do the dry-runs, complete the freeze (H1) and the two-week manual window first,
> and only start step 3 once you are committed to launching.

## Lanes

- **Owner** — anything needing GitHub settings, npm auth/OTP, DNS, or a git
  commit/push/tag. Builders never run git or publish (repo boundary).
- **Agent** — file edits (workflow/manifest/changeset), dry-runs, verification.

> **An agent cannot run `npm` at all** (corrected 2026-09-07, §4.2). `.claude/settings.json`
> denies `Bash(npm:*)` and `Bash(npx:*)`, and `.claude/hooks/pre-bash-guard.sh`'s `FORBIDDEN_PM`
> blocks npm/npx/yarn/pnpm — unwrapping `bash -c`, `eval` and `bun -e` wrappers, so there is no
> way around it. **Every step in this file that runs `npm pack`, `npm view` or `npm access` is
> therefore owner-only or owner-paired, whatever its lane says**, including the ×42 tarball and
> provenance verification below. Adding a `--registry` flag to a bun script does not change this;
> the block is on the binary, not the flags. If a step needs to be agent-runnable, it has to be
> re-expressed as a bun script that shells to something other than npm.

## Ordering invariants (do NOT reorder)

Repo public → provenance on → npm access flip → flip commit → version+publish →
domain bind → verify. Each step's rollback window is noted; after step 3 there is
no clean rollback.

---

## Pre-flight (before flip day — completed by freeze, Oct 12)

- [ ] **H1 done:** `0.4.0` published **restricted** — all **42** scoped packages, the first
      publish of `@flare-engine/create` included; the two-week manual window
      (Oct 12–25) passed with no launch-blockers (road-to-oss §11).
      **Publish half done 2026-10-12** (`c00b173`, 42 tags pushed); open for the window.
- [x] **F2 done (2026-07-15):** rehearsed on verdaccio — engine resolves with zero
      `workspace:`/`0.0.0` leaks, `render-web` installs with no RN tree, published
      tarballs carry `Apache-2.0` + `LICENSE` + `NOTICE`. Three rehearsal rules folded
      in: ~~a local `bun run version` needs `changelog:false`/`GITHUB_TOKEN` (step 5)~~
      — **struck 2026-09-07, it was never true**: `.changeset/config.json` sets
      `"changelog": "@changesets/cli/changelog"`, the built-in generator, which makes no
      GitHub calls (`@changesets/changelog-github` at `package.json:59` is an unused
      devDependency — drop it post-flip); the
      cold-consumer test points the **default** registry at verdaccio, not a scope
      config (transitive non-Flare deps must come through verdaccio's npmjs uplink too);
      and every verification runs from a **fresh tree with no lockfile** at a **throwaway
      version** (`0.4.99`, never a live number) — a lockfile records the registry it
      resolved from, so re-installing in the tree that published re-serves the local
      build, `--force` included. Purging the npm/bun cache is **not** the remedy: the
      caches are registry-keyed, so a purge changes nothing and hides the lockfile as the
      cause (XR-11 — found 2026-09-01, after this box was ticked).
      One launch bug surfaced — the templates' `react` pin is too low for RN 0.86's
      peer — **fixed 2026-07-24 (OSS-B32)**.
      **A fourth rehearsal rule, recovered 2026-09-07 (pre-flip audit §4.2) and corrected
      2026-10-09: it covers every manifest, not one.** **All 42** `packages/*/package.json`
      carry `publishConfig.registry: "https://registry.npmjs.org/"` (since `be17caf`,
      2026-04-17), and npm/changesets honour a manifest's `publishConfig` **over any
      `.npmrc`**. The 2026-09-07 text named only the scaffolder; but without a redirect of
      *every* pin, `bun run release` on the throwaway branch publishes all 42 at the
      throwaway version (`0.4.99`) to the **real** registry — restricted today, public the
      moment the flip runs, and `0.4.99` sorts above every real `0.4.x`, so it would become
      what `npm install` resolves. July's rehearsal must have redirected all of them (the
      real `0.3.0` publish in August succeeded, so nothing had reached npmjs). On the
      throwaway branch, before releasing:
      `bun -e 'const fs=require("fs");for(const d of fs.readdirSync("packages")){const p="packages/"+d+"/package.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.publishConfig){j.publishConfig.registry="http://localhost:4873/";fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")}}'`
      — then `git diff --stat` must show 42 manifests. After each rehearsal publish, assert
      `npm view @flare-engine/engine@0.4.99 --registry https://registry.npmjs.org/` and
      `npm view @flare-engine/create@0.4.99 --registry https://registry.npmjs.org/` both
      **404**. Keep the real pins untouched in the flip commit.
- [ ] **Registry hygiene — on the machine that ran the freeze window, before step 1:**
      verdaccio stopped (nothing listening on 4873 or 4874); `npm config get registry`
      prints `https://registry.npmjs.org/`; no `registry=` line left in `$HOME/.npmrc`;
      every freeze-window scaffold directory deleted so no verdaccio-resolved lockfile
      survives into flip-day verification. The freeze window's override is **user-level**
      and nothing else in this runbook would notice it still set (XR-11).
      **2026-10-23:** the window's §1 runs authenticated against npmjs, not verdaccio
      (manual-test-protocol.md, owner decision), so this is a check rather than a teardown.
- [ ] **Nothing stale goes public with the repo (added 2026-10-23):** every branch and open
      PR becomes visible at Step 1. Delete the six April `copilot/*` remote branches (five
      point at `996ce1f`, an abandoned line 14 commits off `main` whose `.claude/settings.json`
      carries local paths; `market-research-rn-mobile-games` is already merged), and close the
      three Dependabot PRs (#7, #8, #9 — dependency bumps are out of scope during the freeze;
      #7 fails `bench-dashboard`'s build and #9 fails `check:perf-bytes`). Done when
      `git ls-remote --heads origin` lists only `main` (plus any branch you mean to publish)
      and `gh pr list` is empty.
- [x] **F3 done:** tarball audit clean (or every old-version hit has an owner
      disposition, §14). **This box stays open even though todo.md records OSS-F3 as
      Done — both are right, read carefully.** The HEAD-tarball half shipped in session
      #256; the **published-version half is OPEN** and owner-owed: that July run predates
      `0.3.0` and `0.3.1`, so it must be re-run over **five versions (0.1.0, 0.2.0, 0.2.1,
      0.3.0, 0.3.1) and again over 0.4.0 after H1** — authenticated, on a machine with no
      verdaccio and no registry override, *before* the window stands one up
      (`scripts/lib/pack.mjs:23` inherits ambient npm config).
      **Five-version half done 2026-10-12:** 198/198 fetched, 0.3.0/0.3.1 clean, every
      0.1.0–0.2.1 hit dispositioned in the ledger. **0.4.0 re-run done 2026-10-12, before
      any verdaccio:** 42/42 fetched, all Apache-2.0, 0 hits.
- [x] **F4 done:** freeze-time secret re-scan clean / owner-accepted (§9 F4). 2026-10-12 at
      `23bd323`: 0 secret hits across 1158 commits.
- [x] **Perf gate green:** every hard item in the "Perf gate (single source)" block of
      road-to-oss §11 / OSS-H1. Not restated here on purpose — one source per fact.
      Green at `c00b173`, 2026-10-12 (capture `cc47ab7`, Oct 10).
- [x] **npm auth ready:** granular publish token (Bypass-2FA) in `~/.npmrc`, the
      `@flare-engine` org on a paid plan, credential rotation done (§14). Rotated
      2026-10-12, expiry recorded in the ledger; the 0.4.0 publish proved it. Keep the
      2FA device handy for `--otp` on the access flip.
      **Set an explicit expiry and record it (added 2026-09-07, §4.2).** npm removed
      legacy tokens in November 2025 — only granular tokens exist now, and a granular
      token carries an expiry chosen at creation, minimum one day out. A token rotated
      "now" with a short expiry **dies before the flip and the failure surfaces at FW-9 —
      after the access flip's point of no return, on the path that has never executed.**
      So: expiry **≥ Nov 15, 2026** (the flip moved to Oct 26–28); confirm the token
      covers all 42 `@flare-engine/*` names (a scope-wide grant does); write the
      expiry date into the owner ledger. Also note npm's August 2026 change — a
      Bypass-2FA token can no longer perform account-identity or account-governance
      actions, though publishing still works; that is what the `--otp` device is for.
- [ ] **Token still valid on flip day (FW-0):** `npm whoami` locally, and check the
      recorded expiry — "the Actions secret holds the rotated token" is not the same as
      "the token still works". If it would lapse inside the window, rotate **before** the
      access flip, never after.
- [x] ~~**`create-flare-app` name still free**~~ — **failed 2026-09-11 and retired
      2026-10-09.** An unrelated publisher (`oksigen`) took the unscoped name. Per
      [ADR-0007](../design/adr-0007-scaffolder-is-flare-engine-create.md) the scaffolder is
      `@flare-engine/create`: inside the scope, published `restricted` at H1 with the other
      41, so flip day no longer contains a first publish. Its replacement check:
- [ ] **Scaffolder on the registry:** `npm view @flare-engine/create version` (authenticated)
      prints the freeze version, and the manual window's §1 scaffolded from it.
      Registry half done 2026-10-12 (`0.4.0`); `0.4.2` is on npmjs (PT and the page install
      it); open for window §1.
- [x] **Owner ratified:** flip date, `.claude/`/SESSION_LOG go public, author-email
      stance (§14). 2026-10-12: all yes, flip Oct 26–28, history kept as-is.

---

## Step 1 — GitHub repo → public **(owner, first)**

- [ ] Owner: GitHub → **Settings → General → Danger Zone → Change visibility → Public**.

**Side effects (acknowledge before clicking):** stars/watchers reset to 0; the
Actions run history becomes publicly visible; existing **private forks detach**
(they do not become public); ~~**push rulesets are disabled** on visibility change —
re-enable branch protection on `main` right after~~ — **struck 2026-09-07: moot. There
are no rulesets and no branch protection to disable.** The repo is private on a free
plan, and both `gh api repos/grzott/flare-engine/rulesets` and
`.../branches/main/protection` return 403 *"Upgrade to GitHub Pro or make this
repository public"*.

- [ ] Owner: apply branch protection on `main` **for the first time** — this is not a
      re-application. Two constraints, or it breaks the flip it is meant to protect:
      the ruleset **must allow the owner's direct push to `main`** (FW-9 pushes `main`
      directly; FW-13/FW-15 commit directly) and **must not block `GITHUB_TOKEN` from
      creating tags and releases** (`changesets/action` does both, and `release.yml`
      grants `contents: write` for exactly that). **Safer still: do this after FW-9 and
      FW-13**, so nothing on the critical path can be blocked by a ruleset that has
      never been exercised.

- [ ] Owner: **Settings → Security → Code security** — enable **Private vulnerability
      reporting** (added 2026-10-23: `SECURITY.md` tells reporters to use GitHub's "Report a
      vulnerability" button, which does not exist until this is on), **Secret scanning** and
      **Push protection** (free on public repos), and **Dependabot alerts**. None of these were
      available while the repo was private on the free plan.
- [ ] Owner: **Settings → General → Social preview** — upload an image (1280×640). The API
      cannot set it; without one, link previews show a generated card. Description, homepage
      (`https://flareengine.dev`) and 14 topics were set 2026-10-23, Projects tab off,
      delete-branch-on-merge on.

**Rollback:** reversible (flip back to private), but stars/watchers and fork
links do **not** come back. Safe to pause here.

## Step 2 — Provenance on **(agent edit, owner verifies)**

Provenance was removed in S4b; re-add it now that the repo is public.

- [ ] Agent: add `NPM_CONFIG_PROVENANCE: "true"` to **the `env:` block of the
      `changesets/action` step** in `.github/workflows/release.yml` — beside
      `GITHUB_TOKEN` and `NPM_TOKEN` at `:56-58` — not to a job-level `env`
      (fold into the step-4 flip commit). `release.yml` already declares
      `id-token: write`. **Note the file has two `env:` blocks**, not one: the other is
      `FLARE_PERF_BASE_REF` on the `check:perf` step at `:44-45`. Anything that calls
      one of them "the only env block in the file" is describing an older file.
- [ ] Owner: confirm the release runner has **npm ≥ 11.5.1** — `release.yml` installs
      `npm@11` after `actions/setup-node` since 2026-10-09 and prints `npm --version`;
      read that line in the run log. Provenance also requires a public repo (step 1) +
      public packages (steps 3–5) — all true by publish time.

**Rollback:** trivial (revert the env line).

## Step 3 — npm access flip **(owner, `--otp`)**

Flip the **42 scoped** `@flare-engine/*` packages from restricted → public. This
exposes every already-published version.

- [ ] Owner (dry-run): `bun scripts/flip-access.mjs` → confirm it lists **exactly
      42** `@flare-engine/*` names, `@flare-engine/create` among them, and mutates nothing.
- [ ] Owner (live): `bun scripts/flip-access.mjs --execute --otp <code>`.
      Serial + resumable — already-public packages are skipped, so on an
      expired-OTP / network failure just re-run with a fresh `--otp`.

**Rollback:** ⚠ **effectively NONE.** Public npm visibility is retroactive and
one-way (re-privatizing requires unpublish, which npm restricts to a 72h window
and blocks once packages have dependents). **This is the point of no return.**

## Step 4 — The flip commit **(agent edits, owner commits + tags)**

ONE commit, tagged, containing every visibility flip so a single revert is
possible right up until publish. Without the version-bump changeset, `changeset
publish` would skip all 42 already-published packages and no fresh
provenance-stamped release would exist.

- [ ] Agent: `packages/*/package.json` — 42× `"publishConfig": { "access":
      "restricted" }` → `"public"` (keep each `registry` pin).
- [ ] Agent: `.changeset/config.json` — `"access": "restricted"` → `"public"`.
- [ ] Agent: add a version-bump-only lockstep **patch** changeset (all 42
      `@flare-engine/*`) so the fixed group cuts a fresh
      release. (H1 already shipped the `0.4.0` minor; this is the patch bump that
      re-cuts the group public.)
- [ ] Agent: also fold in the step-2 `NPM_CONFIG_PROVENANCE` edit.
- [ ] Agent (added 2026-10-23): the root docs that describe the pre-flip state —
      `README.md` "Status" (the "Public OSS launch: October 2026 … flips from restricted to
      public" line), `README.md` "Getting Started" (the "Until the October 2026 public launch
      the scope is restricted on npm; from a clone, run …" sentence) and `CONTRIBUTING.md:5`
      ("Before the public OSS launch (October 2026)"). Rewrite them to the shipped state.
      No package README carries pre-flip wording (checked 2026-10-23), so nothing stale
      ships to npm with the fresh release.
- [ ] Owner: commit + tag (e.g. `git tag v0.4.x-public`), do **not** push yet.

**Rollback:** revert the commit (npm access from step 3 stays flipped — that part
is done).

## Step 5 — Version + publish **(owner)**

Cut and ship the fresh, public, provenance-stamped lockstep release for all 42 scoped packages.

- [ ] Owner: `bun run version` — a **four-stage chain**, not two
      (`package.json:52`): `check:bump` → `changeset version` →
      `scripts/concretize-workspace-deps.ts` → `bun install`. The omitted stages are the
      ones that bite: **`check:bump` refuses an above-`patch` changeset that cites no
      Accepted ADR**, and **`bun install` rewrites `bun.lock`, which must be committed
      with the bump**. Concretize rewrites internal `workspace:*` → `^<version>`; the S5
      rehearsal proved that is required or tarballs ship broken deps.
      *(No `GITHUB_TOKEN` is needed locally. The earlier note claiming otherwise was
      wrong and is struck at the F2 box above — the configured changelog generator is
      the built-in `@changesets/cli/changelog`, which makes no network calls.)*
- [ ] Owner: review the version bump + regenerated `CHANGELOG`s; commit.
- [ ] Owner: publish through **CI only** — push `main` with `vars.ENABLE_RELEASE
      == 'true'` so `release.yml` runs `bun run release` with the step-2
      `NPM_CONFIG_PROVENANCE` env + OIDC (`id-token: write`). A **local** `bun run
      release` produces **no provenance** (npm provenance requires a CI/OIDC runner —
      a laptop has no OIDC token) and silently ships a non-provenance release, so it
      is **not** the flip path — reserve local `bun run release` for the F2 verdaccio
      rehearsal, where provenance is not asserted.
- [ ] **Owner** (not agent — see the lane note below): no `workspace:`/`0.0.0` leaks in the
      published tarballs — fetch each with an
      explicit `npm pack --registry https://registry.npmjs.org/ @flare-engine/<pkg>@<version>`
      into an empty directory, never by installing in a tree that carries a lockfile.
      **`<version>` is what `packages/engine/package.json` reads after `bun run version`
      (or `@latest`) — NOT `0.4.0`.** `0.4.0` is the *restricted freeze cut*, published
      before the window and carrying no provenance; packing it verifies the wrong
      artefact and the provenance assertion below would fail on a correct release. The
      flip ships a fresh `0.4.x` public re-cut. A
      verdaccio-resolved lockfile or an ambient `registry=` hands you the local build, and
      it passes this check because concretize ran locally too (XR-11); provenance
      shows on the fresh release (`npm view @flare-engine/engine`).

**Rollback:** publishes are **not** cleanly reversible (unpublish restrictions).

## Step 6 — Docs-site domain bind **(owner)**

- [ ] Owner (flare-engine-page repo): run the final production deploy (G2 pre-flip work
      already green). **flareengine.dev is already bound and serving** — the page repo
      deployed to it on 2026-07-01 and verified the WASM MIME type on the live Worker on
      2026-08-27 (found 2026-09-29), so this step is the deploy, not a domain bind. The 6
      links into the now-public engine repo go live here.
- [ ] Owner (Cloudflare dashboard, any time before this deploy): the zone's bot **JavaScript
      detections** snippet is injected per request with a ray ID, so the site's hash-only
      `script-src` can never allow it; it is the last console error behind best-practices 93
      (manual-test-protocol §7 row 6). Bot Fight Mode is off (2026-10-23, Security → Settings →
      DDoS attacks). JavaScript detections cannot be switched off on the Free plan, and the
      snippet was still injected after Bot Fight Mode went off, so this box closes on the owner's
      decision recorded in §7 row 6, not on a toggle.

**Rollback:** reversible (unbind domain).

## Step 7 — Post-flip verification (OSS-I2)

Run the full battery — see road-to-oss §12 / the OSS-I2 row:

- [ ] **Registry proven, before anything else in this step:** verdaccio not running;
      `npm config get registry` → `https://registry.npmjs.org/`; no `.npmrc` `registry=`
      line in the test directory or `$HOME`. "No token" is not an isolation — verdaccio
      serves anonymous reads too, so a tokenless run against a stale override passes
      while testing the local build (XR-11).
- [ ] Tokenless cold scaffold from the **public** registry:
      `npm create @flare-engine my-<tpl> -- --template <tpl>` (all three templates) on a
      machine with no npm token,
      each into a **new empty directory** — no lockfile or `node_modules` reused from the
      freeze window, whose scaffolds installed the restricted `0.4.2` with a token.
- [ ] `npm view @flare-engine/engine` shows **public** + **provenance** on the fresh release.
- [ ] Docs-site links into the public repo resolve; README badges live (add the CI badge).
- [ ] Lighthouse on the live site (`/`, `/getting-started/`, `/showcases/`,
      `/showcases/overrun/`, mobile + desktop): accessibility and best-practices 100,
      getting-started desktop CLS 0 — the live re-check of manual-test-protocol §7 rows 6-8.
- [ ] GitHub **Community Standards** checklist green (Insights → Community).
- [ ] Owner: enable **Discussions**.
- [ ] Agent: flip `docs/plans/roadmap.md` + `road-to-oss-2026-09.md` to "shipped"
      state; update memory.

---

## Reversibility at a glance

| Step | Action | Reversible? |
|---|---|---|
| 1 | Repo → public | Yes (stars/forks don't restore) |
| 2 | Provenance env | Yes (revert line) |
| 3 | **npm access flip** | **No — retroactive, one-way** |
| 4 | Flip commit | Yes (revert commit; access stays flipped) |
| 5 | Version + publish | No (unpublish restricted) |
| 6 | Domain bind | Yes |
| 7 | Verification | n/a |

**Abort points:** cleanly abortable through **step 2**. Step 3 is the point of no
return. If something is wrong at step 4+, you finish the launch rather than
un-launch — fixes go out as `0.4.x` patches.
