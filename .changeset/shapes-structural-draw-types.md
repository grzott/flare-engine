---
'@flare-engine/shapes': patch
---

The published types no longer import `@shopify/react-native-skia`, so they resolve in a project that does not have that optional peer installed.

`drawShape`, `applyGlow`, `applyFriendlyGlow` and `applyHazardGlow` declared their parameters with react-native-skia's `Skia`, `SkCanvas` and `SkPaint`, which put an import of that package at the top of the emitted `.d.ts`. They are now declared with the package's own structural types: the canvas is a `ShapeAtlasCanvas`, the paint a `ShapeAtlasPaint`, and the `Skia` handle of `drawShape` a `ShapeDrawSkia`.

`ShapeDrawSkia` is a new exported type: the `Path`, optional `PathBuilder` and `XYWHRect` members that used to be declared on `ShapeAtlasSkia`. `ShapeAtlasSkia` now extends it and adds `Surface` and `Paint()`, so it has the same members as before.

react-native-skia's `Skia`, `SkCanvas` and `SkPaint` are assignable to the new parameter types, so native call sites compile unchanged. The value returned by `createWebShapeSkia(kit)` from `@flare-engine/render-web`, and the canvas and paint it hands out, now pass to these functions with no cast.

This is a type-only change; the calls made at runtime are the same. It does not add per-frame drawing on the web: the only canvas a `createWebShapeSkia` handle provides belongs to the offscreen surface it creates for the bake. The README now says so, and names `bakeShapeAtlas` followed by `drawBakedShape` as the per-frame path there.

Covered by type-level checks against the installed `@shopify/react-native-skia` and `canvaskit-wasm` typings.

<!-- Third-party names: react-native-skia's SkCanvas and SkPaint. -->
<!-- symbols-ok: SkCanvas, SkPaint -->
