# @flare-engine/input

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/events@0.4.5
  - @flare-engine/math@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/events@0.4.4
- @flare-engine/math@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/events@0.4.3
- @flare-engine/math@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/events@0.4.2
- @flare-engine/math@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/events@0.4.1
- @flare-engine/math@0.4.1

## 0.4.0

### Patch Changes

- 3573ff6: HYG5-PRE: document `GamepadSource.poll()`'s freshness contract.

  `poll()` now documents that it returns fresh objects on every call: an implementation must not
  reuse or mutate a snapshot (or its `buttons`/`axes` arrays) it previously returned, and a caller
  may retain a returned snapshot across frames. This was previously unstated. `createWebGamepadSource`
  already behaved this way — every call allocates a new snapshot, a new buttons array and a new axes
  array per connected pad — so this documents existing behaviour rather than changing it. It matters
  now because `GamepadSource` is a public interface the docstring explicitly invites native adapter
  authors to implement, and the contract binds every adapter written after the October 20 flip.

- 4ac7c58: OSS-B23b: harden URL and input parsing against inherited keys and non-finite values.

  `deep-links` builds its three URL-derived `Params` objects with `Object.create(null)`, so a link that never carried a `constructor` / `toString` key no longer answers those reads with an inherited value.

  `input` corrects out-of-contract configuration instead of propagating it: `updateJoystick` guards a zero distance and a `maxRadius` equal to `deadZone` (both divided by zero and wrote NaN into the reused state, which never recovered), and `applyDeadZone` clamps a dead zone outside `[0, 1)`. Invalid values are clamped and reported once via a `__DEV__`-only warning rather than throwing, since both run in the per-frame input path.

- c50c515: PF-3: settle the published surface of `input` before the 0.4.0 freeze. Per ADR-0004.

  `InputManager.pointer` now tracks only the primary touch — the finger whose `onPointerDown`
  started the current gesture. Previously every touch id was forwarded into `pointer`, so a second
  finger's `down`/`move` teleported `pointer.position` and its `up` set `justReleased` while the
  first finger was still down. A primary's role does not transfer to a remaining finger when it
  lifts: `pointer.isDown` goes false and stays unset until every touch is up and a fresh
  `onPointerDown` arrives. Other touches were, and remain, visible only through `touches`.

  `GestureDetector.pointerUp`'s `elapsedSinceDown` is now optional and, when passed, re-syncs the
  same clock `update(dt, ...)` accumulates rather than racing it; `pointerUp` also now checks
  whether a long press already fired for the in-progress press and skips tap/swipe if so, so one
  press yields exactly one gesture (previously a config with `tapMaxDuration >=
longPressMinDuration` — the package's own custom-config test — emitted `onLongPress` then `onTap`
  for one hold).

  Per-frame edge flags keep two deliberate shapes rather than one. The boolean-field shape now
  converges on `justPressed`/`justReleased` everywhere: `GamepadButtonState.pressedThisFrame`/
  `releasedThisFrame` are renamed to match the names `Pointer` and `VirtualButtonState` already used.
  The keyed-accessor shape is untouched by design — `KeyboardState.wasPressed`/`wasReleased(code)` and
  `wasButtonPressed`/`wasButtonReleased(state, button)` keep their names, since collapsing either onto
  a bare `justPressed`/`justReleased` would drop the argument that makes them keyed. `resetKeyboardFrame`
  is dropped — `InputManager.update()` now calls `keyboard.reset()` directly, matching `KeyboardState`'s
  existing method-based shape.

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0
  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- @flare-engine/events@0.3.1
- @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

- 2736317: Keyboard input + UI focus driver. `@flare-engine/input` adds `createKeyboard` / `attachKeyboardListeners` (buffered `isDown`/`wasPressed`/`wasReleased` edges, blur clears held keys) + a `KeyBindings` action resolver; keyboard state + binding are platform-neutral (mobile + web) with `keyDown`/`keyUp` injection. `@flare-engine/ui` adds `createFocusKeyboardDriver` — arrows/Tab move focus, Enter/Space activate, via the reactive FocusManager.

### Patch Changes

- d032b4b: physics adds broadphaseSize accessor + fixes the duplicate-broadphase-record leak on re-add (add() now routes to spatial.update when the entity already exists); input accumulates pointer delta across a frame instead of overwriting, matching the per-frame-delta contract.
- Updated dependencies [6a10aa9]
- Updated dependencies [6d439f7]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
  - @flare-engine/math@0.3.0
  - @flare-engine/events@0.3.0

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Updated dependencies []:
  - @flare-engine/events@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
