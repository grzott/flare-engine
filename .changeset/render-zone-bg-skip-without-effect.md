---
'@flare-engine/render': patch
---

The frame renderer no longer fills opaque black rectangles for the six zone-background effects
(`roofsCity`, `forestCanopy`, `riverWave`, `moonCrater`, `caveInterior`, `mountainHills`) when their
shader is not available. If the Skia module has no `RuntimeEffect`, or `RuntimeEffect.Make` returns
`null` for the effect's shader, that run of sprites is now skipped — nothing is drawn for it — and a
single `console.warn` is emitted per renderer.

This only arises with a shader compile failure or a custom Skia module that omits `RuntimeEffect`;
`@flare-engine/render-web` always supplies it. Drawing with a compiled shader is unchanged, as is
the plain-sprite fallback of the water, fog, fire and drop-shadow effects.
