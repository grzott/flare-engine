---
"@flare-engine/react": patch
"@flare-engine/scene": patch
"@flare-engine/storage": patch
---

PF-7: settle the published surface of `react`, `scene` and `storage` before the 0.4.0 freeze. Per ADR-0004.

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
