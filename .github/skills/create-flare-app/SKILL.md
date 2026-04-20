---
name: create-flare-app
description: Knowledge of the create-flare-app scaffolder — npm create flare-app@latest, blank/topdown/shmup templates, buildProgram entry. Use when extending the Flare scaffolder, adding templates, or debugging first-run experience for new Flare developers.
---

# `create-flare-app`

Tooling package. Invoked as `npm create flare-app@latest <name>`.

## Exports

```ts
import { buildProgram } from "create-flare-app";
// plus template metadata + runner types
```

## Templates

Each under `packages/create-flare-app/templates/`:

- `blank` — minimal: `<GameView>` + a single empty scene.
- `topdown` — top-down movement, tilemap, camera follow.
- `shmup` — scrolling shoot-em-up starter (distilled from `apps/demo`).

## Rules

- Templates are copied byte-for-byte — every file must be self-contained and not reference the monorepo.
- `buildProgram` is the commander entry — test-covered via `packages/create-flare-app/tests/`.
- Don't add heavy runtime deps here — the scaffolder runs on end-user machines with cold caches.
