# Changesets

This directory tracks per-change version bumps for the `@flare-engine/*` packages.

## Adding a changeset

```bash
bun changeset
```

Select packages, choose bump type (patch/minor/major), and write a short summary. Commit the generated markdown file alongside your code change. `patch` is the default; a `minor` or `major` must cite an accepted ADR or `bun run check:bump` refuses it (see `AGENTS.md`).

## Releasing

Releases run in CI (`.github/workflows/release.yml`), never from a laptop:

1. A push to `main` with pending changesets makes `release.yml` open or refresh the "chore(release): version packages" PR on `changeset-release/main`. It runs `bun run version`: `check:bump`, then `changeset version` (consumes the changesets, bumps every package, writes each package's `CHANGELOG.md`), then `scripts/concretize-workspace-deps.ts` (rewrites `workspace:*` to `^x.y.z`), then `bun install`.
2. Add the root `CHANGELOG.md` row and section by hand in a separate PR; the version PR does not write it.
3. The version PR is held: the owner approves it once `ci` is green, and merging it is the release. `release.yml` then runs `bun run release` (build, publish-safety and perf gates) and publishes with npm provenance.

All `@flare-engine/*` packages are versioned in lockstep via the `fixed` group in `config.json` — one word in one changeset moves all 42. `@flare-engine/benchmarks` and `@flare-engine-apps/bench-web` are ignored (never published).

## Publishing prerequisites (one-time)

- The `@flare-engine` org on npm.
- npm Trusted Publishing: each published package lists `grzott/flare-engine` + `release.yml` as its trusted publisher, with direct publish allowed. `release.yml` authenticates by OIDC (`id-token: write`); there is no `NPM_TOKEN`, and a local `bun run release` cannot publish.
- The `ENABLE_RELEASE=true` repo variable (`release.yml` does nothing without it) and the `BOT_TOKEN` secret (the version PR must be opened by the bot so that CI and the gate run on it).
- Every published package carries `publishConfig.access: "public"`. A `private` package with `access: "public"` fails `check:publish-safety`.
