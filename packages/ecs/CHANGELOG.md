# @flare-engine/ecs

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
