---
'@flare-engine/render': patch
---

The shader sprite effects — `custom`, `water`, `fog` and `fire` — now show. The frame renderer set
their shader on the paint of an image draw (`drawAtlas`, or `drawImageRect` for a stretched or
flipped sprite), and Skia ignores a paint's shader when the draw is a colour image, so the plain
sprite came out instead. A run with one of these effects is now drawn as one `drawRect` per sprite
over its destination, with the shader on the paint. No exported symbol or signature changes.

What a caller of these four effects sees change:

- **The shader's output replaces the sprite.** The atlas frame is no longer drawn for such a sprite
  and is not passed to the shader; it only gives the draw its place in the batch. `water` returns an
  opaque colour, so it covers its whole rect.
- **Coordinates are sprite-local.** The shader's `main(float2 xy)` receives `(0, 0)` at the top-left
  of the destination rect and `(dstW, dstH)` at its bottom-right, in the units the destination is
  given in, wherever the sprite is and whatever camera transform or pixel density is in force.
  Rotation (about the anchor) and `flipX` / `flipY` transform the rect and its coordinates together.
  A `custom` shader is not handed the size; pass it as one of its own uniforms. This is documented
  on `CustomShaderEffect`.
- **Alpha and `blend: 'additive'` apply to the shader's output.** Of a per-sprite colour only the
  alpha is used; its rgb is not multiplied in. `stretch` and `setImageSampling` have no effect on
  these draws.
- **`water`, `fog` and `fire` get their `resolution` per sprite.** A sprite whose size differs from
  the one before it in the same run gets a shader built for its own size, where the whole run used
  the first sprite's.
- **Without a shader, nothing changes.** When `Skia.RuntimeEffect` is absent, or a built-in shader
  fails to compile, `water` / `fog` / `fire` still draw the plain sprite.

A `FrameRendererModule` or `DrawSurfaceLike` implemented outside this repo receives `save`,
`rotate`, `translate`, `scale`, `drawRect` and `restore` for these runs, all already required
members of `DrawSurfaceLike`.
