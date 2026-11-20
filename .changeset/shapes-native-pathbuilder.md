---
"@flare-engine/shapes": patch
---

`drawShape` and `bakeShapeAtlas` build paths on `Skia.PathBuilder` when the handle has one, so they work with react-native-skia 2.14.

react-native-skia 2.6 added `Skia.PathBuilder` and deprecated the path mutators; 2.14 removed them. `drawShape` called `moveTo` / `lineTo` / `close` / `addArc` on the result of `Skia.Path.Make()` for seven kinds: `triangle`, `ngon`, `star`, `polyline`, `arc`, `trapezoid` and an `annulus` with `startAngle` and `endAngle`. Against a handle whose paths have no mutators those calls throw a `TypeError`, and `bakeShapeAtlas` throws with them because it draws through `drawShape`. The other kinds were not affected.

Those seven kinds now start from `Skia.PathBuilder.Make()` and draw the path its `detach()` returns whenever the handle has a `PathBuilder`. That includes 2.6 to 2.13, where the mutators still exist, so they are no longer called there. A handle without `PathBuilder` (react-native-skia before 2.6, and `createWebShapeSkia` from `@flare-engine/render-web`) is driven through `Skia.Path.Make()` exactly as before. The calls made and their arguments are the same on both routes.

`ShapeAtlasSkia` follows: `Path.Make()` is now declared to return `unknown`, and there is a new optional `PathBuilder` member. A handle typed like react-native-skia 2.14's `Skia`, whose paths have no mutators, is now assignable to it, so it can be passed to `bakeShapeAtlas` with no cast. Handles that were assignable before still are.

Covered by unit tests against stub handles shaped like each version range and by a type-level check; not run on a device.

<!-- symbols-ok: Path.Make -->
