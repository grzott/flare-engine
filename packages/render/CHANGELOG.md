# @flare-engine/render

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Remove per-frame allocations from the render hot path: zone-background draws now use a pre-allocated, grow-only rect pool instead of allocating a rect per sprite per frame, and `drawAtlas`/`drawOutlined` cache their exact-length atlas slices by count instead of re-slicing every frame.

- Updated dependencies []:
  - @flare-engine/assets@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Add the `DropShadowEffect` data type and `dropShadow` factory.

## 0.1.0

### Minor Changes

- Initial release.
