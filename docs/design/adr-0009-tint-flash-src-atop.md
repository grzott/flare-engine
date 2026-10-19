# ADR-0009: `tint` and `flash` blend their colour filter with SrcATop, so a sprite's transparent padding stays transparent

- **Status**: Accepted <!-- owner, 2026-10-19 -->
- **Date**: 2026-10-19
- **Consumer impact**: behaviour-change
- **Release level**: patch

## Context

Verified at HEAD `88bdb75` on 2026-10-19, against the working tree before this row's diff. Line
numbers are pre-diff unless marked.

The tint and flash sprite effects are a constant-colour filter on the sprite paint. `applyTint` and
`applyFlash` (`packages/render/src/frame-renderer.ts:472-484`) write the effect colour into a reused
`Float32Array` with alpha = colour alpha × `amount` (tint) or × `flashIntensity(effect)` (flash) —
`writeColor`, `:996-1001` — and build `Skia.ColorFilter.MakeBlend(color, BLEND_SRC_OVER)`, with
`BLEND_SRC_OVER = 3` at `:270`. That paint then draws the whole batch: `drawAtlas` on the pooled path
(`:894`) and `drawImageRect` on the stretch/flip path (`:861`, `:864`).

A colour filter runs on every pixel the quad covers, with the filter colour as source and the
sampled texel as destination. Skia's formulas, from the header shipped with the installed RN-Skia
2.4.18 (`node_modules/@shopify/react-native-skia/cpp/skia/include/core/SkBlendMode.h`):

- `kSrcOver` (`:42`): r = s + (1−sa)·d
- `kSrcIn` (`:44`): r = s·da
- `kSrcATop` (`:48`): r = s·da + d·(1−sa)

Over a fully transparent texel (d = 0, da = 0) SrcOver yields s — the constant itself — so every
transparent pixel of a frame that does not fill its quad receives the effect colour at the effect's
alpha. At full flash intensity that is an opaque rectangle. Manual-window finding §7 row 2
(`docs/plans/manual-test-protocol.md:193`): enemy, mini-boss and boss hit flash in PT paints the
whole sprite rectangle instead of the silhouette. Present in every published version (history
below) and in the `0.4.1` dist.

Measured 2026-10-19 on a CanvasKit CPU surface (canvaskit-wasm 0.40.0): an 8×8 atlas, transparent
except an opaque red 4×4 at (2,2); one `drawAtlas` with `MakeBlend(white, mode)` onto a target
cleared transparent; Unpremul RGBA readback. "pad" is pixel (0,0), "opaque" is (3,3), "edge" is a
texel pre-drawn at red alpha 0.5 to stand in for an anti-aliased edge.

| filter alpha | mode | pad | opaque | edge |
| --- | --- | --- | --- | --- |
| 1 | SrcOver | [255,255,255,255] | [255,255,255,255] | — |
| 1 | SrcATop | [0,0,0,0] | [255,255,255,255] | — |
| 0.5 | SrcOver | [255,255,255,128] | [255,128,128,255] | [255,170,170,192] |
| 0.5 | SrcATop | [0,0,0,0] | [255,128,128,255] | [255,128,128,128] |
| 0.5 | SrcIn | [0,0,0,0] | [255,255,255,128] | — |
| 0.5 | Modulate | [0,0,0,0] | [255,0,0,128] | [255,0,0,64] |
| 0.5 | matrix lerp via `MakeMatrix` | [0,0,0,0] | [255,128,128,255] | [255,128,128,128] |

Row 1 is the finding. Rows 3 and 4 are the property the fix rests on: wherever the art is opaque
(da = 1) SrcATop reduces to s + d·(1−sa), which is SrcOver — byte-identical. SrcATop's result alpha
is sa·da + da·(1−sa) = da, the art's own alpha, so padding stays at 0 and an anti-aliased edge keeps
its coverage (128 stays 128) where SrcOver had raised it (128 → 192) and pulled it further toward
the effect colour.

The web half is load-bearing. `createWebSkiaModule`'s `ColorFilterFactoryLike.MakeBlend`
(`packages/render-web/src/web-skia-module.ts:174-181`) maps 3 → SrcOver, 5 → SrcIn and **every
other mode to SrcOver**, so changing the constant in `render` alone would be a silent no-op on
CanvasKit. canvaskit-wasm's enum carries `SrcATop` (`types/index.d.ts:4593`; runtime value 9),
the same value as RN-Skia's JS enum (`lib/typescript/src/skia/types/Paint/BlendMode.d.ts:38`).

History. The mode has been SrcOver since the effect was written: `packages/react/src/skia-bridge.ts:184`,
`:191` in commit 7082410 (2026-04-17), shipped in `@flare-engine/react@0.1.0` (`skia-bridge.ts:471`,
`:478`), lifted unchanged into `packages/render/src/frame-renderer.ts` in commit c6d97f6
(2026-06-30), and present at every published render tag since: `@flare-engine/render@0.2.0`,
`0.2.1`, `0.3.0`, `0.3.1`, `0.4.0`, `0.4.1`. The render-web map (3, 5, else SrcOver) is unchanged
since `@flare-engine/render-web@0.2.0`. The outline effect in the same file has always used
`BLEND_SRC_IN` (`:496`), which is why it never showed the problem.

One test pinned the old mode: `packages/react/tests/skia-bridge.test.ts:632` and `:651` asserted
`toBe(3)` on the recorded `MakeBlend` mode. The todo row's sentence that nothing pins it was wrong.
No test in `render` or `render-web` observed the mode or the padding pixels.

## Decision

`applyTint` and `applyFlash` build their colour filter with a new private constant
`BLEND_SRC_ATOP = 9` (Skia `BlendMode.SrcATop`) instead of `BLEND_SRC_OVER`, which stays for the
additive-blend `setBlendMode` resets. `createWebSkiaModule` maps 9 to `kit.BlendMode.SrcATop` in
`MakeBlend`; the existing SrcOver fallback for unknown modes and the paint-level `setBlendMode` map
are untouched. No exported name, signature or type changes; the `BLEND_*` constants remain
module-private. Pinned by a mode-recording test in `render` (literal 9 for tint, flash and
tint-on-stretch; 5 for outline), two CanvasKit pixel tests in `render-web` (padding alpha 0 at (0,0)
and (1,1); opaque centre ≈ [255,128,128,255] for a half-intensity white flash and ≈ [128,0,128,255]
for a half-amount blue tint) and the flipped `react` assertions.

## Consumer impact

- **Who.** Every consumer drawing a `tint` or `flash` effect over a frame whose alpha is not 1
  everywhere — transparent padding, anti-aliased edges, glows, soft particles — on either backend:
  RN-Skia through `@flare-engine/react` and CanvasKit through `@flare-engine/render-web`, from
  `0.4.2`. Also any consumer that wrote its own `FrameRendererModule` adapter and maps the numeric
  blend mode itself.
- **What they see.** Silently different pixels, in three bands. (1) Fully transparent pixels stay
  transparent: the hit-flash rectangle is gone and the flash follows the silhouette. (2) Fully opaque
  pixels are byte-identical to before (rows 3 and 4). (3) Partially covered pixels keep their
  coverage instead of being filled toward the effect colour: a tinted sprite's anti-aliased edge
  reads thinner than it did, and a flash over a glow or a soft-edged sprite is fainter at its edges,
  because edge alpha no longer rises with the flash. A consumer that relied on the rectangle — say
  as a cheap full-quad highlight behind a padded frame — now gets nothing in the padding. A
  consumer-written adapter now receives 9 where it received 3; if it has an unknown-mode fallback
  like render-web's it silently keeps the old behaviour on that backend.
- **Migration.** None for the silhouette. For a deliberate full-quad highlight, draw a rect behind
  the sprite or use a frame whose art fills the quad. Adapter authors: map 9 to the platform's
  SrcATop.
- **Consumer scan (2026-10-19, read-only grep of every sibling repo in the workspace).**
  Pan-Tvardowski (on `^0.4.0`): `tint()` at `src/core/spawn.ts:394`, `src/fx/boss-telegraph.ts:53`,
  `src/fx/dash-cue.ts:58`, `src/systems/revenge.ts:56`; `flash()` at `src/systems/collision.ts:72`
  and `:87` — the hit flash this row was filed for; PT wants the silhouette. `Berek` (`^0.2.1`): no
  tint or flash use. flare-engine-page: no engine tint/flash (a demo's own `flash` field on its
  simulation interface is unrelated). pan-tvardowski-lore, the PT extracted archive and both
  rehearsal copies: none. grzott-portfolio is not checked out here and was not scanned. No consumer
  found that depends on the rectangle.
- **Why now.** A visible defect in every published version, found in the manual window and elected
  by the owner on 2026-10-13 to close in the window rather than record as an accepted major
  (reaffirmed 2026-10-19, with the fix and its re-capture due by 2026-10-22). It ships
  as `0.4.2` — a `patch` under lockstep — so the gate cannot see it, which is why this ADR exists.
  `render` and `render-web` are in the measured closure, so the row re-stales the Render and
  Integration node suites and the three web lanes; the owner accepted that re-capture (2026-10-13),
  and this row's close ran the freshness gate under the documented override pending it.

## Alternatives considered

- **SrcIn (r = s·da), the outline precedent.** Keeps padding transparent but discards the art's
  colour and scales alpha by the filter's: row 5 turns opaque red into [255,255,255,128]. Right for
  the outline silhouette, wrong for `tint` at any amount below 1 and for every flash frame after the
  first.
- **A second DstIn pass.** SrcOver as today, then re-draw the sprite with DstIn to re-impose its
  alpha. Two draws per batch on the hot path, replaying the transform slice on the pooled route; a
  one-word mode change is strictly cheaper.
- **A `MakeMatrix` lerp.** Measured pixel-identical to SrcATop on CanvasKit (row 7): the matrix
  applies to unpremultiplied colour and leaves alpha alone, which is the same math. Rejected on cost
  and scope, not correctness — it trades a four-float colour write plus a native mode for a
  twenty-float matrix write per effect per batch, adds two matrix buffers in a freeze diff, and makes
  the result depend on how each backend scales the matrix translation column, a parity question the
  blend mode does not raise.
- **Modulate (r = s·d).** Row 6: white at 0.5 halves alpha and cannot brighten anything, so a
  flash-to-white darkens. Wrong.
- **An opt-in effect field (keep padding / keep silhouette).** The only option that preserves the
  rectangle for anyone who wants it. It is an exported-type change on a frozen surface, forbidden in
  the window; it stays the post-flip path if a consumer needs the rectangle (below).
- **Document and keep.** Record §7 row 2 as an accepted major and move it post-flip. Rejected by the
  owner on 2026-10-19.

## What would reverse this

- **A real consumer is found that depends on the rectangle.** Not a reversal: add the opt-in field
  post-flip and keep SrcATop as the default, because the silhouette is what every known caller wants.
- **The re-capture shows a GPU-lane regression beyond the run-to-run spread.** Both modes are a
  per-pixel colour filter on the same paint, so none is expected; if one is measured, investigate
  the filter's GPU path for the two modes before revisiting the default.
- **Skia changes `kSrcATop`'s formula** in `SkBlendMode.h`. Not anticipated.

<!-- symbols-ok: SrcATop, BlendMode.SrcATop, kSrcOver, kSrcIn, kSrcATop, SkBlendMode.h,
     BLEND_SRC_OVER, BLEND_SRC_ATOP, BLEND_SRC_IN, applyTint, applyFlash, writeColor, Berek,
     MakeBlend, MakeMatrix, Skia.ColorFilter.MakeBlend, ColorFilterFactoryLike.MakeBlend,
     setBlendMode -->
<!-- reason: `SrcATop`, `BlendMode.SrcATop` and the `kSrc*` names are Skia blend-mode enum entries
     (RN-Skia JS enum, SkBlendMode.h, canvaskit-wasm), named because this ADR is about which Skia
     mode the engine passes. `MakeBlend` / `MakeMatrix` / `Skia.ColorFilter.MakeBlend` /
     `ColorFilterFactoryLike.MakeBlend` are the colour-filter factory members on the structural
     `FrameRendererModule`, and `setBlendMode` is an optional `PaintLike` member — members, not
     top-level exports. `BLEND_*`, `applyTint`, `applyFlash` and `writeColor` are module-private in
     `frame-renderer.ts`, deliberately not exported. `Berek` is a sibling game repo named in the
     consumer scan. -->
