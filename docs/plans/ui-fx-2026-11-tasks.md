# `@flare-engine/ui-fx` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. In this repo, each task is **one GitHub issue and one PR**:
> `/start <n>` routes it to `engine-builder`, and the session (never the builder) commits.

**Goal:** Ship `@flare-engine/ui-fx`, animated wrappers for React Native, react-native-web and plain
React DOM components, by the 0.5.0 release.

- **Preset families:**
  - live: slide, path slide, fade, emerge-from-shadow, press, 3D flip
  - snapshot: shatter, disintegrate, dust, shader emerge, iris
  - `swap()` animates content changes, and two extension points let apps add their own presets.
- **Parameters** are professional-grade, and presets compose into sequences.

**Architecture:**

- **Headless core.** `./core` holds closed-form maths for timing, fracture, fragment motion, paths,
  live poses and placement.
- **Platform-agnostic React runtime.** It owns presence, the awaited exit and the snapshot handoff.
- **Two drivers:**
  - native: Reanimated worklets on the UI thread, plus an RN-Skia overlay
  - web: Web Animations API keyframes on the compositor, plus a CanvasKit overlay through
    `@flare-engine/render-web`
- **Four entries:**
  - `.` for RN and react-native-web
  - `./dom` for React DOM
  - `./core` for the headless maths
  - `./fx` for the snapshot host, with conditional exports per platform

**Tech Stack:** TypeScript 5.9, Bun (runtime and test), tsdown, Biome, Changesets (fixed
lockstep), Turborepo. React 19.3, React Native 0.88.1, react-native-web 0.21.4, Reanimated 4.7.1,
worklets 0.13, `@shopify/react-native-skia` 2.14.0, canvaskit-wasm 0.41. Tests run on happy-dom
with react-dom.

**Spec:** [ui-fx-2026-11.md](ui-fx-2026-11.md). Read §6, §7, §10 and §11 before Task 1. Approved by
the owner on 2026-11-16, with D7 publishing in 0.5.0 and Apple deferred.

**Gate 0 outcomes (Pixel 7, 2026-11-19).** The results are in spec §11, and the constraints they set
are C36 and C38–C43 in spec §10. The tasks below already include them:

| Constraint | What changed | Tasks |
|---|---|---|
| C36 (G1) | Native captures always use padding, because `elevation` and `boxShadow` draw outside the bounds. | 16 |
| C38 (G2) | Native sprite effects draw from one fixed 4,096-sprite `<Atlas>` pool instead of a layer mounted per effect. | 16, 19, 20 |
| C39 (G2) | While an effect plays, the native host asks Android for the panel's fastest display mode. | 16, 31 |
| C40 (G6) | An exiting element takes no touches. An ancestor unmount ends every exit under it at once, with `finished: true`. | 10, 13, 15 |
| C41 (G2, G8) | The docs recommend worklets Bundle Mode and note that the first build can fail. | 31 |
| C42 (spike) | Native paths are built with `Skia.PathBuilder`, and worklet helpers are declared before their callers. | Code rules |
| C43 (G3) | Native shards draw with `<Vertices>` straight from the capture. There is no native shard bake. | 18 |
| G5 (Android) | `experimental_backgroundImage` doesn't animate on Android, so native live emerge animates only opacity, translate and brightness. | 21 |

## Global Constraints

**Package**

- Name `@flare-engine/ui-fx`, **tier 4** (`LAYER_MAP 'ui-fx': 4`). Dependencies are exactly
  `@flare-engine/math`, `@flare-engine/a11y` and `@flare-engine/render-web`.
- Keep `"private": true` with **no** `publishConfig.access` until Task 32. While private, it needs no
  changeset and is never published (`scripts/check-changeset.mjs:60`,
  `scripts/check-publish-safety.mjs:74`).
- **Entries:**
  - `.` → `src/index.ts`
  - `./core` → `src/core.ts`
  - `./dom` → `src/dom.ts`
  - `./fx` → `{ "react-native": src/fx.native.ts, "browser": src/fx.web.ts, "default": src/fx.web.ts }`,
    in the shape G10 confirms
- **Import boundaries:**
  - `./core` imports `@flare-engine/math` only.
  - `./dom` never imports `react-native`, Reanimated or Skia.
  - `.` never imports Skia.
- **Peers:**
  - `react >=19.0.0`, required
  - optional:
    - `react-dom >=19.0.0`
    - `react-native >=0.86.0`
    - `react-native-reanimated >=4.7.0`
    - `react-native-worklets >=0.13.0`
    - `@shopify/react-native-skia >=2.14.0`
    - `canvaskit-wasm >=0.40.0`
    - `modern-screenshot` (any)
    - `react-native-safe-area-context >=4.0.0`

**Conventions (spec §7.1)**

- Durations are in **seconds**.
- Angles are in degrees, **0° = up, clockwise**, meaning the direction of travel. Screen y points down,
  so 90° is +x.
- Origins are `'center' | 'press' | { x, y }`, with x and y normalised to 0..1 of the element.
- **Springs:**
  - `{ duration, bounce }` with `-1 < bounce < 1`, default 0; or `{ stiffness, damping, mass }`
  - ω0 = 2π/duration; ζ = bounce ≥ 0 ? 1 − bounce : 1/(1 + bounce)
- **Easing names:** the Penner set exported by `@flare-engine/math`, **excluding** `springIn`,
  `springOut` and `springInOut` (#176), plus `{ cubicBezier: [x1, y1, x2, y2] }`.
- **Default caps (C32):** shards ≤ 300, cells ≤ 3,000, capture and atlas ≤ 2,048 px on the longer
  side.
- **Reduced motion:** the default mode is `'system'`. The default fallback is
  `fade({ opacity: 0, duration: 0.15 })`. `ReducedMotionConfig` is never mounted.

**Code rules**

- **Worklets:**
  - Functions that run on the UI thread start with `'worklet';` and read only typed arrays, numbers
    and plain `out` objects.
  - No classes, getters, closures over classes, React Native imports, or calls to non-worklet
    helpers inside them.
  - Never run the worklets Babel plugin in the build. `dist` must keep the directive (see the Task 1
    test).
  - Declare worklet helpers before the worklets that call them. The Babel plugin turns `function`
    declarations marked `'worklet'` into assignments, so they are not hoisted (C42).
- **Native paths** are built with `Skia.PathBuilder`, because RN-Skia 2.14's `SkPath` is immutable
  (C42).
- **Zero allocation per frame:**
  - Per-trigger work allocates only from pools sized by the caps.
  - Per-frame consumers get `…Into(out)` forms.
  - Accepted exceptions:
    - the style object a Reanimated `useAnimatedStyle` worklet returns
    - the array of plain `{ x, y }` vertex positions that a `useDerivedValue` returns for a native
      `<Vertices>` shard layer (C43). RN-Skia 2.14's `Skia.Point` is getter-only, so
      `usePointBuffer` can't reuse points. The cap is 300 shards, and G3 saw no GC hitch at that
      size.
- **House rules:**
  - no `any`, `as any` or `@ts-ignore`
  - named exports and `import type`
  - plain objects plus module functions, no classes
  - no `TODO` / `FIXME`
  - comment only the non-obvious
  - `noUncheckedIndexedAccess` applies to typed arrays, so use the house idiom: a non-null assertion
    into a local, `const x = buf[i]!;`

**Tests**

- Tests live in `packages/ui-fx/tests/**`.
- React tests render through `react-dom/client` on `@happy-dom/global-registrator` (C31).
- `react-native`, Reanimated and Skia are mocked with `mock.module`.
- The package `test` script is `bun ../../scripts/test-isolated.mjs`, one process per file.
- For TDD, `bun test packages/ui-fx/tests/<file>` runs a single file.
- Goldens involving trigonometry compare with a tolerance of 1e-6 unless a step says otherwise.

**Gate, commits and milestones**

- **Gate per PR:** `bash .claude/hooks/verify.sh`, plus `bun run check:exports`, `check:nodenext`,
  `check:readme` and `check:tarballs` (these run in CI only).
- **Commits are made by the session, not the builder:**
  - Conventional Commits with the scope `ui-fx`, ≤72 characters, no body, no trailer.
  - The branch is `claude/*`.
- **Milestones:** "UI FX" (proposed due date 2027-03-12, for Tasks 1-31) and "0.5.0" (Task 32).
  The Phase 0 spikes are hand-lane work. Deferred Apple items have no milestone.

## Review Focus

These are the five inputs most likely to break a real app. Each one is pinned by a test in the
owning task.

1. **The element is removed while its capture is still in flight** (an ancestor unmounts it during
   the ~1-3 frame capture). Expected: no throw, nothing drawn, no element stuck hidden, and
   `onExited(true)` at once (C40). The run itself still ends with `onEnd(false)`. Pinned in
   Tasks 10, 16 and 17.
2. **The same key returns during a snapshot exit** (an "undo delete" in a list). Expected:
   - The new instance plays its own `enter`.
   - The old overlay finishes untouched.
   - No duplicate row.
   - Pinned in Tasks 10 and 24.
3. **The element measures null, zero-size or fully off-screen.** Expected: no capture and no overlay;
   exit completes at once with `onExited(true)`. Pinned in Task 10.
4. **Web capture or CanvasKit fails:**
   - no rasterizer registered
   - a `SecurityError` from a tainted canvas
   - a rejected `loadCanvasKit`
   - `webglcontextlost` mid-run
   Expected: the live fallback plays (or the run ends with `finished: false` if the context dies
   mid-run), a warning appears once in development, and nothing throws. Pinned in Task 17.
5. **An oversized element**, such as a full-screen card at pixel ratio 3. Expected: the capture is
   downscaled to ≤ 2,048 px, the fragment count is clamped by raising the cell size, and the atlas
   stays ≤ 2,048 px. Pinned in Tasks 5, 16, 17 and 19.

---

## File map

```
packages/ui-fx/
  package.json  tsdown.config.ts  tsconfig.json  README.md
  src/
    index.ts  core.ts  dom.ts  fx.native.ts  fx.web.ts        entry points
    core/                                                       ./core (math only)
      conventions.ts timing.ts presets.ts registry.ts timeline.ts prng.ts
      fracture/{types,grid,triangles,radial-glass,cells,clip,cache,pack,generate}.ts
      motion/{layout,init,pose}.ts
      path/{svg,arc-table}.ts
      live.ts placement.ts toast-layout.ts sksl.ts
    runtime/                                                    React, platform-agnostic, not exported
      contracts.ts presence.tsx element.ts provider-context.ts reduced-motion.ts
      list-presence.ts toast-store.ts
    native/                                                     RN only
      live-driver.ts reduced-motion.ts a11y.ts
    web/                                                        RNW + DOM
      live-driver.ts reduced-motion.ts capture.ts kit.ts fx-runtime.ts atlas.ts flip.ts
    rn/                                                         `.` components
      provider.tsx create-flare-component.tsx wrappers.tsx flare-item.tsx flare-flat-list.tsx
      toaster.tsx tooltip.tsx modal.tsx use-flare-fx.ts
    dom/                                                        `./dom` components
      provider.tsx create-flare-component.tsx wrappers.tsx flare-list.tsx
      toaster.tsx tooltip.tsx modal.tsx use-flare-fx.ts
    fx/
      native/{host.tsx,capture.ts,pool.ts,display-mode.ts,layers/{shatter,grains,dust,emerge}.tsx}
      web/{host.tsx,bake.ts,effects/{shatter,grains,dust,emerge}.ts}
  android/ + expo-module.config.json                            Task 16: the C39 display-mode module
  tests/ (mirrors src/) + tests/support/{dom.ts,mock-rn.ts,mock-reanimated.ts,mock-skia.ts,mock-kit.ts}
  e2e/ (Task 30: Vite fixtures for RNW and DOM, Playwright under node)
```

---

## Phase 0: Gate 0 (hand-lane, nothing merges)

Each spike runs as an owner plus agent session. Its code goes in a throwaway Expo 58 or Vite app at
`C:\_PROG\flare-engine-workspace\ui-fx-spike`, never committed. The output is a comment on the issue
plus an edit to the spec's §11 row (pass/fail and consequence). There are no iOS rows (D8).

### Task 0.1: owner, create the npm name and its Trusted Publisher entry (UIFX-0.1)

- **Labels:** `type:owner-action`, `scope:harness`, `size:s`, `priority:p2`. **Before:** Task 32.

- [ ] Confirm how a brand-new scoped name gets its first publish after the token teardown (#51).
- [ ] Create `@flare-engine/ui-fx`, and add `grzott/flare-engine` + `release.yml` as its trusted
  publisher.
- [ ] Record the mechanism in `.changeset/README.md` "Publishing prerequisites". This is a held path,
  so it goes in an owner PR.

### Task 0.2: spike G1, native capture on Android (UIFX-0.2)

- **Labels:** `type:verification`, `scope:engine`, `size:m`, `priority:p2`

- [ ] Time `makeImageFromView` on a 120x44 dp button, a 360x64 dp row and a 360x240 dp card, on a
  Pixel 7 and on a TestingBot Galaxy A55. Report p50 and p95 over 30 captures.
- [ ] Screenshot fidelity for elevation, `boxShadow`, `borderRadius` with `overflow: hidden`, and a
  remote image.
- [ ] Capture an element laid out at `left: -10000` with opacity 1, for assemble-in. It must not come
  out blank.
- [ ] Hand off on the same frame: a shared value flips the element's opacity to 0 in the worklet that
  draws the overlay's first frame. Record a 240 fps video and look for a gap or double image.
- [ ] Update spec §11 G1.

### Task 0.3: spike G2/G3/G8, UI-thread Atlas budget, shard bake, data transfer (UIFX-0.3)

- **Labels:** `type:perf`, `scope:engine`, `size:m`, `priority:p2`

- [ ] Run `<Atlas>` with `useRSXformBuffer` evaluating a closed-form ballistic pose at 300, 1k, 3k and
  5k sprites, with and without `colors`. Report UI-thread frame times on both phones (bench machine on
  the normal power plan).
- [ ] Compare a layer component mounted per effect (keyed) against a fixed-capacity pool of 4,096
  with zero-scale padding.
- [ ] Bake 40 and 300 clipped polygons into one atlas, comparing raster `Skia.Surface.Make` with a
  UI-thread `MakeOffscreen`. Draw the result from the overlay canvas.
- [ ] Transfer a 5k×12 `Float32Array` to the UI runtime, in Legacy Eval and in Bundle Mode. Measure
  the copy cost, and check that no `importForwarding` is needed.
- [ ] Update spec §11 G2, G3 and G8, and C32 if the caps move.

### Task 0.4: spike G4/G9/G10, web capture, WAAPI, conditional exports (UIFX-0.4)

- **Labels:** `type:verification`, `scope:engine`, `size:m`, `priority:p2`

- [ ] Build two apps: Vite plus react-dom, and Vite plus react-native-web (alias `react-native` →
  `react-native-web`).
- [ ] In both: `modern-screenshot.domToCanvas`, then `kit.MakeImageFromCanvasImageSource`, then
  `drawAtlas` with reused `Float32Array`s on a `render-web` `createWebSurface` canvas portalled to
  `document.body`.
- [ ] Measure capture latency on Chrome, Firefox and WebKit, and check fidelity for shadows, web
  fonts and a CORS image.
- [ ] Reuse `globalThis.CanvasKit` after RN-Skia's `LoadSkiaWeb`, and confirm the page holds one
  CanvasKit instance.
- [ ] WAAPI: animate `transform` with `composite: 'add'` and `opacity`/`filter` with
  `composite: 'replace'` on an RNW host node while React re-renders its style. Exercise `reverse()`
  and `currentTime` scrubbing.
- [ ] Conditional exports for `./fx`: confirm that Expo 58 Metro resolves `react-native` on Android
  and `browser` on web, that Vite resolves `browser`, and that `check:exports`, publint and attw
  pass on a packed stub.
- [ ] Update spec §11 G4, G9 and G10. If G10 fails, switch to the named-entries fallback (§11)
  before Task 1.

### Task 0.5: spike G5/G6/G7, live emerge, exit and reflow, anchoring (UIFX-0.5)

- **Labels:** `type:verification`, `scope:engine`, `size:s`, `priority:p2`

- [ ] On Android and web, animate an RN 0.88 `experimental_backgroundImage` linear-gradient overlay
  (angle plus stop) and `filter: brightness()` through Reanimated 4.7 `useAnimatedStyle`.
- [ ] Remove a row from `Animated.FlatList` with `itemLayoutAnimation={LinearTransition}` while an
  overlay plays. Check that the gap closes smoothly and that touches do not land on the removed row.
- [ ] Inside an RN `Modal` and under Android translucent bars, compare
  `ref.current.getBoundingClientRect()` with `measureInWindow`.
- [ ] Update spec §11 G5, G6 and G7.

---

## Phase 1: package and headless core

### Task 1: scaffold `packages/ui-fx` (UIFX-01)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. Expected `risk:held`
  (`scripts/check-deps-tiers.mjs`, manifests).
- **Depends on:** 0.4 (the exports shape).

**Files:**
- Create: `packages/ui-fx/{package.json,tsdown.config.ts,tsconfig.json,README.md}`, the entries
  `src/{index,core,dom,fx.native,fx.web}.ts` (each exporting `UI_FX_ENTRY` for now), and
  `tests/support/dom.ts`
- Modify: `scripts/check-deps-tiers.mjs` (add `'ui-fx': 4` to `LAYER_MAP`), the perf-bytes ceiling
  (per the repo recipe), `docs/design/architecture.md` (a Layer 4 row: "Animated RN/RNW/DOM component
  wrappers"), and `docs/design/api-specs.md` (a section stub linking the spec)
- Test: `tests/entries.test.ts`, `tests/build/worklet-directive.test.ts`

**Interfaces:**
- **Produces:**
  - `export const UI_FX_ENTRY: 'rn' | 'core' | 'dom' | 'fx-native' | 'fx-web'`, one per entry. It is
    replaced by real exports later.
  - `tests/support/dom.ts`:
    - `installDom(): void` registers happy-dom globals
    - `render(el: ReactNode): { container: HTMLElement; rerender(el): void; unmount(): void }` uses
      `react-dom/client` + `act`
    - `flushFrames(n: number): Promise<void>` advances `requestAnimationFrame`

- [ ] **Step 1: write failing tests.**
  - `entries.test.ts`:
    - Each entry imports and reports its `UI_FX_ENTRY`.
    - `core` has no `react` / `react-native` / `@shopify/react-native-skia` / `react-dom` import in
      its module graph: walk `import` statements of `src/core.ts` and `src/core/**` and assert that
      only `@flare-engine/math` and relative paths appear.
    - `dom` has no `react-native` or Skia import.
    - `index` has no Skia import.
  - `worklet-directive.test.ts`: after `bun run build`, every function in `src/**` whose body starts
    with `'worklet'` still starts with `"worklet"` in `dist/*.mjs` and `dist/*.js`. Count them in
    source and in dist: the counts must be equal and non-zero once Task 2 lands. Until then, assert
    the counts are equal.
- [ ] **Step 2:** run `bun test packages/ui-fx/tests/entries.test.ts`. **Expected:** FAIL (no package).
- [ ] **Step 3: scaffold the package.**
  - `package.json`: `"private": true`, `"sideEffects": false`, the exports from Global Constraints,
    the peers and `peerDependenciesMeta` with every optional peer marked optional.
  - `devDependencies`: `@types/react`, `react-dom`, `@happy-dom/global-registrator`.
  - tsdown entries: the five `src/*.ts` files, `format: ['esm','cjs']`, `dts: true`,
    `fixedExtension: false`.
- [ ] **Step 4:** run `bun run build --filter=@flare-engine/ui-fx`, then
  `bun test packages/ui-fx/tests`. **Expected:** PASS.
- [ ] **Step 5:** run the gate (`bash .claude/hooks/verify.sh`, `bun run check:deps`,
  `check:exports`, `check:nodenext`). **Expected:** all green.
- [ ] **Step 6:** commit `feat(ui-fx): scaffold the private ui-fx package`.

### Task 2: core conventions and timing (UIFX-02)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 1.

**Files:**
- Create: `src/core/conventions.ts`, `src/core/timing.ts`
- Test: `tests/core/conventions.test.ts`, `tests/core/timing.test.ts`

**Interfaces:**
- **Produces, `conventions.ts`:**
  - `interface Vec2Out { x: number; y: number }`
  - `directionInto(angleDeg: number, out: Vec2Out): Vec2Out` (worklet)
  - `type OriginSpec = 'center' | 'press' | { x: number; y: number }`
  - `resolveOriginInto(o: OriginSpec, w: number, h: number, press: Vec2Out | null, out: Vec2Out): Vec2Out`.
    Returns element pixels; `'press'` with a null press point resolves to the centre.
  - `type Edge = 'left' | 'right' | 'top' | 'bottom' | 'start' | 'end'`
  - `resolveEdge(e: Edge, rtl: boolean): 'left' | 'right' | 'top' | 'bottom'`
- **Produces, `timing.ts`:**
  - `type SpringSpec = { duration: number; bounce?: number } | { stiffness: number; damping: number; mass?: number }`
  - `interface ResolvedSpring { omega0: number; zeta: number }`
  - `resolveSpring(s: SpringSpec): ResolvedSpring`
  - `springStepAt(omega0: number, zeta: number, t: number): number` (worklet; unit step response
    from 0 to 1)
  - `springSettleTime(s: ResolvedSpring, epsilon = 1e-3): number`
  - `type EasingName` (the Penner names, see Global Constraints)
  - `type EasingSpec = EasingName | { cubicBezier: readonly [number, number, number, number] }`
  - `interface TimingInput { duration?: number; easing?: EasingSpec; spring?: SpringSpec; delay?: number }`
  - `interface TimingTable { delay: number; duration: number; samples: Float32Array }`
  - `compileTiming(t: TimingInput, defaultDuration: number, samplesPerSecond = 120): TimingTable`
  - `timingAt(samples: Float32Array, delay: number, duration: number, t: number): number` (worklet;
    linear interpolation; 0 before the delay, the last sample after the end)
  - `timingToCssLinear(table: TimingTable, maxPoints = 64): string`

- [ ] **Step 1: write the failing tests.**

```ts
test('directionInto: 0° up, 90° right, clockwise', () => {
  expect(directionInto(0, o)).toMatchObject({ x: 0, y: -1 });
  expect(directionInto(90, o).x).toBeCloseTo(1, 12);
  expect(directionInto(180, o).y).toBeCloseTo(1, 12);
});
test('resolveEdge start/end follow rtl', () => {
  expect(resolveEdge('start', false)).toBe('left');
  expect(resolveEdge('start', true)).toBe('right');
});
test('resolveSpring duration+bounce', () => {
  expect(resolveSpring({ duration: 0.5 })).toEqual({ omega0: (2 * Math.PI) / 0.5, zeta: 1 });
  expect(resolveSpring({ duration: 0.5, bounce: 0.3 }).zeta).toBeCloseTo(0.7, 12);
  expect(resolveSpring({ duration: 0.5, bounce: -0.5 }).zeta).toBeCloseTo(2, 12);
  expect(resolveSpring({ stiffness: 100, damping: 10, mass: 1 })).toEqual({ omega0: 10, zeta: 0.5 });
});
test('resolveSpring rejects', () => {
  for (const bad of [{ duration: 0 }, { duration: 0.5, bounce: 1 }, { duration: 0.5, bounce: -1 }, { duration: Number.NaN }])
    expect(() => resolveSpring(bad)).toThrow(RangeError);
});
test('springStepAt matches @flare-engine/animation stepping', () => {
  // for zeta in [0.3, 1, 2]: step spring(0, 1, {stiffness: w0², damping: 2ζw0, mass: 1}) with updateSpring dt=0.001 for 1000 steps;
  // compare springStepAt(w0, ζ, k*0.001) at every 50th step within 1e-6
});
test('cubicBezier ease at x=0.5', () => {
  const tbl = compileTiming({ duration: 1, easing: { cubicBezier: [0.25, 0.1, 0.25, 1] } }, 1);
  expect(timingAt(tbl.samples, 0, 1, 0.5)).toBeCloseTo(0.8024, 3);
});
test('delay and end clamp', () => {
  const tbl = compileTiming({ duration: 0.3, easing: 'easeOutCubic', delay: 0.1 }, 0.3);
  expect(timingAt(tbl.samples, tbl.delay, tbl.duration, 0.05)).toBe(0);
  expect(timingAt(tbl.samples, tbl.delay, tbl.duration, 9)).toBe(1);
});
test('spring + duration is rejected', () => {
  expect(() => compileTiming({ duration: 1, spring: { duration: 0.4 } }, 1)).toThrow(RangeError);
});
test('timingToCssLinear', () => {
  expect(timingToCssLinear(compileTiming({ duration: 0.2 }, 0.2))).toMatch(/^linear\(0(, [\d.]+)+, 1\)$/);
});
```

- [ ] **Step 2:** run `bun test packages/ui-fx/tests/core/timing.test.ts`. **Expected:** FAIL.
- [ ] **Step 3: implement.**
  - **cubicBezier:** solve x(u) = x by Newton (8 iterations), falling back to bisection, then
    evaluate y(u).
  - **Spring sample count:** for a spring, `duration` = `springSettleTime`. For ζ < 1 that is
    −ln(ε)/(ζω0); for ζ ≥ 1, scan forward in steps of 1/240 s until both |1 − x| < ε and |dx| < ε.
  - **springStepAt branches:** ζ < 1, ζ = 1 (within 1e-6), ζ > 1. These are the formulas in spec
    §3.10 and `packages/animation/src/spring.ts:79-130`.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add core conventions and closed-form timing`.

### Task 3: presets, validation and registry (UIFX-03)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 2.

**Files:**
- Create: `src/core/presets.ts`, `src/core/registry.ts`
- Test: `tests/core/presets.test.ts`, `tests/core/registry.test.ts`

**Interfaces:**
- **Produces, common type:**
  - `interface PresetCommon extends TimingInput { reduceMotion?: 'system' | 'always' | 'never'; fallback?: LivePreset }`
- **Produces, live presets:**
  - `FadePreset { kind: 'fade'; opacity: number }` (the away state)
  - `SlidePreset { kind: 'slide'; from: Edge | { angle: number; distance: number } | { x: number; y: number }; distance: number; path: PathSpec | null; alignOrigin: { x: number; y: number }; autoRotate: boolean | number; rotationLimit: number; start: number; end: number }`
  - `PressPreset { kind: 'press'; scale: number; opacity: number; brightness: number }`
  - `EmergePreset { kind: 'emerge'; variant: 'live' | 'shader'; angle: number; softness: number; falloff: 'linear' | 'smoothstep' | 'exp'; distance: number; shadow: { color: string; opacity: number; lag: number; blur: number; length: number }; sheen: { width: number; intensity: number; color: string; delay: number } | null }`
- **Produces, fragment presets** (`ShatterPreset`, `DisintegratePreset`). Each has `fragment`,
  `forces`, `release`, `physics`, `life`, `reverse` and `maxFragments`:
  - `FragmentSpec { pattern: 'grid' | 'jittered-grid' | 'triangles' | 'radial-glass' | 'cells'; count: number; cell: number; distribution: 'uniform' | 'normal' | 'inverse-normal' | 'exponential'; focus: OriginSpec; deviation: number; jitter: number; anisotropy: { x: number; y: number }; gap: number; rotation: number; seed: number; subdivide: { depth: number; chance: number; select: 'near-impact' | 'small' | 'random' } | null }`
  - `ForceSpec { kind: 'radial' | 'directional' | 'vortex' | 'implode'; origin: OriginSpec; radius: number; strength: number; falloff: 'none' | 'linear' | 'inverse-square' | 'smoothstep'; angle: number; spread: number }`
  - `ReleaseSpec { order: 'radial' | 'sweep' | 'random'; duration: number; softness: number; timingRandomness: number; angle: number }`
  - `PhysicsSpec { gravity: number; gravityAngle: number; drag: number; angularDrag: number; spin: number; randomness: number; massVariance: number; depth: number; collide: 'none' | 'floor' | 'bounds' }`
  - `LifeSpec { opacity: [number, number]; scale: [number, number]; lifetime: number; lifetimeVariance: number; fadeStart: number }`
- **Produces, `DustPreset`:**
  `{ kind: 'dust'; sweepAngle: number; noiseScale: number; noiseAmount: number; softness: number; edgeWidth: number; edgeColor: string; spread: number; grainsAtFront: number; seed: number }`
- **Produces, unions:**
  - `type LivePreset = FadePreset | SlidePreset | PressPreset | (EmergePreset & { variant: 'live' })`
  - `type SnapshotPreset = ShatterPreset | DisintegratePreset | DustPreset | (EmergePreset & { variant: 'shader' })`
  - `type FlarePreset = (LivePreset | SnapshotPreset) & PresetCommon`
- **Produces, functions:**
  - Factories: `fade`, `slide`, `press`, `emerge`, `shatter`, `disintegrate`, `dust`, each
    `(opts?: DeepPartial<…>) => …`. They return frozen objects.
  - `isSnapshotPreset(p): p is SnapshotPreset`
  - `liveFallbackOf(p): LivePreset`
  - `presetDuration(p): number` (seconds, including the delay; a fragment preset's duration is
    `release.duration + life.lifetime × (1 + lifetimeVariance)`)
- **Produces, registry:**
  - `createPresetRegistry(): PresetRegistry` with
    `{ register(name: string, p: FlarePreset): void; resolve(ref: PresetRef): FlarePreset }`
  - `type PresetRef = FlarePreset | string`. Task 4 widens both to include `FlareTimeline`.

**Defaults** (the spec §6.3 sketch values become the defaults):

| Preset | Defaults |
|---|---|
| fade | `opacity 0`, `duration 0.25` |
| slide | `from 'bottom'`, `distance 48`, `duration 0.35`, `easing 'easeOutCubic'` |
| press | `scale 0.96`, `opacity 1`, `brightness 1`, `duration 0.12` |
| emerge | `variant 'live'`, `angle 135`, `softness 0.4`, `falloff 'smoothstep'`, `distance 12`, `duration 0.45`, shadow `{'#000', 0.6, 0.3, 8, 0}` |
| shatter | `pattern 'radial-glass'`, `count 40`, `focus 'press'`, one radial force `{origin 'press', radius 1.5 (element diagonals), strength 900 px/s, falloff 'linear', angle 0, spread 30}`, release `{order 'radial', duration 0.15, softness 0.5, timingRandomness 0.2, angle 90}`, physics `{gravity 1800, gravityAngle 180, drag 1.2, angularDrag 0.8, spin 360, randomness 0.35, massVariance 0.3, depth 0, collide 'none'}`, life `{opacity [1, 0], scale [1, 0.85], lifetime 0.9, variance 0.25, fadeStart 0.55}`, `reverse 'home'`, `maxFragments 300` |
| disintegrate | the shatter defaults with `pattern 'cells'`, `cell 4`, release `'sweep'` at angle 90 and duration 0.5, `maxFragments 3000` |
| dust | `sweepAngle 90`, `noiseScale 24`, `noiseAmount 0.6`, `softness 0.15`, `edgeWidth 0.04`, `edgeColor '#ffffff'`, `spread 48`, `grainsAtFront 0`, `duration 1.2` |

- [ ] **Step 1: write the failing tests.**
  - Every factory returns its defaults exactly (one `toEqual` per factory).
  - Partial overrides deep-merge: `shatter({ physics: { gravity: 0 } }).physics.drag === 1.2`.
  - Validation throws `RangeError` with field names:
    - `fade({ opacity: 2 })` → `fade: opacity must be in 0..1, got 2`
    - `shatter({ fragment: { count: 1 } })` → `shatter: fragment.count must be an integer in 2..300, got 1`
    - `disintegrate({ cell: 0 })`
    - `emerge({ softness: -0.1 })`
    - `slide({ duration: 0.2, spring: { duration: 0.3 } })`
  - `isSnapshotPreset(emerge({ variant: 'shader' })) === true`, and `false` for `emerge()`.
  - `liveFallbackOf(shatter())` deep-equals `fade({ opacity: 0, duration: 0.15 })`.
    `liveFallbackOf(shatter({ fallback: slide() }))` returns that slide.
  - `presetDuration(fade({ duration: 0.2, delay: 0.1 })) === 0.3`.
  - Registry: register then resolve by name returns the same object. An unknown name throws
    `RangeError('ui-fx: unknown preset "nope"')`. Two registries are independent.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement. Validation lives in one `check(name, field, value, min, max, integer?)`
  helper.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add preset factories, validation, registry`.

### Task 4: timeline composition (UIFX-04)

- **Labels:** `type:feature`, `scope:engine`, `size:s`, `priority:p2`. **Depends on:** 3.

**Files:** create `src/core/timeline.ts`. Test: `tests/core/timeline.test.ts`.

**Interfaces:**
- **Produces:**
  - `interface FlareTimeline { kind: 'timeline'; entries: readonly { start: number; preset: FlarePreset }[]; duration: number }`
  - `sequence(...items: (FlarePreset | FlareTimeline)[]): FlareTimeline`
  - `parallel(...)`
  - `stagger(step: number, ...items)`
  - `delay(seconds: number): FlareTimeline`
  - `snapshotEntry(tl): { start: number; preset: SnapshotPreset } | null`
  - `liveEntries(tl): readonly { start: number; preset: LivePreset }[]`. These are the live entries
    that start before the snapshot entry, if there is one.
  - Widen Task 3's registry: `type PresetRef = FlarePreset | FlareTimeline | string`, and
    `register` / `resolve` accept and return `FlarePreset | FlareTimeline`.

- [ ] **Step 1: write the failing tests.**
  - `sequence(fade({ duration: 0.1 }), delay(0.05), slide({ duration: 0.2 }))` gives entry starts
    `[0, 0.15]` and `duration` 0.35.
  - `parallel` duration is the maximum.
  - `stagger(0.04, a, b, c)` gives starts `[0, 0.04, 0.08]`.
  - Nested timelines flatten with offsets.
  - **Rule:** at most one snapshot entry, and no entry may start after it. `sequence(shatter(), fade())`
    throws `RangeError('ui-fx: nothing can follow a snapshot step')`.
  - `sequence(fade({ opacity: 0.7, duration: 0.06 }), disintegrate())` is valid, and its
    `snapshotEntry` starts at 0.06.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement. Flattening happens at construction, so allocation is fine.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add timeline sequence, parallel, stagger`.

### Task 5: seeded streams and fracture generators (UIFX-05)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 3.

**Files:**
- Create: `src/core/prng.ts` and `src/core/fracture/{types,grid,triangles,radial-glass,cells,clip,cache,pack,generate}.ts`
- Test: `tests/core/prng.test.ts`, `tests/core/fracture/*.test.ts`

**Interfaces:**
- **Produces, `prng.ts`:**
  - `interface PrngStream { s: number }`
  - `createStream(seed: number, concern: 'sites' | 'velocity' | 'timing' | 'noise'): PrngStream`.
    The salts are fixed constants XORed into the seed.
  - `nextUnit(st: PrngStream): number` (mulberry32, returns [0, 1))
- **Produces, `FractureMesh`:**
  - `count: number`
  - `vertexStart: Uint32Array` (count + 1)
  - `vertices: Float32Array` (x, y pairs, normalised 0..1)
  - `centroids: Float32Array` (2 × count)
  - `areas: Float32Array` (count)
  - `bounds: Float32Array` (4 × count: minX, minY, maxX, maxY)
  - `rectangular: boolean`
- **Produces, functions:**
  - `generateFracture(spec: FragmentSpec, widthPx: number, heightPx: number, cache?: FractureCache): FractureMesh`
  - `createFractureCache(capacity = 32): FractureCache` (LRU)
  - `clipPolygonToUnitInto(src: Float32Array, n: number, out: Float32Array): number`
    (Sutherland-Hodgman against [0, 1]²)
  - `interface ShardPacking { atlasW: number; atlasH: number; scale: number; rects: Float32Array }`
    (`rects` holds 4 × count values: x, y, w, h)
  - `packShardsInto(mesh, widthPx, heightPx, padding = 2, maxAtlas = 2048, out: ShardPacking): ShardPacking`
  - `cellGridFor(widthPx, heightPx, cell, maxFragments): { cols: number; rows: number; cell: number }`

**Algorithms** (spec §3.11):
- **radial-glass:**
  - 8-24 rays (from `count`) at angles `(r + j·(u − 0.5)) · 2π/R`.
  - Ring radii `d_k = d0 · g^k` with g = 1.6, until the farthest corner is covered.
  - Each vertex is jittered by `jitter`.
  - Each shard is a quad, or a triangle on the innermost ring, clipped to the unit square.
  - Pieces are smaller near `focus`.
- **jittered-grid:** interior lattice points move by ±`jitter`·cell/2; border points stay on the edge.
- **triangles:** each quad is split on a seeded diagonal.
- **gap:** shrinks every polygon toward its centroid by `gap/2` px, converted to normalised units per
  axis.
- **cells:** a rect grid sized by `cellGridFor`. When cols × rows exceeds `maxFragments`, the cell size
  grows until it fits.

- [ ] **Step 1: write the failing tests.**
  - **prng:** the same seed and concern give identical 1,000-value sequences; different concerns
    differ; every value is in [0, 1).
  - **Invariants for every pattern** with seeds 1, 2 and 3:
    - `sum(areas) ≈ 1 ± 1e-6` when `gap = 0`, and `< 1` when `gap = 4`
    - every polygon is convex (all cross products share a sign) and lies within [0, 1]²
    - identical `vertices` for the same seed; at least one different vertex for a different seed
  - `grid` with `count 12` on a 2:1 element gives 12 pieces, all with `rectangular === true`.
  - `radial-glass` with `focus { x: 0.2, y: 0.5 }`: the mean area of the 25% of pieces nearest the
    focus is below the mean area of the farthest 25%.
  - `cells`: `cellGridFor(360·3, 64·3, 4, 3000)` grows the cell until cols × rows ≤ 3000 (Review
    Focus 5).
  - `packShardsInto`:
    - rects never overlap and stay inside the atlas
    - a 1080×1920 px element with 300 shards gives `scale < 1` and `atlasW, atlasH ≤ 2048`
      (Review Focus 5)
  - Cache: the same spec and aspect (rounded to 2 dp) return the identical object; aspect 1.004 versus
    1.0 hits the same entry.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement. Packing is a shelf packer sorted by height, with `scale` halved until it
  fits `maxAtlas`.
- [ ] **Step 4:** run the tests. **Expected:** PASS. Add a bench line to the PR body: Bun timing for
  40 and 300 shards.
- [ ] **Step 5:** commit `feat(ui-fx): add seeded fracture generators and shard packing`.

### Task 6: closed-form fragment motion (UIFX-06)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 5.

**Files:**
- Create: `src/core/motion/{layout,init,pose}.ts`
- Test: `tests/core/motion/*.test.ts`

**Interfaces:**
- **Produces, `layout.ts`:**
  - `FRAG_STRIDE = 12`, with the offsets
    `HX=0 HY=1 VX=2 VY=3 A0=4 OMEGA=5 DELAY=6 LIFE=7 MASS=8 VZ=9 SRC=10 CX=11`
  - `PHYS_LEN = 16`, with offsets
    `GX GY DRAG ADRAG DEPTH OP0 OP1 SC0 SC1 FADE_START REVERSE_MODE OMEGA0 ZETA TOTAL` (two spare)
- **Produces, `init.ts`:**
  - `initFragmentsInto(mesh: FractureMesh, p: ShatterPreset | DisintegratePreset, widthPx: number, heightPx: number, press: Vec2Out | null, out: Float32Array): number`
    (returns the count; runs on the JS thread)
  - `packPhysicsInto(p, out: Float32Array): Float32Array`
- **Produces, `pose.ts`:**
  - `interface FragmentPose { x: number; y: number; rotation: number; scale: number; alpha: number }`
    (`rotation` in radians)
  - `fragmentPoseInto(state: Float32Array, i: number, t: number, phys: Float32Array, out: FragmentPose): FragmentPose`
    (worklet)

**Algorithm, `pose.ts`.** Write this exactly. τ = clamp(t − delay, 0, life); k = drag; ka = angularDrag;
g = (gx, gy).

```
k > 0:  x = hx + (gx/k)·τ + (vx − gx/k)·(1 − e^(−kτ))/k     (same for y)
k = 0:  x = hx + vx·τ + gx·τ²/2
rotation = a0 + ω·(ka > 0 ? (1 − e^(−ka·τ))/ka : τ)
u = τ/life
alpha = u < fadeStart ? op0 : lerp(op0, op1, smoothstep(fadeStart, 1, u))
scale = lerp(sc0, sc1, u) · (1 + depth·vz·τ)
reverse modes (phys[REVERSE_MODE]): 0 forward;
  1 rewind (evaluate at total − t);
  2 home (pose at total, lerped to home by timingAt over t/total);
  3 spring-home (lerp factor = springStepAt(omega0, zeta, t))
```

**Algorithm, `init.ts`** (spec §3.11). For each piece i:

```
d = centroid − origin
w = falloff(|d|/radius)
dir = normalize(d) rotated by (u − 0.5)·2·randomness·spread
mass = lerp(1, area/meanArea, massVariance)
v0 = dir·strength·w·(1 + (u − 0.5)·randomness)/mass
ω0 = spin·(deg→rad)·(u − 0.5)·2·(0.5 + randomness)
delay = order === 'radial' ? (|d|/maxD)·release.duration
      : order === 'sweep'  ? dot(centroid, dir(release.angle))·release.duration
      : u·release.duration
delay += u·timingRandomness·release.duration
life = lifetime·(1 + (u − 0.5)·2·lifetimeVariance)
```

Draws come from the `velocity` and `timing` streams in index order. A directional force uses
`dir(angle)` instead of `normalize(d)`. `implode` negates.

- [ ] **Step 1: write the failing tests.**
  - At t = 0, every pose is home, with `rotation` = a0 = 0, `alpha` 1 and `scale` 1.
  - With gravity 0, drag 0 and spin 0: `x(τ) = hx + vx·τ` exactly.
  - With drag 1.2 and gravity 1800 at angle 180: the closed form matches a semi-implicit Euler
    integration at dt = 1e-5 to within 1e-3 px at τ = 0.5.
  - A piece with delay 0.2 sits at home for every t < 0.2.
  - Radial force with randomness 0 and massVariance 0: v0 points away from the origin
    (`dot(v0, d) > 0`), and at equal |d| the speeds are equal.
  - `rewind` at t equals forward at `total − t`.
  - `home` at t = total equals home exactly.
  - Purity: two calls with the same arguments are identical, and the result does not depend on the
    call order.
  - Determinism: the init arrays are byte-equal for the same seed.
  - `press = null` with `origin 'press'` uses the centre.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add closed-form fragment motion`.

### Task 7: path motion (UIFX-07)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 2.

**Files:** create `src/core/path/{svg,arc-table}.ts`. Test: `tests/core/path/*.test.ts`.

**Interfaces:**
- **Produces:**
  - `type PathSpec = { cubic: readonly number[] } | { points: readonly number[]; curviness?: number } | { svg: string }`.
    `cubic` is groups of 8 numbers (p0, c1, c2, p3); `points` is x, y pairs turned into Catmull-Rom
    through `@flare-engine/math` `catmullRomInto`, then into cubics.
  - `interface ArcTable { segs: Float32Array; segCount: number; samplesPerSeg: number; lut: Float32Array; total: number }`
  - `buildArcTable(p: PathSpec, samplesPerSeg = 32): ArcTable`
  - `interface PathPose { x: number; y: number; angleDeg: number }`. `angleDeg` = atan2(dy, dx) in
    degrees, the rotation that aligns +x with the tangent.
  - `pathPoseAtInto(tbl: ArcTable, distance: number, out: PathPose): PathPose` (worklet; a distance
    outside 0..total extrapolates along the end tangent)
  - `parseSvgPath(d: string): number[]` (M/L/H/V/C/Q/Z, absolute and relative)

- [ ] **Step 1: write the failing tests.**
  - A straight cubic `0,0, 33,0, 66,0, 100,0` has `total` 100 ± 1e-3, and the pose at distance 50 is
    `{50, 0, 0°}`.
  - A vertical-down line has a tangent of 90°.
  - A quarter-circle cubic of r = 100 has total ≈ 157.08 ± 0.2.
  - On an S-curve, the arc-length error at 32 samples is below 0.5% against a 4,096-sample reference.
  - `parseSvgPath('M0 0 l100 0')` gives one cubic ending at (100, 0).
  - Distance 120 on the 100-long line gives x = 120 at angle 0° (overshoot extrapolates).
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement. The pose lookup is a binary search on `lut`.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add arc-length path motion`.

### Task 8: live pose compile and evaluate (UIFX-08)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 3, 7.

**Files:** create `src/core/live.ts`. Test: `tests/core/live.test.ts`.

**Interfaces:**
- **Produces:**
  - `LIVE_POSE_STRIDE = 11`
  - `interface LivePose { tx: number; ty: number; rotationDeg: number; rotateXDeg: number; rotateYDeg: number; perspective: number; scale: number; opacity: number; brightness: number; shadowEdge: number; shadowOpacity: number }`.
    Row order matches the field order. `perspective` 0 means none.
  - `interface CompiledLive { kind: number; params: Float32Array; timing: TimingTable; path: ArcTable | null; duration: number; uses3d: boolean }`
  - `compileLive(input: LivePreset | readonly { start: number; preset: LivePreset }[], widthPx: number, heightPx: number, rtl: boolean): CompiledLive`.
    - A list compiles a timeline's live entries.
    - Each entry is evaluated at `t − start` and held at its final pose after it ends.
    - Entries compose: translations and rotations add; scale, opacity and brightness multiply;
      shadow values take the maximum.
    - `duration` is the latest entry end.
  - `livePoseAtInto(c: CompiledLive, t: number, direction: 1 | -1, pressT: number, out: LivePose): LivePose`
    (worklet).
    - `direction: 1` (enter) goes from the away state to rest. `-1` (exit) goes from rest to away.
    - `pressT` in 0..1 blends the press pose multiplicatively (scale, opacity, brightness).
  - `sampleLivePosesInto(c: CompiledLive, direction: 1 | -1, fps: number, out: Float32Array): number`
    (rows of `LIVE_POSE_STRIDE`; returns the row count, ceil(duration·fps) + 1)

**Away-state semantics:**
- **fade:** `opacity` is the away value.
- **slide, `from` edge:**
  - `'right'` starts at tx = +distance; `'left'` at −distance; `'top'` at ty = −distance;
    `'bottom'` at ty = +distance.
  - `start` and `end` resolve through `resolveEdge`.
- **slide, `{ angle, distance }`:** the travel direction is `angle`, so the away state is
  −direction·distance.
- **slide, `{ x, y }`:** an absolute offset in pixels.
- **slide with a path:** the pose is `pathPoseAtInto(lerp(start, end, eased)·total)` relative to the
  path end. Rotation is the tangent (when `autoRotate`) plus the offset, clamped to ±`rotationLimit`.
- **emerge (live):** tx/ty = −direction(angle)·distance·(1 − eased);
  `brightness = lerp(1 − shadow.opacity, 1, lagged)`; `shadowEdge = eased`;
  `shadowOpacity = shadow.opacity·(1 − eased)`.

- [ ] **Step 1: write the failing tests.**
  - Enter with `fade()`: t = 0 gives opacity 0; t = duration gives 1.
  - Exit with `fade({ opacity: 0.7 })` ends at 0.7.
  - `slide({ from: 'right' })` enter: t = 0 gives tx = 48.
  - `slide({ from: 'start' })` with rtl gives tx = +48.
  - `slide({ from: { angle: 90, distance: 40 } })` enter: t = 0 gives tx = −40, ty = 0.
  - A path slide with `autoRotate` and a `{ cubicBezier: [0.3, 1.6, 0.6, 1] }` overshoot easing: the
    rotation never flips by more than 90° between consecutive samples.
  - `pressT = 1` with `press({ scale: 0.96 })` gives scale 0.96 × the base scale.
  - `sampleLivePosesInto` returns `ceil(0.25·60) + 1 = 16` rows for a 0.25 s fade at 60 fps, and its
    last enter row is the rest pose (`0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0`). `uses3d` is false for every
    non-flip preset.
  - The `parallel(fade(), slide({ from: 'right' }))` entries at mid-time give opacity equal to fade
    alone and tx equal to slide alone.
  - The exit entries of `sequence(fade({ opacity: 0.7, duration: 0.06 }), slide())` hold opacity
    0.7 after 0.06 s.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add live pose compiler and evaluator`.

### Task 9: placement solver and toast stack layout (UIFX-09)

- **Labels:** `type:feature`, `scope:engine`, `size:s`, `priority:p2`. **Depends on:** 1.

**Files:** create `src/core/placement.ts` and `src/core/toast-layout.ts`. Test:
`tests/core/placement.test.ts`, `tests/core/toast-layout.test.ts`.

**Interfaces:**
- **Produces:**
  - `interface RectLike { x: number; y: number; width: number; height: number }`
  - `interface PlacementOptions { side: 'top' | 'bottom' | 'left' | 'right'; align: 'start' | 'center' | 'end'; offset: number; padding: number; flip: boolean; shift: boolean; arrow: number }`
  - `interface Placement { x: number; y: number; side: PlacementOptions['side']; arrowOffset: number }`
  - `placeFloatingInto(anchor: RectLike, floatingW: number, floatingH: number, viewport: RectLike, o: PlacementOptions, out: Placement): Placement`
  - `interface ToastStackOptions { position: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; gap: number; offset: number; visible: number }`
  - `layoutToastStackInto(heights: Float32Array, count: number, viewport: RectLike, o: ToastStackOptions, out: Float32Array): number`
    (writes y per toast, returns the visible count)

- [ ] **Step 1: write the failing tests.**
  - An anchor at y = 4 with side `top` and `flip` gives side `bottom`.
  - An anchor at the right edge with `shift` and padding 8 keeps `x + w ≤ viewport.width − 8`.
  - `arrowOffset` targets the anchor centre, clamped into `[arrow, w − arrow]`.
  - Toast `bottom` with gap 14, offset 16 and heights `[40, 40, 40, 40]`: the visible count is 3, and
    the y values stack upward from `viewport.height − 16 − 40`.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add tooltip placement and toast stack layout`.

---

## Phase 2: shared React runtime

### Task 10: runtime contracts, presence and element orchestration (UIFX-10)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 4, 8.

**Files:**
- Create: `src/runtime/{contracts.ts,presence.tsx,element.ts,provider-context.ts}`
- Test: `tests/runtime/element.test.tsx`, `tests/runtime/presence.test.tsx`, `tests/support/fakes.ts`

**Interfaces, `contracts.ts`:**

```ts
type ProgressSource = { readonly value: number };
interface LiveDriver {
  play(c: CompiledLive, direction: 1 | -1, o: { progress?: ProgressSource; onEnd(finished: boolean): void }): void;
  reverse(): void;                 // reverse the running animation from its current pose
  setPressed(pressed: boolean, c: CompiledLive | null): void;
  hidden: { value: number };       // 1 hides the element; native SharedValue, web box
  hideSync(): void;                // web: apply hidden immediately; native: no-op
  cancel(): void;                  // hold current pose, end with finished=false
  dispose(): void;
}
interface FxImage { width: number; height: number; pixelRatio: number; handle: unknown }
interface FxTarget {
  measure(): Promise<RectLike | null>;   // window coordinates
  capture(maxPx: number): Promise<FxImage | null>;
  hidden: { value: number };
  hideSync(): void;
}
interface FxRunOptions { direction: 1 | -1; press: Vec2Out | null; progress?: ProgressSource;
  onHandoff(): void; onEnd(finished: boolean): void;
  onFallback(): void }             // capture/kit unavailable before handoff → element plays live fallback
interface FxRun { cancel(): boolean }    // true only if cancelled before handoff
interface FxRuntime { run(t: FxTarget, p: SnapshotPreset, o: FxRunOptions): FxRun }
type FxEvent = { phase: 'start' | 'end'; cause: 'enter' | 'exit' | 'play'; finished: boolean };
```

**Interfaces, other files:**
- `provider-context.ts`:
  - `FlareContext` holding
    `{ registry: PresetRegistry; reducedMotion: ReducedMotionSource; fx: FxRuntime | null; overlay: OverlayPortal | null; hostFactory: (() => ReactNode) | null; rtl: boolean }`
  - `useFlareContext()`
- `presence.tsx`:
  - `FlarePresence({ children })` keeps a removed keyed child mounted until its `release` runs.
  - `usePresence(): [isPresent: boolean, release: () => void]`
- `element.ts`:
  - `useFlareElement(o: FlareElementOptions, p: ElementPlatform): FlareElementHandle`, where
  - `FlareElementOptions = { enter?: PresetRef; exit?: PresetRef; press?: PresetRef; exitOn?: 'press' | 'never'; holdSpace?: boolean; progress?: ProgressSource; reduceMotion?: 'system' | 'always' | 'never'; onEntered?(): void; onExited?(finished: boolean): void; onFx?(e: FxEvent): void }`
  - `ElementPlatform = { driver: LiveDriver | null; target: FxTarget | null; size(): { w: number; h: number } | null }`
  - `FlareElementHandle = { phase: 'entering' | 'present' | 'exiting' | 'released'; holdSpace: boolean; onPressIn(point: Vec2Out | null): void; onPressOut(): void; play(ref: PresetRef): Promise<boolean>; prepare(): Promise<boolean> }`

**Rules to implement** (spec §6.4, C21-C23):
- **Exit with a live preset:** `driver.play(-1)`. When it ends, call `release()`, then `onExited(true)`.
- **Exit with a snapshot preset:**
  - Call `fx.run`. At `onHandoff`, call `release()` (the gap closes), unless `holdSpace` is set.
  - At `onEnd`, call `onExited(true)`. With `holdSpace`, also release then.
- **Re-present during a live exit:** `driver.reverse()`, then `onExited(false)`.
- **Re-present during a snapshot exit:**
  - Before handoff: `run.cancel()` returns true, the element stays, `onExited(false)`.
  - After handoff: the key is already released, so the new instance enters.
- **No FX runtime, or reduced motion applies:** play `liveFallbackOf(preset)` live and warn once in
  development (`process.env.NODE_ENV !== 'production'`).
- **`measure` gives null or zero size:** call `release()` and `onExited(true)` at once, with no
  capture.
- **A timeline** (`FlareTimeline`):
  - `compileLive(liveEntries(tl))` plays through the driver up to the snapshot entry's `start`.
  - When the driver reaches that time (`onEnd`), `fx.run` starts, so the capture includes the
    final live pose.
  - Without a snapshot entry, the whole timeline is live.
- **`onFallback` from a run** plays `liveFallbackOf(preset)` through the driver, and the exit then
  completes as a live exit.
- **`exitOn: 'press'` with a snapshot exit** calls `prepare()` (measure plus capture) at
  `onPressIn` (C35).
  - The run on release reuses that capture.
  - A release before the capture lands waits for it, with the live view still shown.
  - A press-out without a release (a cancelled press) discards the capture.
- **An exiting element takes no touches (C40).**
  - `phase` is `'exiting'` from the render that starts the exit until `release()` runs.
  - For that time the wrappers (Tasks 13 and 15) turn off hit-testing, so a touch goes to whatever
    reflows into the element's place.
- **An ancestor unmount ends the exit at once (C40).**
  - This applies while the tree still owns the exit: a live exit, or a snapshot exit before
    handoff.
  - The driver is disposed and the run is cancelled. Nothing draws, and `onExited(true)` fires.
  - A snapshot exit past handoff has already released its element. Its overlay plays on, and
    `onExited(true)` fires at its end as usual.
- **`onExited` fires exactly once per exit.** An `onEnd` that arrives after the unmount has already
  reported is ignored.

- [ ] **Step 1: write the failing tests.** They render with `tests/support/dom.ts`, against a
  `FakeDriver` and `FakeFxRuntime` that record calls and expose `end(finished)` and `handoff()`.

```ts
test('enter plays on mount, onEntered after end', ...)            // driver.play(dir 1); fake.end(true) → onEntered once
test('live exit keeps child until end', ...)                       // remove child → still in DOM; end(true) → gone; onExited(true)
test('re-adding during live exit reverses', ...)                    // driver.reverse called; onExited(false); child stays
test('snapshot exit releases at handoff, onExited at end', ...)    // handoff() → child gone, onExited not yet; end(true) → onExited(true)
test('holdSpace keeps placeholder until end', ...)
test('cancel before handoff restores element', ...)                 // re-add before handoff → run.cancel()===true; child stays; onExited(false)
test('same key returns after handoff enters fresh', ...)            // Review Focus 2: new instance driver.play(1); old run not cancelled; 1 child in DOM
test('capture resolves after unmount: nothing drawn, no throw', ...)// Review Focus 1: ancestor unmounts mid-capture → onExited(true) at once; the capture lands later: run never mounts; hidden.value stays 0; onExited not called again
test('ancestor unmount ends a live exit at once', ...)             // C40: unmount mid-exit → driver.dispose; onExited(true) once; a later fake end(true) is ignored
test('ancestor unmount after handoff leaves the overlay running', ...) // C40: run not cancelled; onExited(true) only at fake end(true)
test('phase is exiting from the removing render until release', ...) // C40: the wrappers read it to turn off hit-testing
test('zero-size or null measure exits immediately', ...)            // Review Focus 3: no fx.run; onExited(true)
test('no fx runtime → live fallback + one warning', ...)
test('reduced motion system=true → fallback; never → snapshot', ...)
test('external progress is passed to driver and fx', ...)
test('exitOn press plays exit then onExited', ...)
test('timeline: live entries then fx.run at the snapshot start', ...) // sequence(fade(0.7, 0.06), disintegrate()) → driver.play then fx.run after driver end
test('onFallback mid-capture plays the live fallback', ...)
test('exitOn press captures at press-in and reuses it on release', ...) // C35: target.capture called once, at onPressIn
test('cancelled press discards the prepared capture', ...)
```

- [ ] **Step 2:** run `bun test packages/ui-fx/tests/runtime/element.test.tsx`. **Expected:** FAIL.
- [ ] **Step 3:** implement the state machine in `element.ts` with phases
  `entering → present → exiting → released`. Transitions are driven only by driver and run callbacks,
  never by timers.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add presence and element lifecycle runtime`.

### Task 11: reduced motion and accessibility hiding (UIFX-11)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 10.

**Files:**
- Create: `src/runtime/reduced-motion.ts`, `src/native/reduced-motion.ts`, `src/native/a11y.ts`,
  `src/web/reduced-motion.ts`
- Test: `tests/runtime/reduced-motion.test.ts`, `tests/native/reduced-motion.test.ts`,
  `tests/web/reduced-motion.test.ts`

**Interfaces:**
- **Produces:**
  - `interface ReducedMotionSource { get(): boolean; subscribe(cb: (v: boolean) => void): () => void }`
  - `effectiveReduced(mode: 'system' | 'always' | 'never', src: ReducedMotionSource): boolean`
  - `nativeReducedMotionSource(manager?: A11yManager): ReducedMotionSource`. It reads
    `AccessibilityInfo.isReduceMotionEnabled()` and listens for `reduceMotionChanged`, and pushes
    changes into `manager.setReducedMotion` when given.
  - `webReducedMotionSource(manager?: A11yManager): ReducedMotionSource`. It calls `matchMedia` lazily
    on the first `get` or `subscribe`.
  - `exitA11yProps(exiting: boolean)`:
    - native: `{ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true }`
      when exiting, `{}` otherwise
    - web: `{ 'aria-hidden': true }`

- [ ] **Step 1: write the failing tests.**
  - `effectiveReduced` truth table.
  - Native: a mocked `AccessibilityInfo` emitting `reduceMotionChanged(true)` updates `get()` and
    calls `manager.setReducedMotion(true)`.
  - Web: importing `src/web/reduced-motion.ts` with `globalThis.window` undefined does not throw (C19).
  - A `matchMedia` change event updates subscribers.
  - An exiting element in a Task 10 harness gets `aria-hidden`.
  - A focused element that starts a snapshot exit moves focus first:
    - on the web, to the next focusable sibling or `document.body`
    - on native, `AccessibilityInfo.setAccessibilityFocus` on the parent
    - focus moves before `hidden` is set
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement, and wire `effectiveReduced` into `element.ts`.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add live reduced-motion sources and exit a11y`.

### Task 12: list presence hook and toast store (UIFX-12)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 10.

**Files:**
- Create: `src/runtime/list-presence.ts`, `src/runtime/toast-store.ts`
- Test: `tests/runtime/list-presence.test.tsx`, `tests/runtime/toast-store.test.ts`

**Interfaces:**
- **Produces, list presence:**
  - `useFlarePresenceList<T>(data: readonly T[], keyOf: (t: T) => string, o?: { animateInitial?: boolean }): readonly PresenceEntry<T>[]`
  - `PresenceEntry<T> = { key: string; item: T; phase: 'enter' | 'idle' | 'exit'; release(): void }`
- **Produces, toast store:**
  - `createToastStore(): ToastStore`, where
    `ToastStore = { show(message: ReactNode, o?: ToastOptions): string; dismiss(id?: string): void; subscribe(cb: () => void): () => void; snapshot(): readonly ToastRecord[] }`
  - `ToastOptions = { id?: string; duration?: number; enter?: PresetRef; exit?: PresetRef; queue?: 'reset' | 'standby' | 'next' | 'immediate' }`
  - `toast(message, o?)` and `toast.dismiss(id?)`, bound to a lazily created default store.

- [ ] **Step 1: write the failing tests.**
  - **List presence:**
    - The initial data gives phase `idle` (or `enter` with `animateInitial`).
    - An appended key gets `enter`.
    - A removed key stays in place with `exit` until `release()`.
    - A removed key re-added before `release` returns to `enter`, with a single entry (Review
      Focus 2).
    - Order is preserved around exiting entries.
  - **Toast store:**
    - `show` returns ids.
    - `reset` clears the queue; `next` inserts at the front; `standby` appends; `immediate` makes the
      toast current.
    - `dismiss()` with no id dismisses all.
    - Importing the module does not touch `window` (C19).
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add list presence and toast store`.

---

## Phase 3: native live (Android verified, iOS deferred)

### Task 13: native live driver and RN wrappers (UIFX-13)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 11, 12, 0.5.

**Files:**
- Create: `src/native/live-driver.ts`, `src/rn/{provider.tsx,create-flare-component.tsx,wrappers.tsx,use-flare-fx.ts}`,
  `src/index.ts` exports, `tests/support/{mock-rn.ts,mock-reanimated.ts}`
- Test: `tests/native/live-driver.test.tsx`, `tests/rn/wrappers.test.tsx`

**Interfaces:**
- **Consumes:** `useFlareElement` (Task 10), `compileLive` and `livePoseAtInto` (Task 8),
  `nativeReducedMotionSource` (Task 11).
- **Produces:**
  - The native style always emits the full transform list
    `[{ perspective }, { translateX }, { translateY }, { rotateX }, { rotateY }, { rotate }, { scale }]`,
    with perspective 100000 when `uses3d` is false. The array shape never changes between frames or
    presets.
  - `useNativeLiveDriver(): { driver: LiveDriver; style: AnimatedStyle }`. Shared values:
    - `t`, advanced with `withTiming(duration, { duration: duration·1000, easing: Easing.linear }, cb)`
    - `dir`, `pressT`, `hidden`
    - The style worklet calls `livePoseAtInto`. With `progress`, `t = progress.value·duration`.
  - `FlareProvider({ children, registry?, reducedMotion?, rtl? })`, which renders the overlay portal
    layer (absolute fill, `pointerEvents="box-none"`).
  - `createFlareComponent<P>(C: ComponentType<P>): ComponentType<P & FlareElementOptions>`. `C` must
    pass `ref` to a host view; Reanimated's `createAnimatedComponent` is applied once, at module scope.
  - `FlareView`, `FlareText`, `FlareImage`, `FlarePressable`, and
    `FlareButton({ label?, children?, onPress?, ...FlareElementOptions })`, which wraps `Pressable`.
  - Press origin: `FlareView` reads it from `onTouchStart` (`locationX/Y`); `FlarePressable` and
    `FlareButton` read it from `onPressIn`.
  - `useFlareFx(): { ref: RefObject<View>; play(p: PresetRef): Promise<boolean>; prepare(): Promise<boolean> }`
  - On `Platform.OS === 'web'`, the components use `createWebLiveDriver(node)` from Task 14, through a
    `driverFor(node)` seam that this task stubs to the native driver.

- [ ] **Step 1: write the failing tests.** Mocks:
  - Reanimated: `useSharedValue` returns `{ value }`; `withTiming` records its arguments and
    synchronously calls back on `flush()`; `useAnimatedStyle` evaluates the worklet once per render
    and on demand.
  - RN: `View`, `Text`, `Image`, `Pressable` become DOM `div` / `span` / `img` / `div`, forwarding
    `onPressIn`, `onTouchStart` and `style`.

  Tests:
  - A `FlareView enter={fade()}` style at t = 0 has `opacity: 0`; after flush it has `opacity: 1`.
  - `FlareButton exitOn="press"` press → exit plays → `onExited(true)`. The press origin passed to the
    runtime equals `locationX/Y`.
  - `hidden.value = 1` yields `opacity: 0` in the same style evaluation.
  - `pressT` drives scale 0.96 while pressed.
  - While its `phase` is `'exiting'`, a `FlareView` renders `pointerEvents="none"`, and it drops
    that again if it re-presents (C40).
  - `createFlareComponent(Custom)` forwards `ref` to the host and passes props through.
  - No `TouchableWithoutFeedback` is imported anywhere: grep `src/` in the test.
  - `FlareProvider` renders an overlay layer that children can portal into.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** do a manual Android run in the spike app against a `bun pack` tarball. Record a
  screen capture in the PR.
- [ ] **Step 6:** commit `feat(ui-fx): add native live driver and RN wrappers`.

---

## Phase 4: web live (react-native-web and DOM)

### Task 14: WAAPI live driver and react-native-web branch (UIFX-14)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 13, 0.4.

**Files:**
- Create: `src/web/live-driver.ts`, `src/web/flip.ts`
- Modify: `src/rn/create-flare-component.tsx` (the `driverFor` web branch)
- Test: `tests/web/live-driver.test.ts`, `tests/rn/web-branch.test.tsx`

**Interfaces:**
- **Produces:**
  - `createWebLiveDriver(el: HTMLElement): LiveDriver`
  - `poseRowsToKeyframes(rows: Float32Array, count: number): { transform: Keyframe[]; paint: Keyframe[] }`
    - `transform` keyframes are `{ transform: 'translate(Xpx, Ypx) rotate(Rdeg) scale(S)' }`, played
      with `composite: 'add'`.
    - When `uses3d` is true, every keyframe instead uses
      `perspective(Ppx) translate(Xpx, Ypx) rotateX(Adeg) rotateY(Bdeg) rotate(Rdeg) scale(S)`. The
      function list stays the same across all keyframes of one animation.
    - `paint` keyframes are `{ opacity, filter: 'brightness(B)' }`, played with
      `composite: 'replace'`. The `filter` is present only for emerge.
    - Both use `{ duration: ms, fill: 'both', easing: 'linear' }`.
  - `flipReflow(container: HTMLElement, before: Map<Element, DOMRect>, duration: number): void`, used by
    Task 24.

- [ ] **Step 1: write the failing tests.** A fake `Element.animate` returns
  `{ currentTime, playbackRate, finished: Promise, cancel(), reverse(), pause() }`.
  - `play(fade, 1)` calls `animate` twice with the expected keyframe count (16 for 0.25 s at 60 fps)
    and options.
  - `onEnd(true)` fires after both animations finish.
  - `reverse()` calls `reverse()` on both.
  - `cancel()` pauses both, then calls `onEnd(false)`.
  - `hidden.value = 1` plus `hideSync()` sets `style.visibility = 'hidden'`.
  - External progress sets `currentTime = progress·duration` per rAF while paused.
  - On RNW (`Platform.OS = 'web'`), `FlareView` uses the web driver and never calls Reanimated's
    `useAnimatedStyle` for the pose.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add WAAPI live driver for the web`.

### Task 15: `./dom` entry, React DOM wrappers (UIFX-15)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 14.

**Files:**
- Create: `src/dom/{provider.tsx,create-flare-component.tsx,wrappers.tsx,use-flare-fx.ts}`; modify
  `src/dom.ts`
- Test: `tests/dom/wrappers.test.tsx`

**Interfaces:**
- **Produces:**
  - `FlareProvider` (DOM). The overlay portal is `document.body`, and the reduced-motion source is
    `webReducedMotionSource`.
  - `createFlareComponent<T extends keyof JSX.IntrinsicElements | ComponentType<any-free props with ref>>(tagOrC)`
  - `FlareDiv`, `FlareSpan`, `FlareButton`, `FlareImg`, `FlareLi`
  - `useFlareFx()` (DOM)
  - The press origin comes from `pointerdown` `offsetX/Y` relative to the element's
    `getBoundingClientRect()`.

- [ ] **Step 1: write the failing tests.**
  - A `FlareDiv enter={slide({ from: 'right' })}` mount calls `animate` with a first transform
    keyframe of `translate(48px, 0px) rotate(0deg) scale(1)`.
  - A `FlareButton exitOn="press"` pointerdown at (10, 5) passes press (10, 5) to the runtime.
  - An exiting `FlareDiv` has `pointer-events: none` until it is released or re-presents (C40).
  - `createFlareComponent('section')` renders a `<section>` and forwards `ref`.
  - Importing `src/dom.ts` loads no `react-native` module: a `mock.module('react-native')` that
    throws is never triggered.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add React DOM entry and wrappers`.

---

## Phase 5: snapshot effects

### Task 16: native FX host and capture (`./fx`, react-native build) (UIFX-16)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 13, 6, 0.2, 0.3.

**Files:**
- Create: `src/fx/native/{host.tsx,capture.ts,pool.ts,display-mode.ts}`; modify `src/fx.native.ts`
- Create the C39 module: `android/` (Kotlin) and `expo-module.config.json`. Add both to `files`.
- Test: `tests/fx/native/{host,pool,display-mode}.test.tsx`, `tests/support/mock-skia.ts`

**Interfaces:**
- **Produces:**
  - `FlareFxHost({ children, android?: { surfaceType?: 'TextureView' | 'SurfaceView'; zOrderOnTop?: boolean } })`.
    - It renders children plus one absolute-fill `<Canvas pointerEvents="none">`, and provides
      `FxRuntime` and `hostFactory` through `FlareContext`.
    - It mounts the sprite pool's `<Atlas>` once, for its whole life.
  - `captureView(ref: RefObject<View>, maxPx: number, padding: number): Promise<FxImage | null>`.
    - It wraps `makeImageFromView`, downscales captures over `maxPx` (Review Focus 5), and returns
      `null` on a rejection.
    - **Padding is mandatory on native (C36).** G1 showed that `elevation` and `boxShadow` draw
      outside the element's bounds, so every capture goes through an outer host padded by `padding`
      px.
    - `FxImage` gains `padding` (px), and layers offset the drawing by it.
  - **Sprite pool, `createSpritePool(capacity: number)` with capacity 4,096 (C38).**
    - Why a pool: on the Pixel 7 in G2, a keyed `<Atlas>` mounted per effect dropped a frame every
      few mounts, and the pool dropped none.
    - Idle sprites sit at zero scale.
    - `claim(count): number` returns the first index of a free contiguous range, or -1.
      `free(start, count)` hands the range back when the run ends.
    - A run starts by writing its start time to its range's shared value. The RSXform worklet
      computes poses from that time, so starting an effect mounts nothing.
    - If a claim fails because concurrent runs need more than 4,096 sprites, the run plays its live
      fallback through `onFallback` and warns once in development.
    - Grains (Task 19) and dust's front grains (Task 20) draw from the pool. Shards (Task 18) mount
      a `<Vertices>` layer per run instead (C43).
  - `interface EffectLayerProps { run: NativeRunState; onFirstFrame(): void; onDone(finished: boolean): void }`
    for the layers that do mount per run: shards, and dust's shader rect.
  - **Display mode, `acquireFastDisplayMode(): () => void` (C39).**
    - Why: on Android 15 and later the OS picks the render rate. An overlay that moves only Skia
      content ran at 30–60 Hz on the Pixel 7.
    - It is reference-counted. The first acquire sets the window's `preferredDisplayModeId` to the
      panel's fastest mode, and the last release clears it. The host acquires at a run's first
      frame and releases at its end.
    - The native side is an Expo module (Kotlin, about 5 lines of window code), and
      `expo-modules-core` becomes an optional peer. A config plugin on its own could only request
      the mode for the app's whole life.
    - Without the module (no Expo modules, or Expo Go) it is a no-op and warns once in development
      that effects may run at 30–60 Hz on Android 15+. On iOS and the web it is a no-op.
    - **The owner chose the module on 2026-11-20.** C39 left the choice between a config plugin and
      a module open. The module wins because it can clear the request when the last effect ends.
  - **Handoff:** the layer's first-frame worklet sets `target.hidden.value = 1` on the same UI frame
    it first draws.
  - **`FxRun.cancel()` follows JS, not the UI thread.**
    - It returns `false` only once `onHandoff` has been delivered on JS.
    - The UI thread hides the target before that callback arrives. A `cancel()` in that gap still
      returns `true`. It sets `hidden.value` back to 0, unmounts the layer and ends with
      `onEnd(false)`, and `onHandoff` never fires.
    - Why: `useFlareElement` reads `cancel() === false` as "the overlay has taken over" (#494). It
      tolerates the other order, but this keeps the cancel path exact.

- [ ] **Step 1: write the failing tests.** Mock Skia: `Canvas`, `Atlas`, `Image`, `Group`,
  `makeImageFromView` and `Skia.Surface.Make` record props and calls.
  - `run` order: `measure` → `capture(2048)` → layer mounts → first frame → `onHandoff` and
    `hidden.value === 1` in the same tick → `onDone` → `onEnd(true)` and the layer unmounts.
  - `capture` resolving after the target unmounts: no layer mounts, `onEnd(false)` (Review Focus 1).
  - A 1080×1920 capture at pixel ratio 3 is downscaled so its longest side is ≤ 2048 (Review Focus 5).
  - `makeImageFromView` rejecting calls `onFallback` once and never `onHandoff`.
  - A `cancel()` after the first-frame worklet hid the target, but before `onHandoff` reached JS:
    - returns `true`;
    - sets `hidden.value` back to 0;
    - unmounts the layer and ends with `onEnd(false)`;
    - never calls `onHandoff`.
  - A `cancel()` after `onHandoff` returns `false` and leaves the run playing.
  - The host sets `collapsable={false}` on the capture root.
  - The capture goes through the padded outer host, and `FxImage.padding` equals the padding.
  - **Pool:**
    - The mock sees one `<Atlas>` mount for the host's life, with 4,096 sprites, across several
      runs.
    - Two concurrent runs claim disjoint ranges.
    - Sprites outside every claimed range have scale 0.
    - A range is free again after its run's `onEnd`.
    - A claim beyond the free sprites calls `onFallback` once and warns once.
  - **Display mode:**
    - For two overlapping runs, the module's set is called once and its clear once, after both end.
    - A missing module neither throws nor warns more than once.
  - The root entry `src/index.ts` still imports no Skia (re-run the entries test).
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** do a manual Android run in the spike app with `min_refresh_rate` unpinned.
  - **Expected:** the render rate reads 90 Hz while an effect plays, as in G2, and the request is
    cleared after it.
  - Ask the owner not to touch the phone during the run; a touch raises the rate on its own.
- [ ] **Step 6:** commit `feat(ui-fx): add native FX host and view capture`.

### Task 17: web FX host, capture seam and CanvasKit runtime (UIFX-17)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 15, 6, 0.4.

**Files:**
- Create: `src/web/{capture.ts,kit.ts,fx-runtime.ts,atlas.ts}`, `src/fx/web/host.tsx`
- Modify: `src/fx.web.ts`, `src/dom.ts` (re-export `FlareFxHost`)
- Test: `tests/web/*.test.ts`, `tests/support/mock-kit.ts` (modelled on
  `packages/render-web/tests/support/mock-kit.ts`)

**Interfaces:**
- **Produces, capture:**
  - `type WebRasterizer = (el: HTMLElement, pixelRatio: number) => Promise<HTMLCanvasElement | ImageBitmap | null>`
  - `setWebRasterizer(r: WebRasterizer | null): void`
  - `modernScreenshotRasterizer(): Promise<WebRasterizer>` (a dynamic `import('modern-screenshot')`).
    It captures with padding p (C36):
    `domToCanvas(el, { scale, width: w + 2p, height: h + 2p, style: { margin: p + 'px' } })`.
  - **Full binary required (C37).** The host's default `wasmUrl` documentation names
    `canvaskit-wasm/bin/full/canvaskit.wasm`. A non-`Error` rejection from `loadCanvasKit` (the
    bare `Infinity` of a mismatched binary, #422) calls `onFallback` with a development-only warning
    naming that file.
- **Produces, CanvasKit source:**
  - `resolveCanvasKit(o: { canvasKit?: CanvasKit; wasmUrl?: string }): Promise<CanvasKit>`. The order is
    the prop, then `globalThis.CanvasKit`, then `loadCanvasKit(wasmUrl)`.
- **Produces, runtime:**
  - `createWebFxRuntime(o: { kit: () => Promise<CanvasKit>; canvas: HTMLCanvasElement }): FxRuntime & { dispose(): void }`
  - `createAtlasPool(kit, capacity: number): { srcs: Float32Array; xforms: Float32Array; colors: Uint32Array }`
    (allocated once per capacity tier and reused)
- **Produces, host:**
  - `FlareFxHost({ children, canvasKit?, wasmUrl? })` (web). It portals a
    `<canvas style="position:fixed;inset:0;pointer-events:none">` into `document.body`, sized to
    `innerWidth·dpr`.
  - Context loss: listen for `webglcontextlost` and `webglcontextrestored`, as in
    `packages/render-web/src/postfx-surface.ts`.
  - **Handoff:** inside the rAF callback, draw frame 1, call `surface.flush()`, then
    `target.hideSync()`, then `onHandoff`.
    - All of it runs in one JS callback, so the cancel gap from Task 16 can't occur on the web.
    - `cancel()` returns `false` exactly once `onHandoff` has been called, the same contract as
      Task 16.

- [ ] **Step 1: write the failing tests.**
  - The kit-resolution order holds; `loadCanvasKit` is not called when `globalThis.CanvasKit` exists.
  - Exactly one canvas is appended to `body`, with `pointer-events: none`.
  - Within one rAF callback the order is `flush` → `hideSync` → `onHandoff`.
  - The same `Float32Array` instances are passed to `drawAtlas` on frames 2 and 3, so nothing is
    allocated per frame.
  - With no rasterizer set, `run` calls `onFallback` and warns once (Review Focus 4).
  - A rasterizer throwing `SecurityError` calls `onFallback`, warns once and does not throw.
  - A rejected `loadCanvasKit` calls `onFallback`.
  - `webglcontextlost` mid-run gives `onEnd(false)` and the canvas is cleared.
  - An idle host schedules no rAF.
  - A capture over 2048 px is downscaled (Review Focus 5).
  - Capture resolving after unmount draws nothing (Review Focus 1).
  - The padded capture is drawn offset by −p, so the element's box lands exactly on its measured
    rect.
  - `loadCanvasKit` rejecting with the number `Infinity` calls `onFallback`, and the warning names
    `bin/full/canvaskit.wasm`.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add web FX host on CanvasKit`.

### Task 18: shatter, native and web (UIFX-18)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 16, 17, 5.

**Files:**
- Create: `src/fx/native/layers/shatter.tsx`, `src/fx/web/{bake.ts,effects/shatter.ts}`. There is
  no native `bake.ts` (C43).
- Test: `tests/fx/native/shatter.test.tsx`, `tests/web/shatter.test.ts`

**The mesh decides how a run draws (C43), whatever the preset is called:**
- **Shards.** A mesh with `rectangular === false` comes from `triangles`, `jittered-grid` or
  `radial-glass` (shatter's default). On native it draws with `<Vertices>`, in this task.
- **Grains.** A mesh with `rectangular === true` comes from `grid` or `cells` (disintegrate's
  default). On native it draws from the Task 16 pool, in Task 19.
- **Why the mesh and not the preset name:** without a bake, the pool's `<Atlas>` can draw only
  rectangular source cells. So `disintegrate`'s default `cells` uses the pool, and
  `disintegrate({ pattern: 'triangles' })` uses `<Vertices>`.

**Native shards: `<Vertices>` straight from the capture, with no bake (C43):**
- **Built once per run.** Each piece of n vertices is a triangle fan of n − 2 triangles.
  - `textures` hold each vertex at its capture pixel position, padding included.
  - `indices` hold the fans.
- **Drawing.** `<Vertices mode="triangles" textures indices colors blendMode="multiply">` with an
  `<ImageShader image={capture}>` child.
- **Measured in G3:** 300 shards (1,200 vertices) took 1.24–1.36 ms per UI frame at 90 Hz, with no
  slow frames.
- **Positions:** a `useDerivedValue` returns a fresh array of plain `{ x, y }` points each frame
  (the Code rules exception). Each point comes from
  `shardVertexInto(pose: FragmentPose, cx: number, cy: number, vx: number, vy: number, out: { x: number; y: number }): void`
  (worklet). It rotates and scales the vertex `(vx, vy)` about the piece centroid `(cx, cy)`, then
  moves the centroid to the pose:

```
dx = vx − cx;  dy = vy − cy;  c = pose.scale·cos(rot);  s = pose.scale·sin(rot)
out.x = pose.x + c·dx − s·dy
out.y = pose.y + s·dx + c·dy
```

- **Per-shard fade:**
  - Per-vertex `colors` from a reused pool of `Float32Array(4)`, which RN-Skia passes through
    unconverted. G3 measured 0.41 ms p50 per frame at 300 shards.
  - **`blendMode="multiply"` is required.** With an `<ImageShader>` child, `modulate`, `dstIn`,
    `srcIn` and the default `dstOver` draw nothing.
  - A whole-layer fade is `opacity` on `<Vertices>`.
- **Not measured in G3:** what it costs to mount a `<Vertices>` layer per run. Step 5 checks for a
  dropped frame at the start of a run.

**Web shards keep the atlas route.** C43 covers native only, and the web path has not been
measured:
- `bakeShardAtlas(image: FxImage, mesh: FractureMesh, packing: ShardPacking): unknown` (web only) is
  a CanvasKit surface, with each piece drawn clipped by its polygon path into its packed rect.
- `shardXformInto(pose: FragmentPose, rectW: number, rectH: number, cx: number, cy: number, scale: number, out: Float32Array, o: number): void`
  rotates about the shard centroid `(cx, cy)` inside its source rect. Task 19 reuses it on both
  backends for grains.

```
scos = pose.scale·scale·cos(rot);  ssin = pose.scale·scale·sin(rot)
out[o] = scos; out[o+1] = ssin
out[o+2] = pose.x − (scos·cx − ssin·cy)
out[o+3] = pose.y − (ssin·cx + scos·cy)
```

- **Web per-piece alpha** goes into `colors` as `(alpha·255)<<24 | 0xffffff`, with
  **`BlendMode.Modulate` passed explicitly**, because CanvasKit defaults to `SrcOver` (spec §2.4).
- `reverse` runs assemble-in from an off-window capture (spec §6.4).

- [ ] **Step 1: write the failing tests.**
  - **Routing:**
    - `shatter()` mounts a `<Vertices>` layer on native.
    - `shatter({ pattern: 'grid' })` claims pool sprites instead.
    - `disintegrate({ pattern: 'triangles' })` mounts a `<Vertices>` layer.
  - **Native:**
    - The vertex count is the sum of the piece vertex counts, and the index count is
      Σ 3·(n − 2).
    - At t = 0 every vertex is at its home position in the element's measured rect, and its texture
      coordinate is that same point in the capture (pixel ratio and padding applied), so the card is
      seamless at rest.
    - With `rotation = π/2`, the centroid maps to `(pose.x, pose.y)` and a vertex at `(cx + 1, cy)`
      maps to `(pose.x, pose.y + pose.scale)`, within 1e-6.
    - The blend mode passed is `multiply`.
    - The colour arrays on frames 2 and 3 are the same `Float32Array` instances.
    - `Skia.Surface.Make` is never called.
  - **Web:**
    - The transform and sprite counts equal the shard count.
    - With `rotation = π/2`, the transformed centroid equals `(pose.x, pose.y)` within 1e-6.
    - An alpha of 0.5 gives a colour of `0x7fffffff`.
    - The blend mode passed is Modulate.
    - Draw buffers on frames 2 and 3 are the same instances.
  - **Both backends:** enter with `reverse 'home'` ends with every piece at home, and the live
    element is revealed on the final frame (`hidden.value === 0`).
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** do a manual run on Android and Chrome. Attach captures to the PR. On Android,
  record frame times around the start of a 300-shard run, to show whether the per-run `<Vertices>`
  mount drops a frame.
- [ ] **Step 6:** commit `feat(ui-fx): add shatter on native and web`.

### Task 19: disintegrate grains, native and web (UIFX-19)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 18.

**Files:**
- Create: `src/fx/native/layers/grains.tsx`, `src/fx/web/effects/grains.ts`
- Test: `tests/fx/native/grains.test.tsx`, `tests/web/grains.test.ts`

- This layer draws every rectangular mesh (Task 18's routing), not only `disintegrate`.
- Cells come straight from the capture: each `src` rect is a grid cell, so no bake is needed.
- The motion and transforms reuse Task 18's `shardXformInto`, with the centroid at the cell centre.
- **Native draws from the Task 16 sprite pool (C38) and mounts no layer.**
  - A run claims one sprite per cell and writes its start time to its range's shared value.
  - It frees the range at its end.
  - Colours go through `<Atlas colors>` with `BlendMode.Modulate` passed explicitly, because native
    defaults to `dstOver`.
  - G2 measured 3,000 coloured sprites holding 60 Hz on the Pixel 7. At 90 Hz, Bundle Mode holds
    3,000 coloured sprites and Legacy Eval holds 3,000 uncoloured ones (spec §11).
- **Web** draws through Task 17's `createAtlasPool`, as before.

- [ ] **Step 1: write the failing tests.**
  - A 360×64 element at 3x with `cell 4` and `maxFragments 3000` gives at most 3,000 sprites, with the
    cell raised (Review Focus 5).
  - A `sweep` release at angle 90 gives the leftmost cells the smallest delays.
  - Alpha fades through `colors` with Modulate.
  - On native, a 3,000-cell run claims 3,000 pool sprites, mounts no `<Atlas>` of its own, and
    leaves the range free after `onEnd`.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add disintegrate grains on native and web`.

### Task 20: dust shader, native and web (UIFX-20)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 17, 16.

**Files:**
- Create: `src/core/sksl.ts`, `src/fx/native/layers/dust.tsx`, `src/fx/web/effects/dust.ts`
- Test: `tests/core/sksl.test.ts`, `tests/fx/native/dust.test.tsx`, `tests/web/dust.test.ts`

**Interfaces:**
- **Produces:**
  - `DUST_SKSL: string`
  - `DUST_UNIFORMS = ['u_progress', 'u_dir', 'u_softness', 'u_noiseScale', 'u_noiseAmount', 'u_edgeWidth', 'u_edgeColor', 'u_size', 'u_spread', 'u_seed'] as const`
  - `packDustUniformsInto(p: DustPreset, progress: number, w: number, h: number, out: Float32Array): Float32Array`
- **Native:** a `<Rect>` enlarged by `spread` on every side, filled by `<Shader source uniforms>` with an
  `<ImageShader>` child, **never** the `RuntimeShader` image filter (spec §3.3).
- **Web:** `kit.RuntimeEffect.Make(DUST_SKSL)`, then
  `makeShaderWithChildren(uniforms, [imageShader])` drawn with `drawRect`.

```glsl
uniform shader image; uniform float u_progress; uniform float2 u_dir; uniform float u_softness;
uniform float u_noiseScale; uniform float u_noiseAmount; uniform float u_edgeWidth;
uniform half4 u_edgeColor; uniform float2 u_size; uniform float u_spread; uniform float u_seed;
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233)) + u_seed) * 43758.5453); }
float vnoise(float2 p) { float2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+float2(1,0)), f.x), mix(hash(i+float2(0,1)), hash(i+float2(1,1)), f.x), f.y); }
half4 main(float2 xy) {
  float2 uv0 = (xy - u_spread) / u_size;
  float sweep = dot(uv0 - 0.5, u_dir) + 0.5;
  float field = mix(sweep, vnoise(uv0 * u_noiseScale), u_noiseAmount);
  float edge = u_progress * (1.0 + u_softness) - u_softness;
  float gone = smoothstep(edge, edge + u_softness, field);      // 1 = still solid
  float2 drift = u_dir * u_spread * (1.0 - gone) * u_progress;   // grains drift along the sweep
  half4 c = image.eval(xy - u_spread - drift);
  half rim = half(1.0 - smoothstep(0.0, u_edgeWidth, abs(field - edge)));
  return half4(c.rgb + u_edgeColor.rgb * rim * c.a, c.a) * half(gone);
}
```

- [ ] **Step 1: write the failing tests.**
  - The packed uniforms follow the `DUST_UNIFORMS` order.
  - `u_dir` is `directionInto(sweepAngle)`.
  - The enlarged rect equals the element rect expanded by `spread`.
  - The native mock never sees a `RuntimeShader` node.
  - The web mock compiles `DUST_SKSL` without errors (the mock records `Make` returning non-null).
  - `grainsAtFront > 0` adds grains with a `sweep` release. On native they are claimed from the
    Task 16 pool, not mounted as a layer (C38).
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS. Do a manual compile on device and in Chrome.
- [ ] **Step 5:** commit `feat(ui-fx): add dust dissolve shader on native and web`.

### Task 21: live emerge (UIFX-21)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p3`. **Depends on:** 14, 15, 0.5.

**Files:**
- Modify: `src/native/live-driver.ts`, `src/web/live-driver.ts`, `src/rn/wrappers.tsx`,
  `src/dom/wrappers.tsx`
- Test: extend `tests/native/live-driver.test.tsx` and `tests/web/live-driver.test.ts`

- The wrappers render a **shadow overlay child** (absolute fill, `pointerEvents` none) only when the
  current preset is `emerge`.
  - **Native: no gradient (G5 failed on Android).**
    - Through `useAnimatedStyle`, `experimental_backgroundImage` keeps its first value, while
      `filter: brightness()` animates at 90 Hz, even with the JS thread blocked.
    - So the native live emerge is an overlay opacity ramp, a translate along the angle, and a
      `brightness` darkening.
    - The angled sweep belongs to the shader variant (Task 22).
  - **Web:** register `@property --flare-edge { syntax: '<percentage>'; inherits: false; initial-value: 0% }`
    once (with a `CSS.registerProperty` guard). The overlay background uses `var(--flare-edge)`, and
    WAAPI animates `--flare-edge`.
    - The web half of G5 has not been measured yet. Step 5 checks it.

- [ ] **Step 1: write the failing tests.**
  - An overlay appears only for `emerge`.
  - Native never sets `experimental_backgroundImage`.
  - On native, the overlay opacity follows the pose's `shadowOpacity` and the element's
    `brightness` follows the pose's `brightness`. Both reach rest (0 and 1) at the end.
  - On the web, the gradient angle string equals the preset angle.
  - On the web, `--flare-edge` follows the pose's `shadowEdge`, from 0 to 100% across the run.
  - Without `CSS.registerProperty`, the web falls back to animating overlay opacity.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** do a manual run on Android and in Chrome. In Chrome, check that `--flare-edge`
  animates the gradient and isn't stuck at its first value (the web half of G5). Record both in the
  PR.
- [ ] **Step 6:** commit `feat(ui-fx): add live emerge-from-shadow`.

### Task 22: shader emerge, native and web (UIFX-22)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p3`. **Depends on:** 20.

**Files:**
- Modify: `src/core/sksl.ts` (`EMERGE_SKSL`, `EMERGE_UNIFORMS`, `packEmergeUniformsInto`)
- Create: `src/fx/native/layers/emerge.tsx`, `src/fx/web/effects/emerge.ts`
- Test: extend the dust tests' files with `emerge` cases

**Shader** (spec §7.4):

```
s = dot(uv − 0.5, dir)/extent + 0.5, where extent = |w·cosA| + |h·sinA| normalised
mask = smoothstep(edge, edge + softness, 1 − s), shaped by falloff
lit = mask lagged by shadow.lag
rgb = mix(src·(1 − shadow.opacity), src, lit)
long shadow = N taps (N = length/2, at most 24) of src.a offset along −dir, at shadow.opacity·falloff
sheen = an additive band of width w at s = progress − delay
```

- [ ] **Step 1: write the failing tests.** Each parameter changes exactly its uniform; the long-shadow
  tap count is capped at 24; the shader compiles on both mocks.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add shader emerge-from-shadow`.

### Task 22a: `flip` preset, 3D, native and web (UIFX-22A)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 14, 15.

**Files:**
- Modify: `src/core/presets.ts` (`FlipPreset`, `flip()`), `src/core/live.ts` (flip compile and pose),
  `src/rn/create-flare-component.tsx` and `src/dom/create-flare-component.tsx` (`transformOrigin`)
- Test: extend `tests/core/presets.test.ts`, `tests/core/live.test.ts`,
  `tests/native/live-driver.test.tsx`, `tests/web/live-driver.test.ts`

**Interfaces:**
- **Produces:**
  - `FlipPreset { kind: 'flip'; axis: 'x' | 'y'; angle: number; perspective: number; origin: OriginSpec; fadeAtEdge: boolean }`
  - `flip(opts?)`, with defaults `axis 'y'`, `angle 90`, `perspective 800`, `origin 'center'`,
    `fadeAtEdge true`, `duration 0.45`, `easing 'easeOutCubic'`
  - **Pose:** `rotateYDeg` (or `rotateXDeg`) = angle·(1 − eased) on enter; `perspective` =
    `p.perspective`; with `fadeAtEdge`, opacity = `smoothstep(0, 0.25, cos(rotation))` so the
    edge-on frame is invisible.
  - **Validation:** `angle` in −180..180; `perspective` ≥ 100.

- [ ] **Step 1: write the failing tests.**
  - `flip()` defaults deep-equal the table above.
  - The enter pose at t = 0 gives `rotateYDeg` 90, opacity ≈ 0 and `perspective` 800; at the end,
    0, 1 and 800.
  - `axis 'x'` drives `rotateXDeg` only.
  - The native style keeps the 7-entry transform list for both `flip` and `fade`.
  - The web keyframes include `perspective(800px)` and `rotateY(90deg)` in the first frame, and
    every keyframe has the same function list.
  - `flip({ perspective: 50 })` throws `RangeError`.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** do a manual run on Android (check `cameraDistance` clipping at 90°) and in Chrome.
  Record captures in the PR.
- [ ] **Step 6:** commit `feat(ui-fx): add 3D flip preset`.

### Task 22b: extension points, custom live presets and custom shader effects (UIFX-22B)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 20, 22a.

**Files:**
- Create: `src/core/custom.ts`
- Modify: `src/core/presets.ts` (union kinds `'custom-live' | 'custom-shader'`), `src/core/live.ts`,
  `src/fx/native/layers/custom-shader.tsx`, `src/fx/web/effects/custom-shader.ts`
- Test: `tests/core/custom.test.ts`, `tests/fx/native/custom-shader.test.tsx`,
  `tests/web/custom-shader.test.ts`

**Interfaces:**
- **Produces, custom live:**

```ts
interface LivePresetDefinition<P> {
  duration(params: P): number;
  pack(params: P, out: Float32Array): Float32Array;          // ≤ 16 floats
  pose(t: number, direction: 1 | -1, w: number, h: number, params: Float32Array, out: LivePose): void; // 'worklet'
  defaults: P;
}
```

  - `defineLivePreset<P>(name: string, def: LivePresetDefinition<P>): (opts?: Partial<P> & PresetCommon) => CustomLivePreset`
  - `CustomLivePreset = { kind: 'custom-live'; name: string; def: LivePresetDefinition<unknown>; params: Float32Array }`
  - `compileLive` routes `custom-live` to `def.pose`. Native calls it inside the style worklet; the web
    samples it through `sampleLivePosesInto`.
- **Produces, custom shader:**
  - `shaderEffect(o: { sksl: string; uniforms?: Record<string, number | readonly number[]>; duration?: number; spread?: number; easing?: EasingSpec }): CustomShaderPreset`,
    where `CustomShaderPreset` has kind `'custom-shader'`
  - The required SkSL contract is `uniform shader image; uniform float u_progress; uniform float2 u_size;`.
    Extra uniforms are packed by name in declaration order (`RuntimeEffect.getUniformName(i)`).
  - A compile failure throws `RangeError('ui-fx: shaderEffect SkSL failed: <error text>')` on first
    run, and the element plays its fallback.

- [ ] **Step 1: write the failing tests.**
  - A `wobble` custom live preset (skew-free rotation `sin(t·20)·5`) samples to non-zero
    `rotationDeg` rows on the web.
  - The native style evaluates the custom `pose`.
  - `params` longer than 16 floats throws `RangeError`.
  - A `shaderEffect` with uniforms `{ u_tint: [1, 0, 0, 1] }` packs `u_progress`, `u_size` and
    `u_tint` in declaration order on both mocks.
  - SkSL missing `u_progress` throws the contract error on first run, and the fallback plays.
  - `isSnapshotPreset` is true for `custom-shader` and false for `custom-live`.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS.
- [ ] **Step 5:** commit `feat(ui-fx): add custom live preset and shader effect seams`.

### Task 22c: `iris` preset and `swap()` content transitions (UIFX-22C)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 20, 22a.

**Files:**
- Modify: `src/core/presets.ts` (`IrisPreset`, `iris()`), `src/core/sksl.ts` (`IRIS_SKSL`,
  `IRIS_UNIFORMS`, `packIrisUniformsInto`), `src/runtime/element.ts` (`swap`),
  `src/rn/use-flare-fx.ts`, `src/dom/use-flare-fx.ts`
- Create: `src/fx/native/layers/iris.tsx`, `src/fx/web/effects/iris.ts`
- Test: `tests/core/iris.test.ts`, `tests/runtime/swap.test.tsx`, `tests/fx/native/iris.test.tsx`,
  `tests/web/iris.test.ts`

**Interfaces:**
- **Produces:**
  - `IrisPreset { kind: 'iris'; origin: OriginSpec; shape: 'circle' | 'rounded-rect' | 'diamond'; feather: number; ring: { width: number; color: string } | null }`
  - `iris(opts?)`, with defaults `origin 'press'`, `shape 'circle'`, `feather 2`, `ring null`,
    `duration 0.5`, `easing 'easeInOutCubic'`
  - **Shader:** the distance from the origin is measured per shape (circle: Euclidean; diamond: L1;
    rounded-rect: a rounded-box SDF). `r = eased·maxR`, where `maxR` is the distance to the farthest
    corner. `alpha = smoothstep(r − feather, r, d)` for the swap hole; `1 − alpha` inside for
    enter and exit. The ring adds `color` where `|d − r| < width`.
  - `FlareFxApi.swap(update: () => void, preset: PresetRef): Promise<boolean>`, added to the
    `useFlareFx()` return on both entries.

**Swap ordering:**

1. **Live preset:** play the exit; when it ends, call `update()`; after React commits, play the enter.
2. **Snapshot preset:** capture the old state; the overlay draws the old image at full size (frame 1,
   flushed); then `update()`; after the commit, `progress` runs and the hole grows; at the end the
   layer unmounts.
3. **The live view is never hidden** during a swap.

- [ ] **Step 1: write the failing tests.**
  - `iris()` defaults.
  - The iris uniforms pack `u_origin` from `'press'` (falling back to the centre), and
    `u_maxR = hypot` to the farthest corner.
  - Swap with `iris`: the call order is `capture` → first frame `flush` → `update` → commit →
    progress starts. `update` is never called before the overlay's first frame.
  - Swap with `flip`: exit end → `update` → enter.
  - Swap while a previous swap runs: the second waits for the first to finish (it is queued, not
    dropped).
  - A capture failure during swap calls `update()` at once and resolves `false`.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS. Do a manual Telegram-style theme swap on
  Android and in Chrome.
- [ ] **Step 5:** commit `feat(ui-fx): add iris preset and swap content transitions`.

### Task 23: optional floor and bounds collision (UIFX-23)

- **Labels:** `type:feature`, `scope:engine`, `size:s`, `priority:p3`. **Depends on:** 18.

- `collide: 'floor' | 'bounds'` switches pose evaluation to a fixed-dt (1/120 s) semi-implicit Euler
  step stored in the state buffer, with restitution 0.35 and friction 0.8.
- The closed form stays the default.

- [ ] **Step 1: write the failing tests.**
  - With `floor`, no piece goes below the floor y.
  - Kinetic energy decreases on each bounce.
  - With `none`, the poses equal the closed form.
- [ ] **Steps 2-4:** run the tests (FAIL), implement, run again (PASS).
- [ ] **Step 5:** commit `feat(ui-fx): add optional floor and bounds collision`.

---

## Phase 6: components

### Task 24: lists, RN and DOM (UIFX-24)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 12, 13, 15, 18.

**Files:**
- Create: `src/rn/{flare-item.tsx,flare-flat-list.tsx}`, `src/dom/flare-list.tsx`
- Test: `tests/rn/lists.test.tsx`, `tests/dom/flare-list.test.tsx`

**Interfaces:**
- **Produces, RN:**
  - `FlareItem({ itemKey, enter?, exit?, holdSpace?, children })`. Enter fires on first appearance
    of the key within the nearest list context; standalone, it fires once per mount.
  - `FlareFlatList<T>(props: FlatListProps<T> & { keyExtractor: (t: T, i: number) => string; enter?; exit?; stagger?: number; animateInitial?: boolean })`.
    It is `Animated.FlatList` with `itemLayoutAnimation={LinearTransition}` on native.
- **Produces, DOM:**
  - `FlareList<T>({ items, keyOf, render(item, key): ReactNode, as?: keyof JSX.IntrinsicElements, enter?, exit?, stagger?, animateInitial? })`.
    Reflow on removal uses `flipReflow`.

- [ ] **Step 1: write the failing tests.**
  - A row scrolled out and back (unmount then remount with the same key) does **not** re-enter.
  - A removed row stays rendered until its exit releases it.
  - A snapshot exit releases at handoff, so the next row's FLIP starts in the same frame.
  - Undo: a key re-added during exit gives a single row that enters fresh (Review Focus 2).
  - Stagger offsets are `0, 0.04, 0.08` for three appended rows.
- [ ] **Step 2:** run the tests. **Expected:** FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run the tests. **Expected:** PASS. Do a manual 1,000-row scroll on Android and
  Chrome.
- [ ] **Step 5:** commit `feat(ui-fx): add FlareItem, FlareFlatList and FlareList`.

### Task 25: FlashList v2 and Legend List adapters (UIFX-25)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p3`. **Depends on:** 24.

- Add subpath entries `./flash-list` and `./legend-list` (exports, tsdown entries). Their peers are
  optional.
- FlashList: call `prepareForLayoutAnimationRender()` before an animated insert or remove; reset item
  state on a key change (`useRecyclingState`).
- Legend: wrap `AnimatedLegendList`.

- [ ] **Step 1: write the failing tests.**
  - A recycled cell receiving a new key resets its phase to `enter`, not `exit`.
  - The FlashList ref's `prepareForLayoutAnimationRender` is called exactly once per removal.
- [ ] **Steps 2-4:** run the tests (FAIL), implement, run again (PASS).
- [ ] **Step 5:** commit `feat(ui-fx): add FlashList and Legend List adapters`.

### Task 26: toaster, RN and DOM (UIFX-26)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 12, 9, 13, 15.

**Files:** create `src/rn/toaster.tsx` and `src/dom/toaster.tsx`. Test: `tests/rn/toaster.test.tsx`,
`tests/dom/toaster.test.tsx`.

**Interfaces:**
- **Produces:**
  - `FlareToaster({ position = 'bottom', visibleToasts = 3, gap = 14, offset = 16, duration = 4, enter = slide({ from: 'bottom' }), exit = fade(), store? })`
  - RN: positions come from `layoutToastStackInto` with safe-area insets when
    `react-native-safe-area-context` is present.
  - DOM: a portal into `document.body`.
  - Each toast is a `FlareView` / `FlareDiv` driven by presence. Auto-dismiss uses `duration` and
    pauses on hover or press.

- [ ] **Step 1: write the failing tests.**
  - A fourth toast waits until one dismisses.
  - Exit presets play before removal.
  - `dismiss()` exits all toasts.
  - Two toasters (root and inside a modal) render independently.
  - Hovering pauses the timer.
- [ ] **Steps 2-4:** run the tests (FAIL), implement, run again (PASS).
- [ ] **Step 5:** commit `feat(ui-fx): add FlareToaster for RN and DOM`.

### Task 27: tooltip, RN and DOM (UIFX-27)

- **Labels:** `type:feature`, `scope:engine`, `size:l`, `priority:p2`. **Depends on:** 9, 13, 15, 0.5.

**Files:** create `src/rn/tooltip.tsx` and `src/dom/tooltip.tsx`. Test: `tests/rn/tooltip.test.tsx`,
`tests/dom/tooltip.test.tsx`.

**Interfaces:**
- **Produces:**
  - `FlareTooltip({ content, children, side = 'top', align = 'center', offset = 8, trigger = 'auto', enter = emerge({ distance: 6 }), exit = fade(), openDelay = 0.4, closeDelay = 0.1 })`
  - `trigger` is `'auto' | 'press' | 'long-press' | 'hover' | 'focus'`. `auto` means hover plus focus on
    the web, and long-press on native.
  - The anchor is measured in `useLayoutEffect` with `getBoundingClientRect()`, or `measureInWindow`
    when G7 requires it. Set `collapsable={false}` on native.
  - The bubble renders into the provider's overlay portal.
  - `role="tooltip"` and `aria-describedby` on the web; `accessibilityHint` on native.

- [ ] **Step 1: write the failing tests.**
  - The bubble position equals `placeFloatingInto` for a mocked anchor rect.
  - It flips at the viewport top.
  - The hover delay is honoured.
  - Escape closes it on the web.
  - Long-press opens it on native.
  - The anchor inside a modal uses the modal's own overlay.
- [ ] **Steps 2-4:** run the tests (FAIL), implement, run again (PASS).
- [ ] **Step 5:** commit `feat(ui-fx): add FlareTooltip for RN and DOM`.

### Task 28: modal, RN and DOM (UIFX-28)

- **Labels:** `type:feature`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 16, 17, 26.

**Files:** create `src/rn/modal.tsx` and `src/dom/modal.tsx`. Test: `tests/rn/modal.test.tsx`,
`tests/dom/modal.test.tsx`.

**Interfaces:**
- **Produces:**
  - `FlareModal({ visible, onClose, children, enter = slide({ from: 'bottom', distance: 24 }), exit = fade(), backdrop = fade({ opacity: 0 }), backdropOpacity = 0.6 })`
  - **RN:** `Modal transparent animationType="none"`. Inside it, a nested `FlareProvider` overlay and
    `hostFactory()` (the nested FX host). `onRequestClose` (Android back) plays the exit, then calls
    `onClose`.
  - **DOM:** `<dialog>` with `showModal()`. The nested web FX canvas is portalled **into the dialog**,
    because the top layer is above `body`. The `cancel` event (Escape) calls `preventDefault`, plays
    the exit, then `close()`.

- [ ] **Step 1: write the failing tests.**
  - `visible=false` keeps the modal mounted until the exit ends.
  - Back or Escape routes through the exit.
  - A shatter exit inside the modal draws on the nested host, not the root host.
  - Focus returns to the opener on the web.
- [ ] **Steps 2-4:** run the tests (FAIL), implement, run again (PASS).
- [ ] **Step 5:** commit `feat(ui-fx): add FlareModal for RN and DOM`.

---

## Phase 7: proof, docs, release

### Task 29: bench rows (UIFX-29)

- **Labels:** `type:perf`, `scope:harness`, `size:m`, `priority:p2`. **Depends on:** 19, 20.

- [ ] Add bench suites under `benchmarks/`:
  - `generateFracture` at 40 and 300 shards
  - `fragmentPoseInto` × 300 / 2k / 5k per frame
  - `sampleLivePosesInto` for a 0.35 s slide
  - The Android capture-latency row joins the device bench on owned hardware (#162). TestingBot
    was dropped on 2026-11-19, so rows beyond the Pixel 7 wait for the Q1 2027 devices (#454).
- [ ] Add a web lane row: a 2k-grain disintegrate in Chromium, pinned per the web-lane rules.
- [ ] Promote the baselines. Replace spec §6.9's planning budgets with the measured numbers.
- [ ] Commit `perf(ui-fx): add fracture, pose and capture bench rows`.

### Task 30: web parity end-to-end, react-native-web and DOM (UIFX-30)

- **Labels:** `type:verification`, `scope:engine`, `size:m`, `priority:p2`. **Depends on:** 28.

- [ ] Add `packages/ui-fx/e2e/`: two Vite fixtures (react-dom, and react-native-web via an alias)
  rendering every preset on every component. Keep it out of `files` (not shipped).
- [ ] Add a Playwright script run with **node**, not bun, across Chromium, Firefox and WebKit. It
  asserts that each run fires `onFx end finished=true`, that no console errors appear, and that
  exactly one WebGL context exists per host. It runs with and without the rasterizer.
- [ ] Publish the support matrix (spec §6.12 plus the observed results) in the package README.
  iOS rows say "unverified (Apple deferred)".
- [ ] Commit `test(ui-fx): add web parity e2e for RNW and DOM`.

### Task 31: docs (UIFX-31)

- **Labels:** `type:feature`, `scope:docs`, `size:m`, `priority:p2`. **Depends on:** 28.

- [ ] Write the full `docs/design/api-specs.md` section for `@flare-engine/ui-fx`.
- [ ] Write README quickstarts for the three hosts:
  - RN: `FlareProvider` + `FlareFxHost`
  - react-native-web: the same, plus `setWebRasterizer(await modernScreenshotRasterizer())`
  - React DOM: `./dom` imports
- [ ] Add the native setup notes to the RN quickstart:
  - **Bundle Mode is recommended (C41).** ui-fx's worklets ran 1.3–1.8× faster on the Pixel 7, and
    G8 passed in both modes.
  - **The first build can fail (C41).** A release build fails once after worklet code changes
    ("Failed to get the SHA-1 for …/.worklets/<id>.js"); a second build passes.
  - **The display-mode module (C39).** On Android 15+, effects may run at 30–60 Hz without it. Say
    what it needs (Expo modules) and how to tell whether it's linked, from the one-time development
    warning.
- [ ] Add recipes in `docs/recipes/`:
  - shatter on delete-row
  - disintegrate a toast
  - a tooltip emerging from shadow
  - a custom `sequence`
  - wrapping `@flare-engine/ui` in `FlareView` (C20)
  - scrubbing with external `progress`
  - a 3D flip card swap
  - an iris theme switch with `swap()`
  - writing a custom preset with `defineLivePreset` and `shaderEffect`
- [ ] Run `bun run check:readme`. **Expected:** PASS, with every exported symbol documented.
- [ ] Commit `docs(ui-fx): add API spec, quickstarts and recipes`.

### Task 32: go public in 0.5.0 (UIFX-32)

- **Labels:** `type:feature`, `scope:engine`, `size:s`, `priority:p1`. **Milestone:** `0.5.0`.
  Expected `risk:held`.
- **Depends on:** 0.1, and Tasks 1-31 (25 and 23 may be deferred with a reason).

- [ ] Remove `"private": true` and add `"publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }`.
- [ ] Sweep the 42-package count to 43:
  - `AGENTS.md`
  - `docs/design/adr-0000-template.md`
  - `.changeset/README.md`
  - `CONTRIBUTING.md`
  - `docs/design/architecture.md`
  - `docs/plans/versioning-and-announcements.md`
- [ ] Add a **Beta** row for `ui-fx` to the stability-tier table.
- [ ] Add a `patch` changeset for `@flare-engine/ui-fx`; the 0.5.0 cut's own minor changeset and ADR
  carry the version.
- [ ] Run `bun run check:publish-safety`, `check:changeset`, `check:tarballs` and `check:bump`.
  **Expected:** all PASS.
- [ ] Do a release-workflow dry run that lists `@flare-engine/ui-fx` with its trusted publisher.
- [ ] Commit `feat(ui-fx): publish ui-fx as Beta`.

---

## Side findings (filed 2026-11-16)

- #375: the Reanimated floor admits 4.0.x (0.5.0 milestone).
- #376: the stale gesture-handler peer row in `architecture.md` (Hygiene).
- A comment on #349: v3 removes `makeImageFromView`, and unscoped 2.15.x is a possible intermediate
  step.

**Optional, UIFX-S4: `ui` accepts `ref` on Button, Panel and Label.** `type:feature`, `scope:engine`,
`size:s`, `priority:p3`. It is an additive `patch`, so `createFlareComponent` can wrap `ui` directly.
Done when a ref reaches the host `View` and the existing `ui` tests pass unchanged.

## Deferred: Apple (no milestone, D8)

- **A1:** an iOS verification pass covering G1, G5, and the manual runs of Tasks 13, 18, 20, 21 and
  24 on an iPhone through an EAS or Mac build. The README's iOS rows flip from "unverified".
- **A2:** an optional `react-native-screens` `FullWindowOverlay` for `FlareFxHost` on iOS, above
  native-stack modals.
- **A3:** iOS rows in the Apple bench lanes on owned hardware (#452).
