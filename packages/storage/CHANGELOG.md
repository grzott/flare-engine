# @flare-engine/storage

## 0.4.0

### Patch Changes

- 6d6668c: PF-7: settle the published surface of `react`, `scene` and `storage` before the 0.4.0 freeze. Per ADR-0004.

  - `GameView`'s `safeArea` prop: the shipped JSDoc and API spec already promised a zero-insets
    fallback when no `<SafeAreaProvider>` ancestor is mounted, but the code called
    `useSafeAreaInsets()` unconditionally, which throws in that exact situation — so the fallback
    never existed and an app trusting the docs got a blank screen and a stack trace. `GameView` now
    reads `useContext(SafeAreaInsetsContext)` directly (still called unconditionally, per the hook
    rules) and falls back to `{ top: 0, right: 0, bottom: 0, left: 0 }` when it is `null` or when
    `safeArea` is supplied explicitly. `useSafeAreaInsets` is no longer called.
  - `SceneFactory` is now `(world: World, camera: Camera2D) => Scene` instead of `() => Scene`.
    `SceneManager` always overwrote `scene.world`/`scene.camera` after calling the factory, so a
    factory that returned a real, pre-populated `World` — the only shape the published `Scene`
    interface's required `world`/`camera` fields allow without a forbidden `null!` — silently lost
    it. The manager now passes the `World`/`Camera2D` it created into the factory instead. A
    zero-argument `() => Scene` factory remains assignable to `SceneFactory`, so existing factories
    that build their own world/camera are unaffected.
  - `DocumentStore.load()` never persists over a document it could not read. Previously, a stored
    version newer than the app's (store rollback, side-loaded APK, staged-rollout revert) or a
    throwing consumer migration fell into the same silent-fallback path as corrupt JSON — returning
    `parse(undefined)` **and writing it back to the adapter**, destroying a well-formed document that
    a newer build could otherwise have read. `load()` now persists the fallback only when the stored
    data was never a valid envelope to begin with (bad JSON, wrong shape); on a migration failure it
    returns the fallback for that call only and leaves the stored bytes untouched, so reinstalling a
    build that can read the document recovers it. `load()` still never throws. Two things this does
    NOT change, on purpose: the caller has no signal that its data survived versus was truly absent
    (a reason channel was considered and deferred — more design than this row holds), and
    `createStorage.loadSlot` still throws in the equivalent case, so the two stores now deliberately
    diverge; see `api-specs.md` for the documented split.

## 0.3.1

## 0.3.0

### Minor Changes

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

### Patch Changes

- 2ae386c: storage: fix importJSON atomicity and runMigrations gap enforcement. `importJSON` now validates every entry is a string before calling `adapter.clear()`, so a corrupt payload leaves storage untouched. `runMigrations` now throws on version gaps in the migrations list and on a highest migration version that exceeds the target, matching the existing doc comment contract.

## 0.2.1

## 0.2.0

### Minor Changes

- Add the document store and value sanitizers (XP9).

## 0.1.0

### Minor Changes

- Initial release.
