---
'@flare-engine/input': patch
---

PF-3: settle the published surface of `input` before the 0.4.0 freeze. Per ADR-0004.

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
