---
'@flare-engine/render': patch
'@flare-engine/render-web': patch
---

A frame renderer can now set the texture sampling per image: `FrameRenderer.setImageSampling(image,
sampling)` takes `'nearest'` or `'linear'` (`ImageSampling`) and applies it to every draw of that
image — an atlas or a texture — on both the atlas path and the stretch/flip path, so pixel art scaled
through `drawAtlas` stops blurring. The last call wins; any other mode throws `RangeError`. An image
with no setting draws exactly as before — linear on the atlas path, nearest on the stretch path — and
its surface receives the same calls it did. For a surface implementing `DrawSurfaceLike`, `drawAtlas`
now takes RN Skia's optional 5th–7th arguments (blend mode and colors, which the renderer always
leaves `undefined`, then `SamplingOptionsLike`), and
the optional `drawImageRectOptions` carries a sampled stretch draw, falling back to `drawImageRect`
when the surface lacks it. `createWebSkiaModule` maps both onto CanvasKit's `drawAtlas` sampling
argument and its `drawImageRectOptions`.
