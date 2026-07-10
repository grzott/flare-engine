export {
  createGamepadState,
  GamepadAxis,
  type GamepadAxisId,
  GamepadButton,
  type GamepadButtonId,
  type GamepadButtonState,
  type GamepadSnapshot,
  type GamepadState,
  getAxis,
  isButtonDown,
  resetGamepadFrame,
  updateGamepadFromSnapshot,
  wasButtonPressed,
  wasButtonReleased,
} from './gamepad.js';
export {
  createWebGamepadSource,
  type GamepadSource,
} from './gamepad-source.js';
export {
  type GestureConfig,
  GestureDetector,
  type PinchEvent,
  type SwipeDirection,
  type SwipeEvent,
} from './gestures.js';
export { InputManager } from './input-manager.js';
export {
  createPointer,
  type Pointer,
  pointerDown,
  pointerMove,
  pointerUp,
  resetPointerFrame,
  type TouchPoint,
} from './pointer.js';
export {
  type AxisMap,
  applyRemap,
  createIdentityRemap,
  loadRemap,
  type RemapStore,
  type RemapTable,
  saveRemap,
} from './remap.js';
export {
  createButtonState,
  pressButton,
  releaseButton,
  resetButtonFrame,
  type VirtualButtonState,
} from './virtual-button.js';
export {
  createJoystickState,
  releaseJoystick,
  updateJoystick,
  type VirtualJoystickConfig,
  type VirtualJoystickState,
} from './virtual-joystick.js';
