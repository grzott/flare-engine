---
"@flare-engine/render": patch
"@flare-engine/render-web": patch
"@flare-engine/particles": patch
---

A sprite can now carry its own colour through the batched `drawAtlas` path, and `drawParticles` uses it.

**`@flare-engine/render`.** `SpriteBatch.draw` and `SpriteBatch.drawRaw` take an optional trailing `color`: a packed-ARGB multiplier (`0xAARRGGBB`) applied to every texel of that sprite, so `0xFFFFFFFF` changes nothing. A sprite drawn with a `color` has its `alpha` multiplied into the colour's alpha byte, and `alpha` then no longer splits batch runs: consecutive coloured sprites that share image, effect, stretch, blend and flip are one run whatever their colours and alphas. A coloured sprite and an uncoloured one never share a run. `SpriteBatch.flush`'s callback receives a third argument for a coloured run, `colors: Uint32Array` (`colors[i]` belongs to `commands[i]`; the buffer is reused and may be longer than `commands`), and `FrameRenderer.drawAtlas(image, commands, colors?)` accepts it, so `batch.flush(renderer.drawAtlas)` needs no change. The renderer draws a coloured run with Skia's Modulate blend, passed explicitly because the two backends default differently. `DrawSurfaceLike.drawAtlas`'s `blendMode` and `colors` parameters, previously typed `undefined`, are now `number` and `Float32Array[]`. `SpriteDrawCommand` is unchanged.

Sprites drawn without a `color` are batched and drawn exactly as before, with the same surface call.

Limits: on the stretch, flip and zone-background paths, which are not atlas draws, only the colour's alpha applies and its RGB is ignored.

**`@flare-engine/render-web`.** `createWebSkiaModule`'s `drawAtlas` forwards a coloured run's colours to CanvasKit as a reused `Uint32Array` with `BlendMode.Modulate`. An uncoloured run still passes `null` for both.

**`@flare-engine/particles`.** `drawParticles` now passes each particle's interpolated colour to `drawRaw` as that trailing `color` argument, with alpha still the separate `alpha` argument. `ParticleBatchLike.drawRaw` declares the extra optional trailing parameters (`blend?`, `flipX?`, `flipY?`, `color?`).

Behaviour changes to be aware of, for code that calls `drawParticles`:

- Particle colour was ignored before and is applied now. An emitter configured with a `startColor` or `endColor` other than white draws tinted; the default white draws the same pixels as before.
- With a `SpriteBatch`, the particles of one call now form a single run instead of one run per distinct alpha. They no longer merge into a run with neighbouring sprites drawn without a colour.
- A custom `flush` callback, one that is not `FrameRenderer.drawAtlas`, must take each sprite's opacity from the new `colors` argument for these runs. A callback that ignores it and reads the first command's `alpha` would draw every particle of the run at that one alpha.
