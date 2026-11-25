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
- npm Trusted Publishing: each published package lists `grzott/flare-engine` + `release.yml` as its trusted publisher, with direct publish allowed. `release.yml` authenticates by OIDC (`id-token: write`); there is no `NPM_TOKEN`, and a local `bun run release` cannot publish. A package that has never been published needs the two steps below first.
- The `ENABLE_RELEASE=true` repo variable (`release.yml` does nothing without it) and the `BOT_TOKEN` secret (the version PR must be opened by the bot so that CI and the gate run on it).
- Every published package carries `publishConfig.access: "public"`. A `private` package with `access: "public"` fails `check:publish-safety`.

## First publish of a new package

Without these two owner steps, a new package's first publish fails with `ENEEDAUTH`. The npm facts
were checked against npm's trusted-publisher and staged-publishing docs on 2026-11-16 and used for
`@flare-engine/ui-fx` (#378).

1. **Reserve the name, at any time.** A trusted publisher can only be added to a package that
   exists, so create the name with a staged placeholder.
   - In an empty folder outside the repo, write a `package.json` with the package's `name`, a
     prerelease `version` such as `0.0.1-reserve.0`, `"license": "Apache-2.0"`, and a `repository`
     of `git+https://github.com/grzott/flare-engine.git` with `"directory": "packages/<dir>"`. Add a
     one-line `README.md`.
   - Run `npx -y npm@11 stage publish --access public --tag reserve`. It creates a public
     `0.0.0-stage` placeholder, and the staged contents stay private. Use npm 11 (11.15.0 or
     newer): npm 12 needs Node `^22.22.2 || ^24.15.0 || >=26`. A prerelease version needs `--tag`.
   - Leave the staged version pending. Approving it publishes the placeholder, and rejecting it
     removes the name.
   - Check with `npx -y npm@11 view <name> versions --prefer-online`. Without `--prefer-online`, a
     cached 404 can show for a while.
   - In the package's settings, set publishing access to require two-factor authentication and
     disallow tokens, as on every other package.
2. **Add the trusted publisher in the release window.** An entry that no publish uses within 2 days
   expires and has to be deleted and recreated, so add it at most 2 days before the version PR that
   first publishes the package merges.
   - On the package page: Settings, Trusted publishing, add a GitHub Actions publisher with
     organization `grzott`, repository `flare-engine`, workflow `release.yml`, and no environment.
     The fields are case-sensitive, so copy them from an existing package's entry.
   - Under allowed actions, tick `npm publish`. New entries allow only staged publishing by default,
     and Changesets publishes directly.
   - The first publish from `release.yml` validates the entry.
