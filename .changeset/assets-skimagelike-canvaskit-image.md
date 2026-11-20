---
'@flare-engine/assets': patch
---

A CanvasKit `Image` is now assignable to `SkImageLike`, so it can be passed to `createTexture` and returned from a `decodeImage` callback with no cast.

`SkImageLike.readPixels` was declared with no parameters. CanvasKit's `Image.readPixels` requires three (`srcX`, `srcY`, `imageInfo`), so TypeScript rejected a CanvasKit `Image` with TS2322 / TS2345. The member is now declared as `readPixels(srcX?: number, srcY?: number, imageInfo?: SkImageInfoLike)`, with the same return type. A react-native-skia `SkImage` was assignable before and still is, and objects written against the old declaration (`readPixels: () => null`) still are.

`SkImageInfoLike` is a new exported type: `{ width: number; height: number; colorType: unknown; alphaType: unknown; colorSpace?: unknown }`.

This is a type-only change. The arguments are not portable between backends: react-native-skia accepts a call with no arguments, while CanvasKit requires all three, with its own enum values and a `colorSpace`. For pixel read-back, call `readPixels` on the backend's own image type.

Covered by a type-level check against the installed `canvaskit-wasm` and `@shopify/react-native-skia` typings.

<!-- Third-party names: CanvasKit's Image.readPixels and react-native-skia's SkImage. -->
<!-- symbols-ok: Image.readPixels, SkImage -->
