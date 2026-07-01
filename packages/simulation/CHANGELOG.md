# @flare-engine/simulation

## 0.2.1

### Patch Changes

- Fix two `ScalarField` edge cases: `toRGBA` now clamps each channel to `[0, 255]` before storing (previously an out-of-range palette value wrapped to a wrong colour), and `maxValue` seeds at `-Infinity` (returning `0` for an empty field) so an all-negative field reports its true maximum instead of `0`.

- Updated dependencies []:
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Initial release — n-body gravity (Plummer softening), velocity-Verlet / leapfrog integrators, wave-packet ripple pool, scalar field, and agent stigmergy.
