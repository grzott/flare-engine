---
"@flare-engine/react": patch
---

Fix simultaneous VirtualJoystick + VirtualButton use (PT-9.1 blocker). GameView routes all concurrent touches to InputManager using real pointer identifiers from `nativeEvent.changedTouches` instead of hardcoded id 0. VirtualJoystick adds `onResponderTerminationRequest={false}` so it retains its vector when a second finger touches the screen. VirtualButton switches from the single-owner responder system to raw `onTouchStart`/`onTouchEnd`/`onTouchCancel` events, which fire regardless of who holds the responder — enabling both controls to operate simultaneously without interference.
