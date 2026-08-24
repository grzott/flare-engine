---
"@flare-engine/render": minor
"@flare-engine/react": minor
---

Fix unconditional web postfx warn and stale version literal (WEB-7).

**Defect 1 — unconditional warn.** `GameView` emitted `"postfx chain skipped"` on every web load
regardless of whether a postfx binding actually existed. The blank scaffolder template configures no
chain and still logged the warning on every load.

**Defect 2 — stale version literal.** The warning hardcoded `"RN-Skia 2.4.18"` while the
templates ship RN-Skia 2.6.0, so it named a version the consumer does not have.

**Fix — `hasPostFxBinding()` predicate (`@flare-engine/render`).** `FrameRenderer` gains a new
method `hasPostFxBinding(): boolean`. It returns `true` only when a runtime is bound, its
`supported` flag is truthy, its `buildPass` method is present, and a chain is also bound. Crucially,
it never calls `runtime.buildPass` — `buildPass` is the call that throws `"Not implemented on React
Native Web"` in RN-Skia's `Skia.RuntimeShaderBuilder` and
`ImageFilter.MakeRuntimeShaderWithChildren`. The predicate is therefore safe to call on web.

**Fix — gated warn (`@flare-engine/react`).** `GameView`'s web branch now fires the
`console.warn` only when `bridge.hasPostFxBinding()` is true. A template with no chain loads
silently.

**Fix — no version literal.** The warning message no longer contains a version number. It names
both throwing call sites — `Skia.RuntimeShaderBuilder` and
`ImageFilter.MakeRuntimeShaderWithChildren` — and the thrown message `"Not implemented on React
Native Web"`. Those are facts the code can stand behind; the version is not.

**Behaviour change — per-instance warn-once.** The warn-once flag moved from a module-level
variable to a `useRef` inside `<GameView>`. The observable difference: a page that mounts two
`<GameView>` instances each with a postfx chain will now see two warnings (one per instance) rather
than one. This is the intended behaviour: each instance is independently informative.
