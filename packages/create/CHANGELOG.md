# create-flare-app

## 0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.

## 0.4.4

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

### Patch Changes

- 0d8afc9: The scaffolder ships as `@flare-engine/create` (bin `flare-create`), published with the rest of the
  scope. Per ADR-0007.

  The unscoped name it was developed under, `create-flare-app`, was never published by this project
  and has belonged to an unrelated npm package since 2026-09-11, so `npm create flare-app` runs that
  package instead. Scaffold with `npm create @flare-engine my-game` (npm, pnpm and yarn map a bare
  `@flare-engine` to `@flare-engine/create`) or `bunx @flare-engine/create my-game`; programmatic use
  imports `scaffoldApp` from `@flare-engine/create`. Templates and options are unchanged.

  `flare new` previously ran `npx create-flare-app`, which now resolves to the other package. It now
  runs `@flare-engine/create` pinned to the CLI's own version, which lockstep versioning guarantees
  exists, so it can never pick up an unscoped package of the same name.

## 0.3.1

## 0.3.0

## 0.2.1

Initial published changelog. Versions before this were cut in lockstep with `@flare-engine/*`
without a per-package changelog entry.
