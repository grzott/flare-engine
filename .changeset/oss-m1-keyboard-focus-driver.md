---
"@flare-engine/input": minor
"@flare-engine/ui": minor
---

Keyboard input + UI focus driver. `@flare-engine/input` adds `createKeyboard` / `attachKeyboardListeners` (buffered `isDown`/`wasPressed`/`wasReleased` edges, blur clears held keys) + a `KeyBindings` action resolver; keyboard state + binding are platform-neutral (mobile + web) with `keyDown`/`keyUp` injection. `@flare-engine/ui` adds `createFocusKeyboardDriver` — arrows/Tab move focus, Enter/Space activate, via the reactive FocusManager.
