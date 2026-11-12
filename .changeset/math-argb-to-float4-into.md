---
"@flare-engine/math": patch
"@flare-engine/shapes": patch
"@flare-engine/render": patch
"@flare-engine/render-web": patch
"@flare-engine/react": patch
"@flare-engine/assets": patch
---

`@flare-engine/math` now exports `argbToFloat4Into(out, argb)`, which unpacks a packed `0xAARRGGBB` colour int into a `Float32Array` as `[r, g, b, a]`, each 0-1, without allocating. Five packages each carried their own copy of the same four lines. They now call this one instead: shapes' `argbTo`, which stays exported and delegates, the frame renderer's `clear`, the web surface's `clear`, `renderShapesToImage`, and `createProceduralAtlas`. Colours come out the same as before. `@flare-engine/shapes`, `@flare-engine/assets` and `@flare-engine/render-web` now depend on `@flare-engine/math`.
