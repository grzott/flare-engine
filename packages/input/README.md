# @flare-engine/input

Pointer / touch / gesture / virtual-control / gamepad input. `InputManager` polls per frame; `Pointer` exposes primary touch with `isDown` / `justPressed` / `delta`; `GestureDetector` emits tap / swipe / pinch / long-press; data-only `VirtualJoystick` + `VirtualButton` state (RN components live in `@flare-engine/react`); `GamepadSource` + `RemapTable` cover gamepad polling and persistent rebinds.

## Install

```sh
bun add @flare-engine/input
```

## Usage

```ts
import { InputManager, GestureDetector, createWebGamepadSource } from '@flare-engine/input';

const input = new InputManager();
const gestures = new GestureDetector();
gestures.onSwipe.add((e) => console.log(e.direction));

input.pollGamepads(createWebGamepadSource(navigator));
input.update();
```

See [API spec](../../docs/design/api-specs.md#flare-engineinput--6kb-gzip).

## License

MIT
