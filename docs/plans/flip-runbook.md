# Flip runbook — public OSS launch (target Tue Oct 20, 2026)

The step-by-step to take Flare from restricted/private to public. Executed in the
**OSS-I1 owner+agent pairing session** (road-to-oss §12); rehearsed end-to-end on
verdaccio in **OSS-F2** before the real thing. Check each box in this file as you go.

> **This is effectively ONE-WAY.** npm package visibility is **retroactive across
> every published version** (0.1.0, 0.2.x, 0.3.0) and cannot be cleanly undone.
> Do the dry-runs, complete the freeze (H1) and the two-week manual window first,
> and only start step 3 once you are committed to launching.

## Lanes

- **Owner** — anything needing GitHub settings, npm auth/OTP, DNS, or a git
  commit/push/tag. Builders never run git or publish (repo boundary).
- **Agent** — file edits (workflow/manifest/changeset), dry-runs, verification.

## Ordering invariants (do NOT reorder)

Repo public → provenance on → npm access flip → flip commit → version+publish →
domain bind → verify. Each step's rollback window is noted; after step 3 there is
no clean rollback.

---

## Pre-flight (before flip day — completed by freeze, Oct 5)

- [ ] **H1 done:** `0.3.0` published **restricted**; the two-week manual window
      (Oct 5–18) passed with no launch-blockers (road-to-oss §11).
- [ ] **F2 done:** this runbook rehearsed on verdaccio; every command below ran
      clean against a throwaway registry; corrections folded back in.
- [ ] **F3 done:** tarball audit clean (or every old-version hit has an owner
      disposition, §14).
- [ ] **F4 done:** freeze-time secret re-scan clean / owner-accepted (§9 F4).
- [ ] **npm auth ready:** granular publish token (Bypass-2FA) in `~/.npmrc`, the
      `@flare-engine` org on a paid plan, credential rotation done (§14). Keep the
      2FA device handy for `--otp` on the access flip.
- [ ] **Owner ratified:** flip date, `.claude/`/SESSION_LOG go public, author-email
      stance (§14).

---

## Step 1 — GitHub repo → public **(owner, first)**

- [ ] Owner: GitHub → **Settings → General → Danger Zone → Change visibility → Public**.

**Side effects (acknowledge before clicking):** stars/watchers reset to 0; the
Actions run history becomes publicly visible; existing **private forks detach**
(they do not become public); **push rulesets are disabled** on visibility change —
re-enable branch protection on `main` right after.

- [ ] Owner: re-apply branch protection / push rulesets on `main`.

**Rollback:** reversible (flip back to private), but stars/watchers and fork
links do **not** come back. Safe to pause here.

## Step 2 — Provenance on **(agent edit, owner verifies)**

Provenance was removed in S4b; re-add it now that the repo is public.

- [ ] Agent: add `NPM_CONFIG_PROVENANCE: "true"` to the `release` job `env` in
      `.github/workflows/release.yml` (fold into the step-4 flip commit).
      `release.yml` already declares `id-token: write`.
- [ ] Owner: confirm the release runner has **npm ≥ 11.5.1** (GitHub-hosted
      runner; add `npm i -g npm@latest` before publish if the pinned image is
      older). Provenance also requires a public repo (step 1) + public packages
      (steps 3–5) — all true by publish time.

**Rollback:** trivial (revert the env line).

## Step 3 — npm access flip **(owner, `--otp`)**

Flip the **40 scoped** `@flare-engine/*` packages from restricted → public. This
exposes every already-published version.

- [ ] Owner (dry-run): `bun scripts/flip-access.mjs` → confirm it lists **exactly
      40** `@flare-engine/*` names and mutates nothing.
- [ ] Owner (live): `bun scripts/flip-access.mjs --execute --otp <code>`.
      Serial + resumable — already-public packages are skipped, so on an
      expired-OTP / network failure just re-run with a fresh `--otp`.
- [ ] `create-flare-app` is unscoped → public by default once `private:false`
      (step 4); it is **not** in the flip-access set.

**Rollback:** ⚠ **effectively NONE.** Public npm visibility is retroactive and
one-way (re-privatizing requires unpublish, which npm restricts to a 72h window
and blocks once packages have dependents). **This is the point of no return.**

## Step 4 — The flip commit **(agent edits, owner commits + tags)**

ONE commit, tagged, containing every visibility flip so a single revert is
possible right up until publish. Without the version-bump changeset, `changeset
publish` would skip the 40 already-published scoped packages (only
`create-flare-app` would ship) and no fresh provenance-stamped release would exist.

- [ ] Agent: `packages/*/package.json` — 40× `"publishConfig": { "access":
      "restricted" }` → `"public"`.
- [ ] Agent: `.changeset/config.json` — `"access": "restricted"` → `"public"`.
- [ ] Agent: `packages/create-flare-app/package.json` — `"private": true` →
      `false`.
- [ ] Agent: add a version-bump-only lockstep **patch** changeset (all
      `@flare-engine/*` + `create-flare-app`) so the fixed group cuts a fresh
      release. (H1 already shipped the `0.3.0` minor; this is the patch bump that
      re-cuts the group public.)
- [ ] Agent: also fold in the step-2 `NPM_CONFIG_PROVENANCE` edit.
- [ ] Owner: commit + tag (e.g. `git tag v0.3.x-public`), do **not** push yet.

**Rollback:** revert the commit (npm access from step 3 stays flipped — that part
is done).

## Step 5 — Version + publish **(owner)**

Cut and ship the fresh, public, provenance-stamped lockstep release for all 41.

- [ ] Owner: `bun run version` — runs `changeset version` **and**
      `concretize-workspace-deps` (rewrites internal `workspace:*` → `^<version>`;
      the S5 rehearsal proved this is required or tarballs ship broken deps).
- [ ] Owner: review the version bump + regenerated `CHANGELOG`s; commit.
- [ ] Owner: publish through **CI only** — push `main` with `vars.ENABLE_RELEASE
      == 'true'` so `release.yml` runs `bun run release` with the step-2
      `NPM_CONFIG_PROVENANCE` env + OIDC (`id-token: write`). A **local** `bun run
      release` produces **no provenance** (npm provenance requires a CI/OIDC runner —
      a laptop has no OIDC token) and silently ships a non-provenance release, so it
      is **not** the flip path — reserve local `bun run release` for the F2 verdaccio
      rehearsal, where provenance is not asserted.
- [ ] Verify: no `workspace:`/`0.0.0` leaks in the published tarballs; provenance
      shows on the fresh release (`npm view @flare-engine/engine`).

**Rollback:** publishes are **not** cleanly reversible (unpublish restrictions).

## Step 6 — Docs-site domain bind **(owner)**

- [ ] Owner (flare-engine-page repo): bind **flareengine.dev** to the Workers
      deployment and run the final production deploy (G1/G2 pre-flip work already
      green). The 6 links into the now-public engine repo go live here.

**Rollback:** reversible (unbind domain).

## Step 7 — Post-flip verification (OSS-I2)

Run the full battery — see road-to-oss §12 / the OSS-I2 row:

- [ ] Tokenless cold scaffold from the **public** registry:
      `npm create flare-app@latest` (all three templates) on a machine with no npm token.
- [ ] `npm view @flare-engine/engine` shows **public** + **provenance** on the fresh release.
- [ ] Docs-site links into the public repo resolve; README badges live (add the CI badge).
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
un-launch — fixes go out as `0.3.x` patches.
