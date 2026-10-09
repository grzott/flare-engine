---
name: create-flare-app
description: Knowledge of the Flare scaffolder `@flare-engine/create` (was the unpublished `create-flare-app`, renamed by ADR-0007) — `npm create @flare-engine`, bin `flare-create`, blank/topdown/shmup templates, buildProgram entry. Use when extending the Flare scaffolder, adding templates, or debugging first-run experience for new Flare developers.
---

# `@flare-engine/create`

Tooling package, tier 4, published in lockstep with the rest of the scope. Invoked as
`npm create @flare-engine <name>` (npm/pnpm/yarn map a bare `@flare-engine` to
`@flare-engine/create`) or `bunx @flare-engine/create <name>` (`bun create` only resolves unscoped
names). Bin: `flare-create`. `flare new` in `@flare-engine/cli` spawns
`@flare-engine/create@<cli version>`.

**Never write `npm create flare-app` or `create-flare-app` in user-facing text** — that unscoped
name belongs to an unrelated npm package since 2026-09-11 (ADR-0007).

## Exports

```ts
import { buildProgram, scaffoldApp } from '@flare-engine/create';
// plus template metadata + runner types
```

## Templates

Each under `packages/create/templates/`:

- `blank` — minimal: `<GameView>` + a single empty scene.
- `topdown` — top-down movement, tilemap, camera follow.
- `shmup` — scrolling shoot-em-up starter (minimum vertical slice; full showcases on flareengine.dev).

## Rules

- Templates are copied byte-for-byte — every file must be self-contained and not reference the monorepo.
- `buildProgram` is the commander entry — test-covered via `packages/create/tests/`.
- Don't add heavy runtime deps here — the scaffolder runs on end-user machines with cold caches.
