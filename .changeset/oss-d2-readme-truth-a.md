---
"@flare-engine/math": minor
"@flare-engine/events": minor
"@flare-engine/core": minor
"@flare-engine/ecs": minor
"@flare-engine/render": minor
"@flare-engine/render-web": minor
"@flare-engine/shapes": minor
"@flare-engine/postfx": minor
"@flare-engine/input": minor
"@flare-engine/physics": minor
"@flare-engine/audio": minor
"@flare-engine/assets": minor
"@flare-engine/simulation": minor
"@flare-engine/progression": minor
"@flare-engine/storage": minor
---

README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

- Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
- `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
- `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.
