---
'@flare-engine/render': minor
'@flare-engine/engine': minor
---

OSS-M10: additive blend, flipX/flipY, drawNineSlice, cullBounds — per ADR-0006.

**Breaking (SpriteDrawCommand):** three new required fields — `blend: 'normal' | 'additive'`,
`flipX: boolean`, `flipY: boolean` — have been added to `SpriteDrawCommand`. Code that
constructs a `SpriteDrawCommand` literal must now provide all three. The scope is `restricted`
with no public consumers, so the break is a controlled migration; it is the reason this ships as
a `minor` and lands pre-freeze rather than post-flip.

**Additive blend:** `SpriteData.blend?` / `SpriteBatch.draw()` / `SpriteBatch.drawRaw()` accept
`'normal' | 'additive'`. The value is a batch-key field — sprites with different blend modes form
separate runs. Additive uses Skia `BlendMode.Plus` (kPlus = 12). `PaintLike.setBlendMode?` is
optional; mocks that omit it silently stay in SrcOver (the Skia default).

**flipX / flipY:** `SpriteData.flipX? / .flipY?` mirror a sprite about its centre. Mirrored
sprites are routed through `drawImageRect` with a canvas `scale(±1, ±1)` transform — one draw
call per sprite (per-sprite cost, documented). Not compatible with rotation; combine only with
`rotation = 0`. RSXform cannot express a one-axis mirror (negative-determinant transform);
this path is the explicit workaround. flip + outline effect falls back to the plain stretch
paint (outline's two-pass SRC_IN path is incompatible with the single-drawImageRect flip path).

**drawNineSlice:** `drawNineSlice(batch, image, frame, x, y, w, h, inset, effect?, alpha?)`
splits a source frame into a 3×3 grid and draws each non-degenerate slice via `drawImageRect`.
Corners draw at natural size; edges and centre stretch. Reads `batch.cullBounds` for a coarse
AABB precheck before drawing any slices.

**SpriteBatch.cullBounds / setCullBounds / clearCullBounds:** opt-in viewport culling bounds on
the batch. Read by `drawNineSlice`; set via `setCullBounds(minX, minY, maxX, maxY)` (zero-alloc
in steady state — one object allocated on first call, mutated thereafter). Disabled with
`clearCullBounds()`.

<!-- symbols-ok: BlendMode.Plus -->
<!-- reason: Skia's blend-mode enum member, named because additive blending maps onto it; not a
     Flare export. -->
