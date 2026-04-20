---
name: flare-input
description: Deep knowledge of the @flare-engine/input package — InputManager, Pointer, GestureDetector, joystick/button state. Use when handling pointer/touch input, gestures (tap/swipe/pinch/long-press), or wiring virtual joystick / button state into a Flare game.
---

# `@flare-engine/input`

Layer 2. Polling model + signals. Screen-space coordinates — use `camera.screenToWorldInto()` to convert.

## Exports

```ts
import {
  InputManager,
  GestureDetector,
  createJoystickState,
  updateJoystick,
  releaseJoystick,
  createButtonState,
  pressButton,
  releaseButton,
} from "@flare-engine/input";
```

The React components `<VirtualJoystick>` and `<VirtualButton>` live in `@flare-engine/react`, not here. This package ships only the state machines + data functions.

## Per-frame contract

```ts
input.update(); // once per frame, before game logic
if (input.pointer.justPressed) {
  /* fire on edge */
}
const dir = updateJoystick(joystickState, input.pointer);
```

- `justPressed` / `justReleased` are _edge_ flags — they're only true the frame the state changed. Don't poll them in a coroutine that may skip frames.
- `touches[]` is stable per frame but reused — don't stash references across frames.

## Gestures

`GestureDetector` emits via signals: `onTap`, `onSwipe`, `onPinch`, `onLongPress`. Handlers receive screen-space data.

Spec: [docs/design/api-specs.md § @flare-engine/input](../../../docs/design/api-specs.md).
