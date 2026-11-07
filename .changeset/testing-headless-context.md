---
'@flare-engine/testing': patch
---

Adds `createHeadlessContext(opts?)`: an RN-free, Skia-free stand-in for the React `GameContextValue`
(minus `audio`, `renderer` and `batch`) for loop-harness tests. It builds on `createTestWorld` and
adds a real `Camera2D` (optional `viewportWidth` / `viewportHeight`, both or neither), a
`MockInputManager` and a resolve-`null` `AssetManager`, wired through `loop.onLateUpdate` as
`GameView` does, a permissive `SpriteSheet` whose `getFrame` resolves every name to one 8×8 frame,
and a caller-supplied `scenes` slot. `@flare-engine/assets` and `@flare-engine/render` become
dependencies of the package.
