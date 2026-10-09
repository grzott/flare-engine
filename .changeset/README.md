# Changesets

This directory tracks per-change version bumps for the `@flare-engine/*` packages.

## Adding a changeset

```bash
bun changeset
```

Select packages, choose bump type (patch/minor/major), and write a short summary. Commit the generated markdown file alongside your code change. `patch` is the default; a `minor` or `major` must cite an accepted ADR or `bun run check:bump` refuses it (see `AGENTS.md`).

## Releasing

1. `bun run version` — `check:bump`, then `changeset version` (consumes pending changesets, bumps versions, writes each package's `CHANGELOG.md`), then `scripts/concretize-workspace-deps.ts` (rewrites `workspace:*` to `^x.y.z`), then `bun install`. Run the whole chain, not `changeset version` alone: the last two stages are what keep a published manifest installable.
2. Review the diff, commit, merge to `main`.
3. `bun run release` — builds every package, runs the publish-safety and perf gates, and publishes to npm.

All `@flare-engine/*` packages are versioned in lockstep via the `fixed` group in `config.json` — one word in one changeset moves all 42. `@flare-engine/benchmarks` and `@flare-engine-apps/bench-web` are ignored (never published).

## Publishing prerequisites (one-time)

- The `@flare-engine` org on npm (a paid plan while packages publish `restricted`).
- Authenticate locally with a granular access token in `~/.npmrc`.
- For CI release: set the `NPM_TOKEN` repo secret and the `ENABLE_RELEASE=true` repo variable.
- Every package carries `publishConfig.access`: `restricted` until the public flip, `public` after it (`docs/plans/flip-runbook.md`). A `private` package with `access: "public"` fails `check:publish-safety`.
