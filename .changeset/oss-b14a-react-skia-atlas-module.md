---
"@flare-engine/react": minor
---

add `skiaAtlasModule` — a typed adapter exposing the RN-Skia module as the engine's structural `SkiaAtlasModuleLike`, so `createProceduralAtlas` callers no longer need an `as unknown as` cast at the boundary (the single boundary assertion now lives in one tested engine file). Consumed by the shmup + topdown starter templates.
