# @flare-engine/math

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.

## 0.4.4

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

### Patch Changes

- da81c97: OSS-M9: curves, segment intersection points, and RNG state.

  New `curves.ts` — `bezier2` / `bezier3` / `catmullRom` point sampling with `…Into` twins for per-frame use, plus `bezier2Length` / `bezier3Length` / `catmullRomLength` chord-approximated arc length. Control points are loose numbers rather than `Vec2`, so coordinates already in a `Float32Array` sample without temporaries; `t` is clamped rather than extrapolating.

  `intersection.ts` could previously only answer _whether_ things intersect. `segmentIntersection` / `segmentIntersectionInto` now answer _where_ two segments cross, returning `null` when there is no single point (missing, parallel or collinear) and leaving `out` untouched in that case. `segmentsIntersect` is the boolean companion and reports collinear overlap as `true`.

  `SeededRNG.getState()` / `setState(state)` expose the generator's whole state as one JSON-safe int32, so a save file or replay can resume the exact sequence.

- fb5a0c5: PF-2b: settle the `core` coroutine contract and the `math` zero-alloc names before the freeze. Per
  ADR-0004.

  A coroutine now ends exactly one of three ways, and `CoroutineHandle` says which: completed,
  `cancelled`, or `failed` (all imply `done`; `cancelled` and `failed` are mutually exclusive).
  `cancel()` and `clear()` both set `cancelled` and close the generator, so a coroutine's `finally`
  blocks run on cancel and on scene teardown — `clear()` is a cancel from every coroutine's point of
  view — instead of leaking whatever they guard. A cancel issued from inside the running body is
  applied, and reports the same `cancelled` state, once the body next suspends. A rejected
  `yield Promise` is thrown into the generator: catch it and the coroutine keeps running, with the
  next yield dispatched as usual; let it propagate and the coroutine ends with the new
  `CoroutineHandle.failed` set and `CoroutineHandle.error` holding what the generator threw. Before,
  a rejection silently flipped `done` and dropped the reason, so asset and network failures inside
  coroutines vanished, and a cancelled coroutine was indistinguishable from a completed one. Failures
  are never re-raised as unhandled rejections; the handle is the channel.

  `Vec2.normalizeOut(dx, dy, speed, out)` is renamed `Vec2.scaleToLengthInto(dx, dy, length, out)` —
  it was the repo's only `…Out` zero-alloc name against nineteen `…Into` siblings, and it scales to
  `length` rather than normalising. `Vec2.turnVelocityToward` becomes `Vec2.turnVelocityTowardInto`
  for the same reason. Neither body changed: a bit-level sweep of 1.22M inputs (denormals, the 1e-6
  guard boundary, overflow magnitudes) shows zero mismatches against the old names, so `atan2`
  consumers see identical angles.

## 0.3.1

## 0.3.0

### Minor Changes

- 6a10aa9: Add `Vec2.perp` and `Vec2.crossSV` rigid-body solver primitives, both with `out` forms.
- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

- 84fd0a3: docs: OSS-D5 design-docs honesty pass — correct the easing-function count to 35 and drop the stale hard-coded count from the `easings.ts` header comment.

  No runtime or API change to `@flare-engine/math`. This changeset exists because the header-comment edit touches `packages/math/src/`, and covers the wider design-docs truth pass (architecture.md + api-specs.md re-derived against `src/index.ts`: planck/rbush/flow-fields moved to a Post-launch roadmap, `@flare-engine/shapes` documented, stale api-specs sections for animation/dialogue/errors/testing/devtools/iap corrected, and stale `0.2.0` forward-promises swept).

## 0.2.1

## 0.2.0

### Minor Changes

- Add `weighted-pick`, `hashU32`, and reward helpers.

- Add `angleDelta`, `rotateTowards`, and `turnVelocityToward`.

## 0.1.0

### Minor Changes

- Initial release.
