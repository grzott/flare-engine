# @flare-engine/devtools

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Updated dependencies []:
  - @flare-engine/core@0.2.1
  - @flare-engine/ecs@0.2.1

## 0.2.0

### Minor Changes

- Add `isDevMode`, a cross-runtime `__DEV__` guard.

## 0.1.0

### Minor Changes

- Initial release.
