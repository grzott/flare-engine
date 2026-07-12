# @flare-engine/input

Pointer / touch / gesture / virtual-control / gamepad / keyboard input. `InputManager` polls per frame; `Pointer` exposes primary touch with `isDown` / `justPressed` / `delta`; `GestureDetector` emits tap / swipe / pinch / long-press; data-only `VirtualJoystick` + `VirtualButton` state (RN components live in `@flare-engine/react`); `GamepadSource` + `RemapTable` cover gamepad polling and persistent rebinds; `createKeyboard` provides buffered `isDown` / `wasPressed` / `wasReleased` edges per `KeyboardEvent.code` with blur-clears-held semantics.

## Install

```sh
bun add @flare-engine/input
```

## Usage

```ts
import {
  InputManager,
  GestureDetector,
  createWebGamepadSource,
  attachKeyboardListeners,
} from '@flare-engine/input';

const input = new InputManager();
const gestures = new GestureDetector();
gestures.onSwipe.add((e) => console.log(e.direction));

// Web: attach turnkey keyboard listener (mobile/RN: call input.keyboard.keyDown/keyUp directly)
attachKeyboardListeners(input.keyboard, window);

input.pollGamepads(createWebGamepadSource(navigator));
input.update(); // resets all per-frame edge flags including keyboard
```

### Platform coverage

`KeyboardState` and `KeyBindings` are platform-neutral (mobile + web):

- **Web** — `attachKeyboardListeners(kb, window)` is a turnkey DOM adapter that feeds `keyDown`/`keyUp` from native events and calls `kb.clear()` on `blur` (stuck-key guard). It deliberately does NOT call `preventDefault` — bare use lets Space/arrows scroll and Tab move DOM focus. For game-mode input, attach your own listener that `preventDefault`s game keys and forwards `kb.keyDown(ev.code)`.
- **Mobile / RN** — call `kb.keyDown(code)` / `kb.keyUp(code)` directly from a hardware-keyboard native module or an on-screen source. The same edge semantics apply.

```ts
// Action binding example (platform-neutral)
import { InputManager, isActionDown, wasActionPressed, type KeyBindings } from '@flare-engine/input';

const bindings: KeyBindings = { jump: ['Space', 'KeyW'], fire: ['KeyZ', 'KeyJ'] };

function update(input: InputManager, player: { jump(): void; fire(): void }) {
  // in update loop:
  if (wasActionPressed(input.keyboard, bindings, 'jump')) player.jump();
  if (isActionDown(input.keyboard, bindings, 'fire')) player.fire();
}
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineinput--6kb-gzip).

## License

MIT
