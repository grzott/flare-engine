---
"@flare-engine/engine": minor
---

Headless entry + barrel honesty. `@flare-engine/engine` gains a `./headless` subpath export (14 RN-free packages + `createGame` + tier2-wiring; no `@flare-engine/react`, no `@flare-engine/postfx`) for web-only and Node consumers. Root barrel is now an explicit curated set: `@flare-engine/postfx` added (with `CompiledShader` aliased as `PostFxCompiledShader` and `SkImageLike` as `PostFxSkImageLike` to avoid render/assets clashes); `export * from @flare-engine/react` replaced with named re-exports (`GameConfig` aliased as `GameViewConfig` to avoid clashing with `createGame`'s own `GameConfig`). Package description updated to reflect the curated set.
