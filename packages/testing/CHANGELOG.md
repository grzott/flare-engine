# @flare-engine/testing

## 0.2.1

### Patch Changes

- `createBenchSession().end()` now warns when a session is ended out of LIFO order, instead of silently leaking a seeded `Math.random` into later tests.

- Updated dependencies []:
  - @flare-engine/input@0.2.1
  - @flare-engine/core@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Add the bench-session harness and `defineSnapshot` projector.

## 0.1.0

### Minor Changes

- Initial release.
