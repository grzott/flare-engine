# @flare-engine/postfx

## 0.2.1

### Patch Changes

- Mark the `@shopify/react-native-skia` peer dependency optional — the runtime is backend-neutral (via `SkiaPostFxModuleLike`) and never imports Skia, so web-only consumers of `@flare-engine/render-web` are no longer forced to install a native React Native peer. Also widen `SkiaRuntimeEffectLike.makeShaderWithChildren` uniforms to `ArrayLike<number>` so callers can pass a `Float32Array` without conversion.

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
