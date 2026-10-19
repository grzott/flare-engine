---
'@flare-engine/render': patch
'@flare-engine/render-web': patch
---

FREEZE-FIX-2: `tint` and `flash` keep the sprite's alpha, so a frame's transparent padding stays
transparent instead of being painted with the effect colour. Per ADR-0009.

Both effects are a constant-colour filter on the sprite paint, and the filter runs on every pixel of
the quad. It blended with Skia's SrcOver, which over a fully transparent texel yields the constant
itself, so any frame whose art does not fill its quad tinted or flashed as a rectangle — at full
flash intensity an opaque one. The filter now blends with SrcATop (r = s·da + d·(1−sa)): the result
keeps the art's own alpha and lerps its colour by the effect's alpha. Fully opaque pixels are
byte-identical to before; transparent pixels stay transparent; anti-aliased edges and glows keep
their coverage instead of being filled toward the effect colour, so a soft edge under `tint` reads
slightly thinner and a `flash` over a soft-edged sprite is fainter at its edges than it was.

`@flare-engine/render-web`'s CanvasKit adapter maps the new mode to `BlendMode.SrcATop` in its
`ColorFilter.MakeBlend`; before, every mode other than 3 and 5 fell back to SrcOver, which would have
made the render change a silent no-op on web. A consumer-written `FrameRendererModule` adapter that
maps numeric blend modes itself now receives 9 for these two effects and should map it to the
platform's SrcATop. No exported name, signature or type changes.

<!-- symbols-ok: BlendMode.SrcATop, ColorFilter.MakeBlend -->
<!-- reason: a Skia blend-mode enum entry and the colour-filter factory member on the structural
     `FrameRendererModule`, named because the change is which Skia mode the engine passes; neither
     is a top-level Flare export. -->
