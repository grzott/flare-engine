---
description: "Package-specific rules for @flare-engine/engine. Applied when working on packages/engine/**."
applyTo: "packages/engine/**"
---

# `@flare-engine/engine` — package rules

Layer 4 (top). Integration package that wires every lower layer together. Depends on all lower `@flare-engine/*` packages (currently 30+ across layers 0–3.5; see [docs/design/architecture.md](../../docs/design/architecture.md) for the live count).

## Factory contract

- `createGame(config)` is a **pure factory**. Each call returns an independent `GameInstance` with its own `World`, `Camera2D`, `Renderer`, `SpriteBatch`, `InputManager`, `AudioManager`, `AssetManager`, `SceneManager`, and `GameLoop`. There is **no global state** in this package — do not introduce any (no singletons, no module-scoped caches).
- All subsystems are initialized **eagerly** in `createGame()`. Do not add lazy init; callers expect the full `GameInstance` to be usable synchronously on return.
- If `config.assetLoader` is omitted, a no-op loader is used. The real loader is injected by `@flare-engine/react`. Do not import a concrete loader here.

## What this package does not do

- `@flare-engine/engine` does **not** own the render loop, input event loop, or Skia canvas lifecycle. Those are owned by `@flare-engine/react` (`useCanvasRef`, gesture handlers, audio context). Do not call `Renderer.begin()` / `end()` or `InputManager.poll()` from inside this package — it will break the React integration.
- No React imports in `src/**`. `@flare-engine/engine` is plain JS; the React wrapper lives in `@flare-engine/react`.
- No `try` / `catch` around subsystem construction. If a peer dep is missing, let it throw at the call site — the React layer surfaces the error.

## Re-exports

- `src/index.ts` re-exports the lower `@flare-engine/*` packages as a convenience bundle. Adding a new `@flare-engine/*` package to the monorepo requires adding a matching `import + export` line here — this is the one place tree-shaking is deliberately sacrificed for DX.
- Keep the re-exports in dependency order (layer 0 → 3). It makes the file scannable.

## Tests

- `tests/integration.test.ts` exercises cross-package flows (ECS + physics, ECS + animation, etc.). Do **not** add unit tests for `createGame()` itself — integration-level coverage is the contract.
