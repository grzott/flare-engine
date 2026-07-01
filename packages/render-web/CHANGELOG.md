# @flare-engine/render-web

## 0.2.1

### Patch Changes

- Harden the CanvasKit web bridge: the per-frame composite path no longer round-trips uniforms through `Array.from`/`Float32Array.from` and reuses pre-allocated scratch buffers (zero-alloc), null offscreen surfaces are now guarded with a diagnostic warning instead of silently rendering blank, and the multi-pass ping-pong loop gained real behavioral + resource-leak tests. Adds a package README. Documented as the Layer-4 web-integration bridge (the web analog of `@flare-engine/react`).

- Updated dependencies []:
  - @flare-engine/render@0.2.1
  - @flare-engine/postfx@0.2.1

## 0.2.0

### Minor Changes

- Initial release — CanvasKit-backed web backend for the `@flare-engine/render` frame-renderer, plus the `createPostFxSurface` web bridge.
