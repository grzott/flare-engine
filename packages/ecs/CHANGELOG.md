# @flare-engine/ecs

## 0.4.16

### Patch Changes

- @flare-engine/events@0.4.16
- @flare-engine/math@0.4.16

## 0.4.15

### Patch Changes

- @flare-engine/events@0.4.15
- @flare-engine/math@0.4.15

## 0.4.14

### Patch Changes

- ea64817: Deprecations in `@flare-engine/ecs`. None of them changes behaviour in this release; 0.5.0 removes each one.

  - `ComponentDef.id` and `ComponentDef.bit`. A `World` no longer keys storage by them. `id` comes from a module-global counter, so it depends on import order and must never be persisted, and `bit` is `1 << id`, which wraps once 0.5.0 lifts the cap of 32 component types. Use the definition object itself as the key, for example a `Map<ComponentDef<unknown>, …>`.
  - `_resetComponentIds` (internal, test-only). Each `World` keys storage by the definition object, so isolating storage between tests needs no reset. It goes together with the global counter it resets.
  - `Query.requiredMask`, `Query.excludedMask`, `Query.matches` and calling `new Query(requiredMask, excludedMask)` directly. 0.5.0 sizes masks per `World` and takes the mask representation out of the public API. Build queries with `World.query` or `World.queryBuilder`, and test membership with `Query.has`.

  `@flare-engine/testing`: `serializeScene` cached its queries by `ComponentDef.id`, so two definitions sharing an `id` (two copies of `@flare-engine/ecs` in one process, or a hand-built definition) got the same query and entities holding only the second one were left out of the snapshot. It now caches by the definition object.

- dc99446: `World` now keys component storage by the `ComponentDef` object instead of by its `id` and `bit`. A second copy of the package in one process (the CJS and ESM builds loaded together, or a duplicated install) numbers its definitions from 0 again, so its components used to share storage and query matches with the first copy's, with no error. They no longer do.

  Query masks for definitions from one copy are unchanged: `Query.requiredMask` and `excludedMask` are still the OR of each definition's `bit`. Only a definition whose `bit` another definition already holds in that `World` gets a different, free bit.

  Behaviour change, only where two definitions share an `id`: in practice two copies of the package, but also a hand-built `ComponentDef` or one defined after the internal `_resetComponentIds`. Built-in components from two copies (for example `Position` from each) are now separate components in one `World`. Code that relied on them sharing storage by accident will see two.

  Each `World` holds at most 32 component types and throws `A World holds at most 32 component types (registering "<name>")` on the 33rd. A definition takes a slot the first time it is passed to `add`, `query`, or a builder's `with` / `without`; `has`, `get` and `remove` never take one. A `query(...)`, `with(...)` or `without(...)` call that does not fit throws without taking any slot. `defineComponent` still allows 32 definitions per copy of the package.

  `World.destroy` now deletes only from the stores of the components the entity has, instead of from every store in the `World`.

  - @flare-engine/events@0.4.14
  - @flare-engine/math@0.4.14

## 0.4.13

### Patch Changes

- @flare-engine/events@0.4.13
- @flare-engine/math@0.4.13

## 0.4.12

### Patch Changes

- 9a25896: Internal refactor: `World` now runs query notification for `add`, `remove` and `destroy` through one shared private helper. No behaviour or API change.
- Updated dependencies [ad28054]
- Updated dependencies [c0c5f1a]
- Updated dependencies [ee7781a]
- Updated dependencies [2b3c047]
- Updated dependencies [e0be221]
- Updated dependencies [e3474bc]
- Updated dependencies [636a8eb]
  - @flare-engine/events@0.4.12
  - @flare-engine/math@0.4.12

## 0.4.11

### Patch Changes

- @flare-engine/events@0.4.11
- @flare-engine/math@0.4.11

## 0.4.10

### Patch Changes

- 89cc4cc: `SystemDef` gains `worldFn`, the public name for the wrapper to pass to `world.addSystem` /
  `removeSystem`; it is the same function reference as `_worldFn`, which is now `@deprecated` and stays
  until the next planned minor.
  - @flare-engine/events@0.4.10
  - @flare-engine/math@0.4.10

## 0.4.9

### Patch Changes

- @flare-engine/events@0.4.9
- @flare-engine/math@0.4.9

## 0.4.8

### Patch Changes

- @flare-engine/events@0.4.8
- @flare-engine/math@0.4.8

## 0.4.7

### Patch Changes

- @flare-engine/events@0.4.7
- @flare-engine/math@0.4.7

## 0.4.6

### Patch Changes

- @flare-engine/events@0.4.6
- @flare-engine/math@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/events@0.4.5
  - @flare-engine/math@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/events@0.4.4
- @flare-engine/math@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/events@0.4.3
- @flare-engine/math@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/events@0.4.2
- @flare-engine/math@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/events@0.4.1
- @flare-engine/math@0.4.1

## 0.4.0

### Patch Changes

- 9868562: PF-2a: settle three `ecs` contracts before the freeze. Per ADR-0004.

  `Query.entities` is the zero-alloc walk — the live `readonly number[]` of matching ids, for an
  indexed loop. The built-in systems and the render system now use it; `for...of` stays as the
  convenience form, which allocates an iterator per loop and, on Hermes, a result object per entity.

  `QueryBuilder` takes the World's registration hook as a required constructor argument, so a bare
  `new QueryBuilder()` no longer compiles and `build()` always returns a query the world keeps
  populated. `world.queryBuilder()` is unchanged. The internal `_WorldQueryBuilder` subclass and
  `World._registerQuery` are gone.

  `definePrefab` documents that plain-object data is stored by reference and shared by every spawn
  (pass `() => T` for per-entity mutable state), and `Prefab.spawn(world)` drops the `overrides`
  parameter it never read.

- 0ef1aec: `Query` removal is now O(1). It was `indexOf` + `splice` — both O(n) — so churn cost grew with
  `entities x removals`; a single `Map<entityId, index>` now serves membership and position, and
  removal swaps the last element into the hole. Measured on the new `ecs.churn` bench rows
  (5%/step): the path was 14.5x steady-state iteration at 5000 entities before this.

  **Behaviour change, per ADR-0003:** removal no longer preserves the relative order of the
  remaining entities, and iteration order is now documented as explicitly unspecified. The array was
  previously documented "sorted" but never was — `_check` has always appended, so an entity that
  begins matching later landed after higher ids. The only consumer that reads the order is
  `render-system`, whose sort is stable on `z` alone, so query order is the tie-break between
  equal-`z` sprites: give overlapping sprites distinct `z` values, which was already the only
  supported way to control draw order.

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0
  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- 1645606: Add optional `query?` parameter to `createLifetimeSystem` and `createBoundsCullSystem`. When supplied, the system uses the caller's pre-registered `Query` instead of minting its own, eliminating duplicate query registration cost and allowing consumers to restrict the scanned entity set to a narrower component mask.
  - @flare-engine/events@0.3.1
  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- 47ad74f: ecs: add `World.removeQuery`, `World.forEachEntity`, and `World.entityCount` — query disposal plus zero-alloc entity iteration, so consumers no longer need a private-field cast to enumerate entities.

  testing: `serializeScene` now memoizes its per-component queries per world (`WeakMap`) instead of registering N+1 permanent queries on every call, and drops the redundant all-components query.

  devtools: `useEntityInspector` enumerates entities through `World.forEachEntity` instead of casting the world to a private `nextId` and scanning the id range.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

### Patch Changes

- Updated dependencies [6a10aa9]
- Updated dependencies [6d439f7]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
  - @flare-engine/math@0.3.0
  - @flare-engine/events@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/events@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Add movement, lifetime, cull, and follower systems.

## 0.1.0

### Minor Changes

- Initial release.
