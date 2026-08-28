# @flare-engine/testing

## 0.3.1

### Patch Changes

- Updated dependencies [1645606]
  - @flare-engine/ecs@0.3.1
  - @flare-engine/core@0.3.1
  - @flare-engine/input@0.3.1
  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- abdb991: README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

  - Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
  - `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

  (Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)

### Patch Changes

- 47ad74f: ecs: add `World.removeQuery`, `World.forEachEntity`, and `World.entityCount` — query disposal plus zero-alloc entity iteration, so consumers no longer need a private-field cast to enumerate entities.

  testing: `serializeScene` now memoizes its per-component queries per world (`WeakMap`) instead of registering N+1 permanent queries on every call, and drops the redundant all-components query.

  devtools: `useEntityInspector` enumerates entities through `World.forEachEntity` instead of casting the world to a private `nextId` and scanning the id range.

- Updated dependencies [6a10aa9]
- Updated dependencies [d032b4b]
- Updated dependencies [47ad74f]
- Updated dependencies [076651e]
- Updated dependencies [65358b8]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
- Updated dependencies [2736317]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
  - @flare-engine/math@0.3.0
  - @flare-engine/input@0.3.0
  - @flare-engine/ecs@0.3.0
  - @flare-engine/core@0.3.0

## 0.2.1

### Patch Changes

- `createBenchSession().end()` now warns when a session is ended out of LIFO order, instead of silently leaking a seeded `Math.random` into later tests.

- Updated dependencies []:
  - @flare-engine/input@0.2.1
  - @flare-engine/core@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Add the bench-session harness and `defineSnapshot` projector.

## 0.1.0

### Minor Changes

- Initial release.
