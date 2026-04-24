# Changesets

This directory tracks per-change version bumps for the `@flare-engine/*` packages.

## Adding a changeset

```bash
bun changeset
```

Select packages, choose bump type (patch/minor/major), and write a short summary. Commit the generated markdown file alongside your code change.

## Releasing

1. `bun changeset version` — consumes pending changesets, bumps versions, updates each package's `CHANGELOG.md`.
2. Review the diff, commit, merge to `main`.
3. `bun run release` — builds every package and publishes to npm.

All `@flare-engine/*` packages are versioned in lockstep via the `linked` group in `config.json`. `@flare-engine/benchmarks` is ignored (never published).

## Publishing prerequisites (one-time)

- Claim the `@flare-engine` scope on npm: https://www.npmjs.com/org/create (free for public packages)
- Authenticate locally: `npm login`
- For CI release: set `NPM_TOKEN` repo secret and `ENABLE_RELEASE=true` repo variable
- Flip each publishable package's `"private": true` → `false` in its `package.json`. This is a deliberate gate against accidental first-publish.
