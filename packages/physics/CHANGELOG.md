# @flare-engine/physics

## 0.3.1

### Patch Changes

- 1645606: Add `getColliderBoundsInto` (zero-alloc) and `getColliderBounds` (allocating) to `CollisionWorld` for direct AABB readback by entity id.
- b617e49: Replace brute-force linear scan in `SpatialIndex` with a uniform spatial hash: O(1) `remove`/`update` via item-to-slot map, O(cells-touched) `query` via cell buckets, zero-alloc duplicate suppression via monotone stamp counter. Also drops the per-entity 2-element array allocation in `CollisionWorld.step` by iterating `entries.values()`.
  - @flare-engine/events@0.3.1
  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- d032b4b: physics adds broadphaseSize accessor + fixes the duplicate-broadphase-record leak on re-add (add() now routes to spatial.update when the entity already exists); input accumulates pointer delta across a frame instead of overwriting, matching the per-frame-delta contract.
- d69c329: physics: remove a private-project reference from the `moveAndSlideInto` docstring.

  The `solid-grid.ts` axis-slide docstring named a private sibling game ("byte-identical to Berek"), which shipped into the published `@flare-engine/physics` `dist` `.js`/`.mjs`/`.d.ts`/`.d.mts` and sourcemaps — surfaced by the OSS-F3 tarball audit as the one HEAD leak. The parenthetical is dropped; the behavioral note ("the y-check uses the already-updated x position") is kept. Comment-only, zero behavior change; all physics tests remain green.

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

- Add solid-grid collision (Berek parity).

## 0.1.0

### Minor Changes

- Initial release.
