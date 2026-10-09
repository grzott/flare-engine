# ADR-0007: The scaffolder ships as `@flare-engine/create`, inside the scope, published with the rest

- **Status**: Accepted <!-- owner, 2026-10-09 -->
- **Date**: 2026-10-09
- **Consumer impact**: breaking
- **Release level**: patch

## Context

Verified on 2026-10-09 against the npm registry and HEAD `9d9d898`.

The scaffolder was `create-flare-app` — unscoped, `private: true`, never published. Every getting-
started path assumed the unscoped name would still be free on flip day: the root README quickstart,
`packages/create-flare-app/README.md`, `api-specs.md`, the flip runbook's FW-9 (the package's first
publish, after the access flip's point of no return) and the manual-test protocol's §1.

**It is not free.** `registry.npmjs.org/create-flare-app` has carried versions `0.2.0` and `0.2.1`
since 2026-09-11, maintainer `oksigen`, described as "a Bun-first modular Cloudflare monorepo
starter". The use is legitimate — the "flare" is Cloudflare's — so a name dispute is unlikely to
succeed.

Two consequences went beyond the docs:

- `packages/cli/src/cli.ts` implemented `flare new` as `npx create-flare-app <args>`. From
  2026-09-11 that downloads and runs the other publisher's package on the user's machine.
- An unscoped package cannot be published `restricted`, which is why the scaffolder sat at
  `private: true` with `publishConfig.access: "public"` — a state where deleting one line publishes
  publicly, and why FW-9 was the only first-ever publish scheduled for flip day, on a CI path
  (`release.yml`) that has never executed.

## Decision

The scaffolder becomes **`@flare-engine/create`**, in `packages/create/`, with bin `flare-create`.
It drops `private`, publishes `restricted` with the other 41 packages from `0.4.0`, and flips public
with them. `npm create @flare-engine my-game` resolves it (npm maps a bare `@scope` to
`@scope/create`), as do `pnpm create @flare-engine` and `yarn create @flare-engine`; bun users run
`bunx @flare-engine/create my-game`, because `bun create` only resolves unscoped `create-*` names.
`flare new` spawns `@flare-engine/create@<the CLI's own version>` — exact and scoped, so it can
never resolve a package someone else publishes.

## Consumer impact

- **Who breaks.** Nobody installed: `create-flare-app` never reached any registry. What breaks is
  every *instruction* naming it — READMEs, the docs site at flareengine.dev, and any post quoting
  `npm create flare-app@latest`, which now runs an unrelated Cloudflare starter.
- **What they see.** `npm create flare-app` scaffolds a different project with no error.
  `import { scaffoldApp } from 'create-flare-app'` resolves to that package too.
- **Migration.** `npm create @flare-engine my-game` (no `@latest` suffix: npm's `@scope` shorthand
  does not take one), or `npx @flare-engine/create@latest my-game` where a version pin is wanted.
  Programmatic use imports from `@flare-engine/create`.
- **Why now.** The name has to be settled before `0.4.0` publishes — `.changeset/config.json`'s
  fixed group, every gate that special-cased the unscoped name, and the published manifests all
  carry it. After the flip it is a second rename of a public package.

## Alternatives considered

**`create-flare-engine` or `create-flare-game`.** Both free on 2026-10-09, and `npm create
flare-engine@latest` is the more idiomatic command. Rejected because either stays unscoped: it
cannot publish `restricted`, so it keeps the `private` landmine and the flip-day first publish, and
it can be taken between now and the flip exactly as `create-flare-app` was.

**Dispute `create-flare-app`.** Rejected: the current owner's use is legitimate, npm's dispute
process has no deadline that fits a flip in October, and winning would still leave the unscoped
problems above.

**Keep the scoped name `private` until the flip.** Rejected: the main gain of the scope is that the
scaffolder rides the same restricted `0.4.0` publish as everything else, so the manual-test window
exercises it from the real registry and flip day only changes its access.

## What would reverse this

- **`npm create @flare-engine` stops resolving** in a current npm, pnpm or yarn. Then the documented
  command changes, not the package name.
- **A real need for a bare `npm create <name>` command** — say a tutorial ecosystem that only
  supports unscoped creators. Then publish a thin unscoped alias that depends on
  `@flare-engine/create`, rather than moving the scaffolder out of the scope.
